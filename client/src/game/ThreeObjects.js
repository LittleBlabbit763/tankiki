import * as THREE from 'three';

// ─── Геометрии-синглтоны (создаются один раз на всё приложение) ───────────────
const G = {};
function geo() {
  if (G._init) return G;
  G._init = true;
  G.box1    = new THREE.BoxGeometry(1, 1, 1);        // масштабируем через scale
  G.cyl8    = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
  G.sphere6 = new THREE.SphereGeometry(0.5, 6, 6);
  return G;
}

// Материалы-синглтоны
const MAT = {};
function mat() {
  if (MAT._init) return MAT;
  MAT._init  = true;
  MAT.bullet  = new THREE.MeshBasicMaterial({ color: 0xffee00 });
  MAT.ground  = new THREE.MeshLambertMaterial({ color: 0x1c3a1c });
  MAT.wall    = new THREE.MeshLambertMaterial({ color: 0x2a4a2a });
  MAT.blockN  = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
  MAT.blockH  = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
  MAT.pickup  = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
  MAT.pickupB = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
  return MAT;
}

// ─── Танк ─────────────────────────────────────────────────────────────────────
// Минимальная детализация: корпус + башня + дуло = 4 меша
export function createTankMesh(isPlayer, colorStr) {
  geo(); mat();

  const bodyColor   = isPlayer ? 0x2e7d32 : parseColor(colorStr, 0.32);
  const turretColor = isPlayer ? 0x1b5e20 : parseColor(colorStr, 0.22);
  const trackColor  = 0x1a1a1a;

  const bodyMat   = new THREE.MeshLambertMaterial({ color: bodyColor });
  const turretMat = new THREE.MeshLambertMaterial({ color: turretColor });
  const trackMat  = new THREE.MeshLambertMaterial({ color: trackColor });
  const barrelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

  const root = new THREE.Group();

  // Корпус (2.4 × 0.7 × 3.2)
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.7, 3.2), bodyMat);
  body.position.y = 0.7;
  body.castShadow = true;
  root.add(body);

  // Две гусеницы
  for (const sx of [-1, 1]) {
    const tr = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.45, 3.4), trackMat);
    tr.position.set(sx * 1.15, 0.22, 0);
    root.add(tr);
  }

  // Башня (вращается вокруг Y)
  const turretGroup = new THREE.Group();
  turretGroup.position.set(0, 1.4, 0.1);

  const turret = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.9, 0.5, 8), turretMat);
  turret.castShadow = true;
  turretGroup.add(turret);

  // Дуло
  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 2.4), barrelMat);
  barrel.position.set(0, 0.1, 1.3);
  turretGroup.add(barrel);

  root.add(turretGroup);

  return { group: root, turretGroup };
}

function parseColor(colorStr, lightness) {
  if (!colorStr) return new THREE.Color().setHSL(0.5, 0.6, lightness).getHex();
  const m = colorStr.match(/hsl\((\d+)/);
  const h = m ? parseInt(m[1]) / 360 : 0.5;
  return new THREE.Color().setHSL(h, 0.65, lightness).getHex();
}

// ─── Снаряд ───────────────────────────────────────────────────────────────────
export function createBulletMesh() {
  geo(); mat();
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 5, 5), MAT.bullet);
  return m;
}

// ─── Блок ─────────────────────────────────────────────────────────────────────
export function createBlockMesh(block) {
  geo(); mat();
  const s = block.size * 2;
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(s, s, s),
    block.type === 'hard' ? MAT.blockH : MAT.blockN
  );
  m.position.y = block.size;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ─── Пикап ────────────────────────────────────────────────────────────────────
export function createPickupMesh(pickup) {
  geo(); mat();
  const r = pickup.big ? 0.5 : 0.32;
  return new THREE.Mesh(
    new THREE.SphereGeometry(r, 7, 7),
    pickup.big ? MAT.pickupB : MAT.pickup
  );
}

// ─── Лейбл (canvas texture) ───────────────────────────────────────────────────
export function createNameLabel(nickname, isPlayer) {
  const W = 192, H = 40;
  const canvas = document.createElement('canvas');
  canvas.width  = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  let lastRatio = -1;

  function redraw(hpRatio) {
    ctx.clearRect(0, 0, W, H);
    // Имя
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = isPlayer ? '#39ff14' : '#ffffff';
    ctx.fillText(nickname.slice(0, 12), W / 2, 15);
    // HP bar bg
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(16, 22, W - 32, 8);
    // HP bar fill
    const r = Math.max(0, Math.min(1, hpRatio));
    ctx.fillStyle = r > 0.6 ? '#00e676' : r > 0.3 ? '#ffee58' : '#ff3333';
    ctx.fillRect(16, 22, Math.floor((W - 32) * r), 8);
  }
  redraw(1);

  const tex = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 0.7),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, side: THREE.DoubleSide })
  );
  mesh.position.y = 4.0;

  return {
    sprite: mesh,
    update(hp, maxHp) {
      const ratio = maxHp > 0 ? hp / maxHp : 0;
      if (Math.abs(ratio - lastRatio) < 0.01) return; // не перерисовываем без изменений
      lastRatio = ratio;
      redraw(ratio);
      tex.needsUpdate = true;
    }
  };
}

// ─── Арена: земля + стены, ноль лишнего ──────────────────────────────────────
export function createArena(size) {
  mat();
  const group = new THREE.Group();
  const half  = size / 2;
  const wallH = 3;

  // Земля
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    MAT.ground
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Grid helper (чисто линии, без геометрии)
  const grid = new THREE.GridHelper(size, Math.round(size / 5), 0x2a5a2a, 0x224422);
  grid.position.y = 0.02;
  group.add(grid);

  // 4 стены одним материалом
  const wallDefs = [
    // [cx, cz, w, d]
    [0,       -half - 1, size + 2, 2],
    [0,        half + 1, size + 2, 2],
    [-half - 1, 0,        2, size],
    [ half + 1, 0,        2, size],
  ];
  for (const [cx, cz, w, d] of wallDefs) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), MAT.wall);
    m.position.set(cx, wallH / 2, cz);
    group.add(m);
  }

  return group;
}
