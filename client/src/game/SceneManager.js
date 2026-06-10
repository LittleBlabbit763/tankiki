import * as THREE from 'three';
import {
  createTankMesh, createBulletMesh, createBlockMesh,
  createPickupMesh, createNameLabel, createArena,
} from './ThreeObjects.js';

window._THREE = THREE;

// ─── Константы — совпадают с сервером ─────────────────────────────────────────
const PLAYER_SPEED  = 9;
const TURN_SPEED    = 2.6;   // рад/сек
const BLOCK_MARGIN  = 1.6;   // радиус танка

function lerpAngle(a, b, t) {
  // Shortest-path lerp угла
  let d = b - a;
  while (d >  Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// ─── Чужой танк с интерполяцией ───────────────────────────────────────────────
class RemoteTank {
  constructor() {
    this.snapA = null; this.snapB = null;
    this.tA = 0;       this.tB = 0;
    this.group        = null;
    this.turretGroup  = null;
    this.label        = null;
  }
  push(snap, now) {
    this.snapA = this.snapB; this.tA = this.tB;
    this.snapB = snap;       this.tB = now;
  }
  interp(renderTime) {
    if (!this.snapB) return null;
    if (!this.snapA) return this.snapB;
    const span = this.tB - this.tA;
    if (span < 1) return this.snapB;
    const t = Math.min(1.3, (renderTime - this.tA) / span);
    return {
      x:           this.snapA.x    + (this.snapB.x    - this.snapA.x)    * t,
      z:           this.snapA.z    + (this.snapB.z    - this.snapA.z)    * t,
      angle:       lerpAngle(this.snapA.angle,       this.snapB.angle,       t),
      turretAngle: lerpAngle(this.snapA.turretAngle, this.snapB.turretAngle, t),
    };
  }
}

// ─── Клиентский снаряд ────────────────────────────────────────────────────────
class CBullet {
  constructor(d) {
    this.id = d.id;
    this.x = d.x; this.z = d.z;
    this.vx = d.vx; this.vz = d.vz;
    this.mesh = null;
  }
  step(dt) { this.x += this.vx * dt; this.z += this.vz * dt; }
}

// ─── SceneManager ─────────────────────────────────────────────────────────────
export class SceneManager {
  constructor(canvas, particles) {
    this.canvas    = canvas;
    this.particles = particles;

    this.renderer = null;
    this.scene    = null;
    this.camera   = null;

    this.myId      = null;
    this.ready     = false;
    this.arenaSize = 80;
    this.blocks    = [];   // { id, x, z, size }

    // Состояние своего танка
    this.myState = { x: 0, z: 0, angle: 0, turretAngle: 0 };
    this.myGroup       = null;
    this.myTurretGroup = null;

    // Камера — независима от поворота танка
    // Всегда смотрит сверху-сзади в мировых координатах, не привязана к angle
    this.camX = 0; this.camY = 18; this.camZ = -16;
    this.lookX = 0; this.lookZ = 2;

    this.remoteTanks   = new Map();
    this.clientBullets = new Map();
    this.blockMeshes   = new Map();
    this.pickupMeshes  = new Map();
    this.arenaGroup    = null;

    this.INTERP_DELAY = 80;

    this._setup();
  }

  // ─── Рендерер и сцена ─────────────────────────────────────────────────────
  _setup() {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false; // тени — главный убийца FPS

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1f0d);
    this.scene.fog = new THREE.Fog(0x0d1f0d, 80, 160);

    this.camera = new THREE.PerspectiveCamera(
      60, window.innerWidth / window.innerHeight, 0.5, 200
    );
    this.camera.position.set(0, 18, -16);
    this.camera.lookAt(0, 0, 2);

    // Свет: один ambient + один directional (дёшево)
    this.scene.add(new THREE.AmbientLight(0x6a9a6a, 1.6));
    const dir = new THREE.DirectionalLight(0xbbddbb, 0.9);
    dir.position.set(0.5, 1, 0.3).normalize();
    this.scene.add(dir);

    this.arenaGroup = createArena(this.arenaSize);
    this.scene.add(this.arenaGroup);
  }

  // ─── Init от сервера ──────────────────────────────────────────────────────
  initFromServer({ id, arenaSize, blocks, pickups, color }) {
    // Защита от двойного вызова
    if (this.myGroup) {
      this.scene.remove(this.myGroup);
      this.myGroup = null;
    }

    this.myId      = id;
    this.arenaSize = arenaSize;

    this._rebuildArena(arenaSize);
    this._loadBlocks(blocks);
    this._loadPickups(pickups);

    // Создаём меш своего танка
    const { group, turretGroup } = createTankMesh(true, color);
    group.position.set(0, 0, 0);
    this.scene.add(group);
    this.myGroup       = group;
    this.myTurretGroup = turretGroup;

    // Сбрасываем состояние
    this.myState = { x: 0, z: 0, angle: 0, turretAngle: 0 };

    // Камера — фиксированное смещение от игрока, не зависит от угла
    this.camX = 0; this.camY = 18; this.camZ = -16;
    this.lookX = 0; this.lookZ = 2;
    this.camera.position.set(0, 18, -16);
    this.camera.lookAt(0, 0, 2);

    this.ready = true;
  }

  _rebuildArena(size) {
    if (this.arenaGroup) this.scene.remove(this.arenaGroup);
    this.arenaGroup = createArena(size);
    this.scene.add(this.arenaGroup);
    this.arenaSize = size;
    this.scene.fog = new THREE.Fog(0x0d1f0d, size * 0.8, size * 1.8);
  }

  _loadBlocks(serverBlocks) {
    for (const m of this.blockMeshes.values()) this.scene.remove(m);
    this.blockMeshes.clear();
    this.blocks = serverBlocks.map(b => ({ id: b.id, x: b.x, z: b.z, size: b.size }));
    for (const bl of serverBlocks) {
      const m = createBlockMesh(bl);
      m.position.set(bl.x, 0, bl.z);
      this.scene.add(m);
      this.blockMeshes.set(bl.id, m);
    }
  }

  _loadPickups(pickups) {
    for (const m of this.pickupMeshes.values()) this.scene.remove(m);
    this.pickupMeshes.clear();
    for (const pk of pickups) {
      const m = createPickupMesh(pk);
      m.position.set(pk.x, 0.8, pk.z);
      this.scene.add(m);
      this.pickupMeshes.set(pk.id, m);
    }
  }

  // ─── Клиентский предиктор движения ────────────────────────────────────────
  // Вызывается каждый кадр ПЕРЕД отправкой на сервер
  predictMyTank(input, dt) {
    if (!this.ready) return;
    const s    = this.myState;
    const half = this.arenaSize / 2 - 1.8;

    // Поворот — A/D вращают корпус танка
    if (input.left)  s.angle -= TURN_SPEED * dt;
    if (input.right) s.angle += TURN_SPEED * dt;

    // Движение — W/S двигают ВДОЛЬ текущего угла корпуса
    let dx = 0, dz = 0;
    if (input.fwd) {
      dx = Math.sin(s.angle) * PLAYER_SPEED * dt;
      dz = Math.cos(s.angle) * PLAYER_SPEED * dt;
    }
    if (input.bwd) {
      dx = -Math.sin(s.angle) * PLAYER_SPEED * dt * 0.55;
      dz = -Math.cos(s.angle) * PLAYER_SPEED * dt * 0.55;
    }

    // Применяем движение по осям раздельно (скольжение вдоль стен)
    let nx = Math.max(-half, Math.min(half, s.x + dx));
    let nz = Math.max(-half, Math.min(half, s.z + dz));

    // Ось X: двигаем X, z остаётся старым
    for (const bl of this.blocks) {
      if (Math.abs(nx - bl.x) < bl.size + BLOCK_MARGIN &&
          Math.abs(s.z - bl.z) < bl.size + BLOCK_MARGIN) {
        nx = s.x;
        break;
      }
    }
    // Ось Z: двигаем Z, x — уже скорректированный
    for (const bl of this.blocks) {
      if (Math.abs(nx - bl.x) < bl.size + BLOCK_MARGIN &&
          Math.abs(nz - bl.z) < bl.size + BLOCK_MARGIN) {
        nz = s.z;
        break;
      }
    }

    s.x = nx;
    s.z = nz;
    s.turretAngle = input.turretAngle;

    // Обновляем меш мгновенно (предиктор — без задержки)
    if (this.myGroup) {
      this.myGroup.position.set(s.x, 0, s.z);
      this.myGroup.rotation.y = s.angle;
      if (this.myTurretGroup) {
        // Башня вращается в мировых координатах относительно корпуса
        this.myTurretGroup.rotation.y = s.turretAngle - s.angle;
      }
    }
  }

  // Мягкая коррекция от сервера
  reconcile(serverMe) {
    const s = this.myState;
    const ex = Math.abs(s.x - serverMe.x);
    const ez = Math.abs(s.z - serverMe.z);
    // Резиновая лента — только при заметном расхождении
    if (ex > 1.5 || ez > 1.5) {
      s.x = s.x * 0.5 + serverMe.x * 0.5;
      s.z = s.z * 0.5 + serverMe.z * 0.5;
    }
  }

  // ─── Снапшот от сервера ───────────────────────────────────────────────────
  applyServerTick(tick) {
    if (!this.ready) return;
    const now = performance.now();
    const { me, others, bullets } = tick;

    if (me) this.reconcile(me);

    // Чужие танки
    const activeIds = new Set(others.map(o => o.id));
    for (const o of others) {
      let rt = this.remoteTanks.get(o.id);
      if (!rt) {
        rt = new RemoteTank();
        const { group, turretGroup } = createTankMesh(false, o.color);
        const label = createNameLabel(o.nickname, false);
        group.add(label.sprite);
        group.position.set(o.x, 0, o.z);
        this.scene.add(group);
        rt.group       = group;
        rt.turretGroup = turretGroup;
        rt.label       = label;
        this.remoteTanks.set(o.id, rt);
      }
      rt.push(o, now);
      rt.label.update(o.hp, o.maxHp);
    }
    for (const [id, rt] of this.remoteTanks) {
      if (!activeIds.has(id)) {
        this.scene.remove(rt.group);
        this.remoteTanks.delete(id);
      }
    }

    // Снаряды
    const activeBullets = new Set(bullets.map(b => b.id));
    for (const bd of bullets) {
      if (!this.clientBullets.has(bd.id)) {
        const cb   = new CBullet(bd);
        const mesh = createBulletMesh();
        mesh.position.set(bd.x, 1.0, bd.z);
        this.scene.add(mesh);
        cb.mesh = mesh;
        this.clientBullets.set(bd.id, cb);
      }
    }
    for (const [id, cb] of this.clientBullets) {
      if (!activeBullets.has(id)) {
        this.scene.remove(cb.mesh);
        this.clientBullets.delete(id);
      }
    }
  }

  // ─── Рендер (60 fps) ──────────────────────────────────────────────────────
  render(dt, timeSec) {
    const renderTime = performance.now() - this.INTERP_DELAY;

    // Интерполяция чужих
    for (const rt of this.remoteTanks.values()) {
      const s = rt.interp(renderTime);
      if (!s) continue;
      rt.group.position.set(s.x, 0, s.z);
      rt.group.rotation.y = s.angle;
      if (rt.turretGroup)
        rt.turretGroup.rotation.y = s.turretAngle - s.angle;
      if (rt.label?.sprite)
        rt.label.sprite.quaternion.copy(this.camera.quaternion);
    }

    // Экстраполяция снарядов
    for (const cb of this.clientBullets.values()) {
      cb.step(dt);
      cb.mesh.position.set(cb.x, 1.0, cb.z);
    }

    // Анимация пикапов (без аллокаций)
    for (const m of this.pickupMeshes.values()) {
      m.rotation.y += dt * 1.5;
      m.position.y  = 0.8 + Math.sin(timeSec * 2.2 + m.position.x) * 0.14;
    }

    this._updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  }

  // ─── Камера ───────────────────────────────────────────────────────────────
  // Камера ВСЕГДА смотрит с одной стороны (не вращается за танком).
  // Смещение фиксировано в мировом пространстве.
  // Танк едет по арене — камера просто следует сверху-сзади.
  _updateCamera(dt) {
    if (!this.ready) return;

    const px = this.myState.x;
    const pz = this.myState.z;

    // Фиксированное смещение: всегда сзади и выше в мировых координатах
    const OFFSET_Z = -16;   // сзади по Z
    const OFFSET_Y = 18;    // высота

    const targetCamX = px;
    const targetCamY = OFFSET_Y;
    const targetCamZ = pz + OFFSET_Z;

    // Lerp для плавности, независимый от FPS
    const k = 1 - Math.pow(0.05, dt);   // ~0.05 decay per frame
    this.camX += (targetCamX - this.camX) * k;
    this.camY += (targetCamY - this.camY) * k;
    this.camZ += (targetCamZ - this.camZ) * k;

    // Точка взгляда — по центру танка (слегка впереди)
    const targetLookX = px;
    const targetLookZ = pz + 2;
    this.lookX += (targetLookX - this.lookX) * k;
    this.lookZ += (targetLookZ - this.lookZ) * k;

    this.camera.position.set(this.camX, this.camY, this.camZ);
    this.camera.lookAt(this.lookX, 0, this.lookZ);
  }

  // ─── Угол башни к мыши ────────────────────────────────────────────────────
  getTurretAngleToMouse(mx, my) {
    if (!this.ready) return 0;
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        (mx / window.innerWidth)  *  2 - 1,
        (my / window.innerHeight) * -2 + 1,
      ),
      this.camera,
    );
    // Пересечение с плоскостью Y=0.5 (высота дула)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.5);
    const hit   = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return this.myState.turretAngle;
    return Math.atan2(hit.x - this.myState.x, hit.z - this.myState.z);
  }

  // ─── Мини-карта ───────────────────────────────────────────────────────────
  getMiniMapData() {
    const tanks = [{
      id: this.myId, x: this.myState.x, z: this.myState.z, isMe: true,
    }];
    for (const [id, rt] of this.remoteTanks) {
      if (rt.snapB) tanks.push({ id, x: rt.snapB.x, z: rt.snapB.z, isMe: false });
    }
    const pickups = [];
    for (const m of this.pickupMeshes.values())
      pickups.push({ x: m.position.x, z: m.position.z });
    return { arenaSize: this.arenaSize, tanks, pickups, myId: this.myId };
  }

  // ─── Мировые события ──────────────────────────────────────────────────────
  removeBlock(id) {
    const m = this.blockMeshes.get(id);
    if (!m) return;
    if (this.particles) {
      const sp = this._toScreen(m.position.clone().setY(1.5));
      if (sp) this.particles.spawnExplosion(sp.x, sp.y);
    }
    this.scene.remove(m);
    this.blockMeshes.delete(id);
    this.blocks = this.blocks.filter(b => b.id !== id);
  }

  addPickup(pk) {
    if (this.pickupMeshes.has(pk.id)) return;
    const m = createPickupMesh(pk);
    m.position.set(pk.x, 0.8, pk.z);
    this.scene.add(m);
    this.pickupMeshes.set(pk.id, m);
  }

  removePickup(id) {
    const m = this.pickupMeshes.get(id);
    if (!m) return;
    if (this.particles) {
      const sp = this._toScreen(m.position);
      if (sp) this.particles.spawnPickup(sp.x, sp.y);
    }
    this.scene.remove(m);
    this.pickupMeshes.delete(id);
  }

  showHitEffect(x, z) {
    if (!this.particles) return;
    const sp = this._toScreen(new THREE.Vector3(x, 1.2, z));
    if (sp) this.particles.spawnHit(sp.x, sp.y);
  }

  showTankExplosion(x, z) {
    if (!this.particles) return;
    const sp = this._toScreen(new THREE.Vector3(x, 1, z));
    if (sp) this.particles.spawnExplosion(sp.x, sp.y);
  }

  rebuildForNewArena(size, newBlocks) {
    this._rebuildArena(size);
    // Добавляем только новые блоки (старые остаются)
    for (const bl of (newBlocks || [])) {
      if (!this.blockMeshes.has(bl.id)) {
        const m = createBlockMesh(bl);
        m.position.set(bl.x, 0, bl.z);
        this.scene.add(m);
        this.blockMeshes.set(bl.id, m);
        this.blocks.push({ id: bl.id, x: bl.x, z: bl.z, size: bl.size });
      }
    }
  }

  _toScreen(wp) {
    const v = wp.clone().project(this.camera);
    if (v.z >= 1) return null;
    return {
      x: ( v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    this.renderer.dispose();
  }
}
