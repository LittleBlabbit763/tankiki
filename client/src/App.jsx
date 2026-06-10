import React, { useState } from 'react';
import { StartScreen } from './components/StartScreen.jsx';
import { Game } from './components/Game.jsx';

export default function App() {
  const [nickname, setNickname] = useState(null);
  return nickname === null
    ? <StartScreen onPlay={setNickname} />
    : <Game key="game" nickname={nickname} />;
}
