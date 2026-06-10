const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const cors     = require('cors');
const { v4: uuidv4 } = require('uuid');

const app    = express();
app.use(cors());
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 2000,
  pingTimeout : 8000,
});

// ─── Константы ────────────────────────────────────────────────────────────────
const TICK_RATE    = 20;
const DT           = 1 / TICK_RATE;
const BASE_ARENA   = 60;    // начальный размер (маленький при 1 игроке)
const ARENA_STEP   = 4;     // игроков до следующего расширения
const ARENA_GROWTH = 20;    // на сколько растёт
const MAX_ARENA    = 300;
const PLAYER_SPEED = 9;
const TURN_SPEED   = 2.6;
const TANK_RADIUS  = 1.6;
const BULLET_SPEED = 40;
const BULLET_LIFE  = 2.5;   // сек
const INVULN_MS    = 2500;
const MAX_HP       = 100;
const SHOOT_CD     = 750;
const XP_KILL      = 80;
const XP_PICKUP    = 10;
const XP_BIG       = 30;
const XP_BLOCK     = 15;

// ─── Состояние ────────────────────────────────────────────────────────────────
const gs = {
  players  : {},
  bullets  : {},
  blocks   : [],
  pickups  : [],
  arenaSize: BASE_ARENA,
  tick     : 0,
};

// ─── Утилиты ──────────────────────────────────────────────────────────────────
const rnd    = (a, b) => Math.random() * (b - a) + a;
const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist2d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function targetArenaSize(playerCount) {
  return Math.min(
    MAX_ARENA,
    BASE_ARENA + Math.floor(playerCount / ARENA_STEP) * ARENA_GROWTH
  );
}

function spawnPos(size) {
  const h = size / 2 - 6;
  return { x: rnd(-h, h), z: rnd(-h, h) };
}

// ─── Генерация ────────────────────────────────────────────────────────────────
function genBlocks(size, count) {
  const h = size / 2 - 6;
  const n = count !== undefined ? count : Math.floor(size * 0.7);
  const out = [];
  for (let i = 0; i < n; i++) {
    const isHard = Math.random() < 0.22;
    const hp = isHard ? 5 : 3;
    out.push({
      id: uuidv4(),
      x : rnd(-h, h),
      z : rnd(-h, h),
      hp, maxHp: hp,
      size: rnd(1.4, 3.0),
      type: isHard ? 'hard' : 'normal',
    });
  }
  return out;
}

function genPickups(size) {
  const h = size / 2 - 4;
  const n = Math.floor(size * 0.45);
  const out = [];
  for (let i = 0; i < n; i++) {
    const big = Math.random() < 0.12;
    out.push({
      id: uuidv4(),
      x : rnd(-h, h),
      z : rnd(-h, h),
      value: big ? XP_BIG : XP_PICKUP,
      big,
    });
  }
  return out;
}

function initLevel(size) {
  gs.blocks  = genBlocks(size);
  gs.pickups = genPickups(size);
}

// ─── Игроки ───────────────────────────────────────────────────────────────────
function createPlayer(id, nickname) {
  const pos = spawnPos(gs.arenaSize);
  return {
    id, nickname,
    x: pos.x, z: pos.z,
    angle      : rnd(0, Math.PI * 2),
    turretAngle: 0,
    hp: MAX_HP, maxHp: MAX_HP,
    score: 0, kills: 0,
    level: 1, xp: 0, xpToNext: 100,
    color    : `hsl(${Math.floor(rnd(0, 360))},70%,55%)`,
    lastShot : 0,
    shootCd  : SHOOT_CD,
    damage   : 25,
    speed    : PLAYER_SPEED,
    spawnTime: Date.now(),
    input: { fwd: false, bwd: false, left: false, right: false,
             shooting: false, turretAngle: 0 },
  };
}

function levelUp(p) {
  p.level++;
  p.xp      -= p.xpToNext;
  p.xpToNext = Math.floor(p.xpToNext * 1.5);
  p.damage   = Math.min(55, p.damage + 3);
  p.shootCd  = Math.max(380, p.shootCd - 25);
  p.maxHp    = Math.min(220, p.maxHp + 15);
  p.hp       = p.maxHp;
}

function addXP(p, amount) {
  p.xp    += amount;
  p.score += amount;
  while (p.xp >= p.xpToNext) levelUp(p);
}

// ─── Снаряды ──────────────────────────────────────────────────────────────────
function fireBullet(shooterId, x, z, angle, damage) {
  const id = uuidv4();
  gs.bullets[id] = {
    id, shooterId, x, z,
    vx: Math.sin(angle) * BULLET_SPEED,
    vz: Math.cos(angle) * BULLET_SPEED,
    damage,
    life: BULLET_LIFE,
  };
  return id;
}

// ─── Физика игроков ───────────────────────────────────────────────────────────
function stepPlayers() {
  const half = gs.arenaSize / 2 - 1.8;

  for (const p of Object.values(gs.players)) {
    if (p.hp <= 0) continue;
    const inp = p.input;

    // Поворот
    if (inp.left)  p.angle -= TURN_SPEED * DT;
    if (inp.right) p.angle += TURN_SPEED * DT;

    // Движение вдоль текущего угла корпуса
    let dx = 0, dz = 0;
    if (inp.fwd) {
      dx = Math.sin(p.angle) * p.speed * DT;
      dz = Math.cos(p.angle) * p.speed * DT;
    } else if (inp.bwd) {
      dx = -Math.sin(p.angle) * p.speed * DT * 0.55;
      dz = -Math.cos(p.angle) * p.speed * DT * 0.55;
    }

    // Коллизия по осям раздельно (скольжение вдоль стен)
    let nx = clamp(p.x + dx, -half, half);
    let nz = clamp(p.z + dz, -half, half);

    // Ось X: проверяем nx при старом z
    for (const bl of gs.blocks) {
      if (Math.abs(nx - bl.x) < bl.size + TANK_RADIUS &&
          Math.abs(p.z - bl.z) < bl.size + TANK_RADIUS) {
        nx = p.x;
        break;
      }
    }
    // Ось Z: проверяем nz при скорректированном nx
    for (const bl of gs.blocks) {
      if (Math.abs(nx - bl.x) < bl.size + TANK_RADIUS &&
          Math.abs(nz - bl.z) < bl.size + TANK_RADIUS) {
        nz = p.z;
        break;
      }
    }

    p.x = nx;
    p.z = nz;
    p.turretAngle = inp.turretAngle;

    // Стрельба
    const now = Date.now();
    if (inp.shooting && now - p.lastShot >= p.shootCd) {
      const bx = p.x + Math.sin(p.turretAngle) * 2.8;
      const bz = p.z + Math.cos(p.turretAngle) * 2.8;
      const bid = fireBullet(p.id, bx, bz, p.turretAngle, p.damage);
      p.lastShot = now;
      io.emit('shot', { id: bid, shooterId: p.id, x: bx, z: bz });
    }

    // Пикапы
    for (let i = gs.pickups.length - 1; i >= 0; i--) {
      if (dist2d(p, gs.pickups[i]) < 2.2) {
        addXP(p, gs.pickups[i].value);
        io.emit('pickupCollected', { id: gs.pickups[i].id, collectorId: p.id });
        gs.pickups.splice(i, 1);
      }
    }
  }
}

// ─── Физика снарядов ──────────────────────────────────────────────────────────
function stepBullets() {
  const half     = gs.arenaSize / 2;
  const toRemove = [];

  for (const [id, b] of Object.entries(gs.bullets)) {
    b.x    += b.vx * DT;
    b.z    += b.vz * DT;
    b.life -= DT;

    if (b.life <= 0 || Math.abs(b.x) > half || Math.abs(b.z) > half) {
      toRemove.push(id); continue;
    }

    // Блоки
    let hitBlock = false;
    for (let i = 0; i < gs.blocks.length; i++) {
      const bl = gs.blocks[i];
      if (Math.abs(b.x - bl.x) < bl.size && Math.abs(b.z - bl.z) < bl.size) {
        bl.hp--;
        if (bl.hp <= 0) {
          const dropPk = {
            id: uuidv4(), x: bl.x + rnd(-1, 1), z: bl.z + rnd(-1, 1),
            value: XP_BLOCK, big: false,
          };
          gs.pickups.push(dropPk);
          io.emit('blockDestroyed', { id: bl.id, x: bl.x, z: bl.z, pickup: dropPk });
          gs.blocks.splice(i, 1);
          const shooter = gs.players[b.shooterId];
          if (shooter) addXP(shooter, XP_BLOCK);
        } else {
          io.emit('blockHit', { id: bl.id, hp: bl.hp, maxHp: bl.maxHp });
        }
        hitBlock = true; break;
      }
    }
    if (hitBlock) { toRemove.push(id); continue; }

    // Танки
    for (const p of Object.values(gs.players)) {
      if (p.id === b.shooterId || p.hp <= 0) continue;
      if (Date.now() - p.spawnTime < INVULN_MS) continue;
      if (dist2d(b, p) < TANK_RADIUS) {
        p.hp -= b.damage;
        io.emit('tankHit', { id: p.id, hp: p.hp, maxHp: p.maxHp, x: b.x, z: b.z });
        if (p.hp <= 0) killPlayer(p, b.shooterId);
        toRemove.push(id); break;
      }
    }
  }
  toRemove.forEach(id => delete gs.bullets[id]);
}

// ─── Смерть и возрождение ─────────────────────────────────────────────────────
function killPlayer(victim, killerId) {
  const killer = gs.players[killerId];
  if (killer) {
    addXP(killer, XP_KILL + victim.level * 10);
    killer.kills++;
    io.to(killerId).emit('killedEnemy', { nickname: victim.nickname });
  }
  for (let d = 0; d < 4; d++) {
    gs.pickups.push({
      id: uuidv4(),
      x: victim.x + rnd(-3, 3), z: victim.z + rnd(-3, 3),
      value: XP_PICKUP, big: false,
    });
  }
  io.emit('tankDied', { id: victim.id, x: victim.x, z: victim.z });
  io.to(victim.id).emit('died');
  const pos = spawnPos(gs.arenaSize);
  victim.x  = pos.x; victim.z = pos.z;
  victim.hp = victim.maxHp;
  victim.spawnTime = Date.now();
}

// ─── Пополнение пикапов ───────────────────────────────────────────────────────
function refillPickups() {
  const target = Math.floor(gs.arenaSize * 0.45);
  while (gs.pickups.length < target) {
    const big = Math.random() < 0.12;
    const h   = gs.arenaSize / 2 - 4;
    gs.pickups.push({
      id: uuidv4(), x: rnd(-h, h), z: rnd(-h, h),
      value: big ? XP_BIG : XP_PICKUP, big,
    });
  }
}

// ─── Лидерборд ────────────────────────────────────────────────────────────────
function leaderboard() {
  return Object.values(gs.players)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(p => ({ id: p.id, nickname: p.nickname, score: p.score, kills: p.kills, level: p.level }));
}

// ─── Игровой тик ──────────────────────────────────────────────────────────────
function gameTick() {
  gs.tick++;

  stepPlayers();
  stepBullets();

  if (gs.tick % (TICK_RATE * 5) === 0) refillPickups();

  // Динамическая арена
  const pcount     = Object.keys(gs.players).length;
  const targetSize = targetArenaSize(pcount);
  if (targetSize !== gs.arenaSize) {
    const oldSize    = gs.arenaSize;
    gs.arenaSize     = targetSize;
    // Добавляем блоки только в новой зоне (не ломаем старые)
    const newBlocks  = genBlocks(targetSize, 10);
    gs.blocks.push(...newBlocks);
    io.emit('arenaExpanded', {
      size     : gs.arenaSize,
      newBlocks: newBlocks,
    });
    console.log(`Arena: ${oldSize} -> ${targetSize} (${pcount} players)`);
  }

  // Снапшот каждому игроку
  const bullets = Object.values(gs.bullets).map(b => ({
    id: b.id, x: b.x, z: b.z, vx: b.vx, vz: b.vz, shooterId: b.shooterId,
  }));
  const board = leaderboard();
  const now   = Date.now();

  for (const [sid, socket] of io.sockets.sockets) {
    const me = gs.players[sid];
    if (!me) continue;

    const others = Object.values(gs.players)
      .filter(p => p.id !== sid)
      .map(p => ({
        id: p.id, nickname: p.nickname,
        x: p.x, z: p.z,
        angle: p.angle, turretAngle: p.turretAngle,
        hp: p.hp, maxHp: p.maxHp,
        level: p.level, color: p.color,
      }));

    socket.emit('tick', {
      me: {
        x: me.x, z: me.z, angle: me.angle,
        hp: me.hp, maxHp: me.maxHp,
        level: me.level, xp: me.xp, xpToNext: me.xpToNext,
        score: me.score, kills: me.kills,
        invuln: (now - me.spawnTime) < INVULN_MS,
      },
      others,
      bullets,
      leaderboard: board,
    });
  }
}

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('+ connect', socket.id);

  socket.on('join', ({ nickname }) => {
    if (gs.players[socket.id]) return; // защита от двойного join

    const p = createPlayer(socket.id, nickname || 'Игрок');
    gs.players[socket.id] = p;

    const pcount = Object.keys(gs.players).length;
    if (pcount === 1) initLevel(BASE_ARENA);

    // Пересчитать нужный размер арены
    const needed = targetArenaSize(pcount);
    if (needed !== gs.arenaSize) {
      gs.arenaSize = needed;
      const extra = genBlocks(needed, 8);
      gs.blocks.push(...extra);
    }

    socket.emit('init', {
      id       : socket.id,
      arenaSize: gs.arenaSize,
      blocks   : gs.blocks,
      pickups  : gs.pickups,
      color    : p.color,
    });

    io.emit('playerJoined', { id: p.id, nickname: p.nickname });
    console.log(`join "${nickname}" total=${pcount} arena=${gs.arenaSize}`);
  });

  socket.on('input', (inp) => {
    const p = gs.players[socket.id];
    if (!p) return;
    p.input.fwd         = !!inp.fwd;
    p.input.bwd         = !!inp.bwd;
    p.input.left        = !!inp.left;
    p.input.right       = !!inp.right;
    p.input.shooting    = !!inp.shooting;
    p.input.turretAngle = (typeof inp.turretAngle === 'number') ? inp.turretAngle : 0;
  });

  // Пинг: клиент шлёт timestamp, сервер возвращает его обратно
  socket.on('ping_check', (ts) => {
    socket.emit('pong_check', ts);
  });

  socket.on('disconnect', () => {
    delete gs.players[socket.id];
    io.emit('playerLeft', { id: socket.id });
    console.log('- disconnect', socket.id, 'total=', Object.keys(gs.players).length);
  });
});

// ─── HTTP ─────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({
  ok: true, players: Object.keys(gs.players).length,
  tick: gs.tick, arena: gs.arenaSize,
}));
app.get('/', (_, res) => res.json({ game: 'Танчики', status: 'ok' }));

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Танчики сервер: порт ${PORT}, ${TICK_RATE} тиков/сек`);
  initLevel(BASE_ARENA);
  setInterval(gameTick, 1000 / TICK_RATE);
});
