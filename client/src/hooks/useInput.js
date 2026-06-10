import { useRef, useEffect } from 'react';

// useInput возвращает стабильный getInput (через ref),
// чтобы Game.jsx useEffect не перезапускался при ререндере
export function useInput() {
  const keysRef  = useRef({});
  const mouseRef = useRef({ x: 0, y: 0, down: false });
  // Стабильная функция — никогда не меняется
  const getInputRef = useRef(() => ({
    forward  : !!(keysRef.current['KeyW'] || keysRef.current['ArrowUp']),
    backward : !!(keysRef.current['KeyS'] || keysRef.current['ArrowDown']),
    left     : !!(keysRef.current['KeyA'] || keysRef.current['ArrowLeft']),
    right    : !!(keysRef.current['KeyD'] || keysRef.current['ArrowRight']),
    shooting : mouseRef.current.down,
    mouseX   : mouseRef.current.x,
    mouseY   : mouseRef.current.y,
  }));

  useEffect(() => {
    const kd = e => {
      keysRef.current[e.code] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))
        e.preventDefault();
    };
    const ku = e => { keysRef.current[e.code] = false; };
    const mm = e => { mouseRef.current.x = e.clientX; mouseRef.current.y = e.clientY; };
    const md = e => { if (e.button === 0) mouseRef.current.down = true; };
    const mu = e => { if (e.button === 0) mouseRef.current.down = false; };
    const cx = e => e.preventDefault();

    window.addEventListener('keydown',     kd);
    window.addEventListener('keyup',       ku);
    window.addEventListener('mousemove',   mm);
    window.addEventListener('mousedown',   md);
    window.addEventListener('mouseup',     mu);
    window.addEventListener('contextmenu', cx);
    return () => {
      window.removeEventListener('keydown',     kd);
      window.removeEventListener('keyup',       ku);
      window.removeEventListener('mousemove',   mm);
      window.removeEventListener('mousedown',   md);
      window.removeEventListener('mouseup',     mu);
      window.removeEventListener('contextmenu', cx);
    };
  }, []); // единственный mount

  return getInputRef.current; // стабильная ссылка
}
