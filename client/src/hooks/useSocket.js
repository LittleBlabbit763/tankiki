import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export function useSocket(handlersRef) {
  const socketRef = useRef(null);
  const emitRef   = useRef((ev, data) => socketRef.current?.emit(ev, data));

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports          : ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay   : 1000,
    });
    socketRef.current = socket;

    const EVENTS = [
      'connect', 'disconnect', 'connect_error',
      'init', 'tick',
      'tankHit', 'tankDied', 'died',
      'blockDestroyed', 'blockHit',
      'pickupCollected', 'shot',
      'killedEnemy', 'playerJoined', 'playerLeft',
      'arenaExpanded',
      'pong_check',
    ];

    for (const ev of EVENTS) {
      socket.on(ev, (...args) => handlersRef.current?.[ev]?.(...args));
    }

    return () => {
      socket.off();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return emitRef;
}
