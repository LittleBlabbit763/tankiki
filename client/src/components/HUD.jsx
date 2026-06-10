import React, { useEffect, useRef, useState } from 'react';

// ========================
// Leaderboard
// ========================
export function Leaderboard({ entries = [], myId }) {
  return (
    <div className="leaderboard">
      <div className="leaderboard-title">◆ Таблица лидеров</div>
      {entries.slice(0, 8).map((e, i) => (
        <div key={e.id} className={`leaderboard-entry${e.id === myId ? ' is-me' : ''}`}>
          <span className="leaderboard-rank">#{i + 1}</span>
          <span className="leaderboard-name">{e.nickname}</span>
          <span className="leaderboard-score">{e.score}</span>
        </div>
      ))}
    </div>
  );
}

// ========================
// Kill Feed
// ========================
export function KillFeed({ events }) {
  return (
    <div className="killfeed">
      {events.map((ev, i) => (
        <div key={ev.id} className="killfeed-item">
          <span className="killer">{ev.killer}</span>
          <span className="sep">✕</span>
          <span className="victim">{ev.victim}</span>
        </div>
      ))}
    </div>
  );
}

// ========================
// Bottom bar: HP + XP + stats
// ========================
export function BottomBar({ hp = 100, maxHp = 100, xp = 0, xpToNext = 100, level = 1, kills = 0, score = 0 }) {
  const hpRatio = Math.max(0, Math.min(1, hp / maxHp));
  const xpRatio = Math.max(0, Math.min(1, xp / xpToNext));
  const hpClass = hpRatio > 0.6 ? '' : hpRatio > 0.3 ? ' mid' : ' low';

  return (
    <div className="bottom-bar">
      <div className="hp-xp-row">
        <div className="hp-bar-wrap">
          <div className="bar-label">
            <span>HP</span>
            <span>{hp}/{maxHp}</span>
          </div>
          <div className="bar-track">
            <div className={`bar-fill hp-fill${hpClass}`} style={{ width: `${hpRatio * 100}%` }} />
          </div>
        </div>
        <div className="xp-bar-wrap">
          <div className="bar-label">
            <span>XP — Ур. {level}</span>
            <span>{xp}/{xpToNext}</span>
          </div>
          <div className="bar-track">
            <div className="bar-fill xp-fill" style={{ width: `${xpRatio * 100}%` }} />
          </div>
        </div>
      </div>
      <div className="stats-row">
        <div className="stat-item">
          <span>Очки:</span>
          <strong>{score}</strong>
        </div>
        <div className="stat-item kills">
          <span>Убийств:</span>
          <strong>{kills}</strong>
        </div>
      </div>
    </div>
  );
}

// ========================
// Crosshair
// ========================
export function Crosshair() {
  return (
    <div className="crosshair">
      <svg className="crosshair-svg" width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="8" fill="none" stroke="#39ff14" strokeWidth="1.5" opacity="0.8"/>
        <line x1="20" y1="2" x2="20" y2="12" stroke="#39ff14" strokeWidth="1.5" opacity="0.8"/>
        <line x1="20" y1="28" x2="20" y2="38" stroke="#39ff14" strokeWidth="1.5" opacity="0.8"/>
        <line x1="2" y1="20" x2="12" y2="20" stroke="#39ff14" strokeWidth="1.5" opacity="0.8"/>
        <line x1="28" y1="20" x2="38" y2="20" stroke="#39ff14" strokeWidth="1.5" opacity="0.8"/>
        <circle cx="20" cy="20" r="1.5" fill="#39ff14" opacity="0.9"/>
      </svg>
    </div>
  );
}

// ========================
// Minimap
// ========================
export function Minimap({ data }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !data) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const half = data.arenaSize / 2;

    ctx.clearRect(0, 0, W, H);

    // Фон
    ctx.fillStyle = 'rgba(10,26,10,0.9)';
    ctx.fillRect(0, 0, W, H);

    // Сетка
    ctx.strokeStyle = 'rgba(57,255,20,0.08)';
    ctx.lineWidth = 0.5;
    for (let g = 0; g < 5; g++) {
      const x = (g / 4) * W;
      const y = (g / 4) * H;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Конвертация мировых координат в пиксели карты
    const toMap = (wx, wz) => ({
      x: ((wx + half) / data.arenaSize) * W,
      y: ((wz + half) / data.arenaSize) * H,
    });

    // Пикапы
    ctx.fillStyle = 'rgba(0,255,136,0.5)';
    for (const p of (data.pickups || [])) {
      const { x, y } = toMap(p.x, p.z);
      ctx.beginPath();
      ctx.arc(x, y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Танки
    for (const t of (data.tanks || [])) {
      const { x, y } = toMap(t.x, t.z);
      ctx.fillStyle = t.isMe ? '#39ff14' : 'rgba(255,60,60,0.9)';
      ctx.beginPath();
      ctx.arc(x, y, t.isMe ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (t.isMe) {
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Граница
    ctx.strokeStyle = 'rgba(57,255,20,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
  }, [data]);

  return (
    <div className="minimap">
      <canvas ref={canvasRef} width={130} height={130} />
    </div>
  );
}

// ========================
// Notifications
// ========================
export function Notification({ text }) {
  if (!text) return null;
  return <div className="notification">{text}</div>;
}

export function LevelUpBanner({ level }) {
  if (!level) return null;
  return <div className="levelup-banner">⬆ УРОВЕНЬ {level}!</div>;
}

export function ArenaNotif({ show, size }) {
  if (!show) return null;
  return <div className="arena-notif">⚡ Арена расширилась: {Math.round(size)}×{Math.round(size)}</div>;
}

// ========================
// Respawn overlay
// ========================
export function RespawnOverlay({ show }) {
  if (!show) return null;
  return (
    <div className="respawn-overlay">
      <div className="respawn-text">💀 ВЫ УНИЧТОЖЕНЫ</div>
      <div className="respawn-sub">Возрождение...</div>
    </div>
  );
}

// ========================
// Controls hint
// ========================
export function ControlsHint() {
  return (
    <div className="controls-hint">
      <div><span className="key">W</span><span className="key">A</span><span className="key">S</span><span className="key">D</span> — Движение</div>
      <div>Мышь — Прицел</div>
      <div><span className="key">ЛКМ</span> — Огонь</div>
    </div>
  );
}

// ========================
// Connection status
// ========================
export function ConnStatus({ status }) {
  const labels = {
    connected: '● ОНЛАЙН',
    connecting: '◐ ПОДКЛЮЧЕНИЕ...',
    disconnected: '✕ ОТКЛЮЧЁН',
  };
  return (
    <div className={`conn-status ${status}`}>
      {labels[status] || labels.disconnected}
    </div>
  );
}
