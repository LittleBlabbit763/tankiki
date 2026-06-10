// Система 2D-партиклов поверх 3D-сцены
// Конвертирует 3D позиции в 2D экранные координаты через Three.js camera

export class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.active = true;
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  // Проецирование 3D координат в 2D (через Three.js camera)
  project(x, z, camera, renderer) {
    if (!camera) return null;
    // Используем THREE.Vector3 через глобальный THREE
    const THREE = window._THREE;
    if (!THREE) return null;
    const vec = new THREE.Vector3(x, 1, z);
    vec.project(camera);
    const w = this.canvas.width;
    const h = this.canvas.height;
    return {
      x: (vec.x * 0.5 + 0.5) * w,
      y: (-vec.y * 0.5 + 0.5) * h,
    };
  }

  // Взрыв танка
  spawnExplosion(screenX, screenY) {
    const count = 28;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const speed = Math.random() * 120 + 40;
      this.particles.push({
        type: 'explosion',
        x: screenX, y: screenY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1, maxLife: 1,
        size: Math.random() * 8 + 4,
        color: `hsl(${Math.random() * 30 + 15}, 100%, ${Math.random() * 30 + 50}%)`,
        decay: Math.random() * 1.5 + 1,
        gravity: 80,
      });
    }
    // Дымовые частицы
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        type: 'smoke',
        x: screenX, y: screenY,
        vx: Math.cos(angle) * 30,
        vy: Math.sin(angle) * 30 - 40,
        life: 1, maxLife: 1,
        size: Math.random() * 20 + 10,
        color: '120, 120, 120',
        decay: 0.6,
        gravity: -20,
      });
    }
  }

  // Удар по блоку — каменные осколки
  spawnBlockHit(screenX, screenY) {
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 80 + 20;
      this.particles.push({
        type: 'debris',
        x: screenX, y: screenY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        life: 1, maxLife: 1,
        size: Math.random() * 5 + 2,
        color: `hsl(${Math.random() * 20 + 90}, 20%, ${Math.random() * 20 + 35}%)`,
        decay: 1.5,
        gravity: 120,
      });
    }
  }

  // Подбор опыта — зеленые искры
  spawnPickup(screenX, screenY) {
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        type: 'spark',
        x: screenX, y: screenY,
        vx: Math.cos(angle) * 60,
        vy: Math.sin(angle) * 60 - 30,
        life: 1, maxLife: 1,
        size: Math.random() * 4 + 2,
        color: `hsl(${Math.random() * 40 + 110}, 100%, 60%)`,
        decay: 2,
        gravity: 60,
      });
    }
  }

  // Попадание в танк — искры
  spawnHit(screenX, screenY) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 100 + 30;
      this.particles.push({
        type: 'spark',
        x: screenX, y: screenY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life: 1, maxLife: 1,
        size: Math.random() * 3 + 1,
        color: '#ffbb00',
        decay: 2.5,
        gravity: 100,
      });
    }
  }

  // Частицы выхлопа танка
  spawnExhaust(screenX, screenY) {
    if (Math.random() > 0.4) return;
    this.particles.push({
      type: 'exhaust',
      x: screenX + (Math.random() - 0.5) * 6,
      y: screenY + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 20,
      vy: -Math.random() * 30 - 10,
      life: 1, maxLife: 1,
      size: Math.random() * 6 + 3,
      color: '80, 150, 80',
      decay: 2.5,
      gravity: -10,
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt * p.decay;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
      // Трение
      p.vx *= 0.97;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      const size = p.size * (p.type === 'smoke' || p.type === 'exhaust' ? (1 + (1 - alpha) * 0.5) : alpha);

      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.type === 'smoke' || p.type === 'exhaust') {
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size);
        grad.addColorStop(0, `rgba(${p.color}, ${alpha * 0.6})`);
        grad.addColorStop(1, `rgba(${p.color}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = size * 2;
        ctx.beginPath();
        if (p.type === 'debris') {
          ctx.rect(p.x - size / 2, p.y - size / 2, size, size);
        } else {
          ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
        }
        ctx.fill();
      }

      ctx.restore();
    }
  }

  clear() { this.particles = []; }
}
