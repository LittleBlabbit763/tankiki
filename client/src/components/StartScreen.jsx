import React, { useState, useEffect, useRef } from 'react';

export function StartScreen({ onPlay }) {
  const [nickname, setNickname] = useState('');
  const [leaving, setLeaving]   = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handlePlay = () => {
    const name = nickname.trim() || `Игрок_${Math.floor(Math.random() * 999)}`;
    setLeaving(true);
    setTimeout(() => onPlay(name), 400);
  };

  return (
    <div className={`startup-screen${leaving ? ' leaving' : ''}`}>
      <div className="startup-tank-icon">🎯</div>
      <div className="startup-logo">ТАНЧИКИ</div>
      <div className="startup-subtitle">3D Multiplayer Battle Arena</div>

      <div className="startup-form">
        <div className="startup-input-wrap">
          <label className="startup-input-label">Твой позывной</label>
          <input
            ref={inputRef}
            className="startup-input"
            type="text"
            maxLength={16}
            placeholder="Введи никнейм..."
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handlePlay()}
          />
        </div>
        <button className="startup-btn" onClick={handlePlay}>
          ► ВСТУПИТЬ В БОЙ
        </button>
        <div className="startup-tip">
          WASD — движение &nbsp;|&nbsp; Мышь — прицел &nbsp;|&nbsp; ЛКМ — огонь
        </div>
      </div>
    </div>
  );
}
