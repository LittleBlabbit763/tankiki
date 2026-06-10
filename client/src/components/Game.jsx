import React, { useEffect, useRef, useState } from 'react';
import { SceneManager }   from '../game/SceneManager.js';
import { ParticleSystem } from '../game/ParticleSystem.js';
import { useSocket }      from '../hooks/useSocket.js';
import { useInput }       from '../hooks/useInput.js';
import { soundManager }   from '../sounds/SoundManager.js';
import {
  Leaderboard, KillFeed, BottomBar, Crosshair,
  Minimap, LevelUpBanner, ArenaNotif, RespawnOverlay,
  ControlsHint, ConnStatus, PingDisplay,
} from './HUD.jsx';

export function Game({ nickname }) {
  const canvasRef  = useRef(null);
  const pcanvasRef = useRef(null);
  const sceneRef   = useRef(null);
  const myIdRef    = useRef(null);
  const animRef    = useRef(null);

  // ── React UI state — обновляется 10 раз/сек, не 60 ───────────────────────
  const [connStatus,  setConnStatus]  = useState('connecting');
  const [leaderboard, setLeaderboard] = useState([]);
  const [killFeed,    setKillFeed]    = useState([]);
  const [stats,       setStats]       = useState(
    { hp: 100, maxHp: 100, xp: 0, xpToNext: 100, level: 1, kills: 0, score: 0 }
  );
  const [miniMap,    setMiniMap]    = useState(null);
  const [isDead,     setIsDead]     = useState(false);
  const [lvlBanner,  setLvlBanner]  = useState(null);
  const [arenaNotif, setArenaNotif] = useState(null);
  const [myId,       setMyId]       = useState(null);
  const [ping,       setPing]       = useState(null);

  // Буфер для throttled UI обновлений
  const uiBuf      = useRef({ lb: [], me: null, miniMap: null });
  const uiTimer    = useRef(0);
  const prevLevel  = useRef(1);

  // ── Socket handlers ───────────────────────────────────────────────────────
  const handlersRef = useRef({});
  handlersRef.current = {
    connect      : () => setConnStatus('connected'),
    disconnect   : () => setConnStatus('disconnected'),
    connect_error: () => setConnStatus('disconnected'),

    // Получаем обратно наш timestamp — RTT готов
    pong_check(sentAt) {
      setPing(Math.round(performance.now() - sentAt));
    },

    init(data) {
      myIdRef.current = data.id;
      setMyId(data.id);
      sceneRef.current?.initFromServer(data);
    },

    tick(data) {
      const scene = sceneRef.current;
      if (!scene) return;
      scene.applyServerTick(data);
      // Буферизуем для React UI
      uiBuf.current.lb      = data.leaderboard || uiBuf.current.lb;
      uiBuf.current.me      = data.me || uiBuf.current.me;
      uiBuf.current.miniMap = scene.getMiniMapData();
    },

    // Арена расширилась — обновляем сцену И показываем уведомление
    arenaExpanded(data) {
      sceneRef.current?.rebuildForNewArena(data.size, data.newBlocks);
      soundManager.arenaExpand();
      setArenaNotif(data.size);
      setTimeout(() => setArenaNotif(null), 3000);
    },

    tankHit(data) {
      sceneRef.current?.showHitEffect(data.x, data.z);
      soundManager.tankHit();
      if (data.id === myIdRef.current) flashRed();
    },

    tankDied(data) {
      sceneRef.current?.showTankExplosion(data.x, data.z);
      soundManager.explosion();
    },

    died() {
      setIsDead(true);
      soundManager.playerDeath();
      setTimeout(() => setIsDead(false), 2800);
    },

    blockDestroyed(data) {
      sceneRef.current?.removeBlock(data.id);
      if (data.pickup) sceneRef.current?.addPickup(data.pickup);
      soundManager.blockDestroyed();
    },
    blockHit() { soundManager.blockHit(); },

    pickupCollected(data) {
      sceneRef.current?.removePickup(data.id);
      if (data.collectorId === myIdRef.current) soundManager.pickup();
    },

    shot(data) {
      if (data.shooterId !== myIdRef.current) soundManager.shoot();
    },

    killedEnemy(data) {
      soundManager.killEnemy();
      const id = Date.now();
      setKillFeed(p => [...p.slice(-4), { id, killer: nickname, victim: data.nickname }]);
      setTimeout(() => setKillFeed(p => p.filter(e => e.id !== id)), 3000);
    },
  };

  const emitRef  = useSocket(handlersRef);
  const getInput = useInput();

  // ── Three.js + game loop ──────────────────────────────────────────────────
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = '@keyframes _fl{from{opacity:1}to{opacity:0}}';
    document.head.appendChild(style);

    const canvas  = canvasRef.current;
    const pcanvas = pcanvasRef.current;
    if (!canvas || !pcanvas) return;

    const ps    = new ParticleSystem(pcanvas);
    ps.resize(window.innerWidth, window.innerHeight);

    const scene = new SceneManager(canvas, ps);
    sceneRef.current = scene;

    emitRef.current('join', { nickname });

    // Замер пинга каждые 2 секунды
    const pingInterval = setInterval(() => {
      emitRef.current('ping_check', performance.now());
    }, 2000);
    // Первый замер сразу
    setTimeout(() => emitRef.current('ping_check', performance.now()), 500);

    let lastTime     = performance.now();
    let prevShooting = false;

    const loop = (now) => {
      animRef.current = requestAnimationFrame(loop);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const inp         = getInput();
      const turretAngle = scene.getTurretAngleToMouse(inp.mouseX, inp.mouseY);
      const gameInp     = {
        fwd: inp.forward, bwd: inp.backward,
        left: inp.left,   right: inp.right,
        shooting: inp.shooting, turretAngle,
      };

      // Предиктор — немедленно двигаем свой танк
      scene.predictMyTank(gameInp, dt);

      // Отправляем на сервер
      emitRef.current('input', gameInp);

      // Звук выстрела при нажатии
      if (inp.shooting && !prevShooting) soundManager.shoot();
      prevShooting = inp.shooting;

      // Рендер Three.js
      scene.render(dt, now / 1000);
      ps.update(dt);
      ps.render();

      // ── Throttled React UI: 10 fps — не дёргаем DOM 60 раз/сек ──────────
      if (now - uiTimer.current > 100) {
        uiTimer.current = now;
        const buf = uiBuf.current;

        if (buf.lb.length)  setLeaderboard([...buf.lb]);
        if (buf.miniMap)    setMiniMap({ ...buf.miniMap });

        const me = buf.me;
        if (me) {
          setStats({
            hp: me.hp, maxHp: me.maxHp,
            xp: me.xp, xpToNext: me.xpToNext,
            level: me.level, kills: me.kills, score: me.score,
          });
          if (me.level > prevLevel.current) {
            prevLevel.current = me.level;
            soundManager.levelUp();
            setLvlBanner(me.level);
            setTimeout(() => setLvlBanner(null), 2500);
          }
          if (me.hp > 0) setIsDead(false);
        }
      }
    };
    animRef.current = requestAnimationFrame(loop);

    const onResize = () => {
      scene.resize();
      ps.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      clearInterval(pingInterval);
      window.removeEventListener('resize', onResize);
      scene.dispose();
      sceneRef.current = null;
      style.remove();
    };
  }, []); // eslint-disable-line

  return (
    <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: '#0d1f0d' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', position: 'absolute', inset: 0 }}
      />
      <canvas
        ref={pcanvasRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}
      />
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}>
        <ConnStatus status={connStatus} />
        <Crosshair />
        <Leaderboard entries={leaderboard} myId={myId} />
        <KillFeed events={killFeed} />
        <Minimap data={miniMap} />
        <ControlsHint />
        <BottomBar {...stats} />
        <PingDisplay ping={ping} />
      </div>
      {lvlBanner  && <LevelUpBanner level={lvlBanner} />}
      {arenaNotif && <ArenaNotif show size={arenaNotif} />}
      {isDead     && <RespawnOverlay show />}
    </div>
  );
}

function flashRed() {
  const d = document.createElement('div');
  d.style.cssText =
    'position:fixed;inset:0;background:rgba(255,0,0,0.2);' +
    'pointer-events:none;z-index:50;animation:_fl .35s forwards';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 380);
}
