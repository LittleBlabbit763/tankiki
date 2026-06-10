// Синтез звуков через Web Audio API без внешних файлов

class SoundManager {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.enabled = true;
    this._init();
  }

  _init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.4;
      this.masterGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('Web Audio недоступен:', e);
      this.enabled = false;
    }
  }

  _resume() {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  _createOscillator(freq, type, duration, gainVal = 0.3) {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  _noise(duration, gainVal = 0.15, filterFreq = 1000) {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    const bufLen = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(this.ctx.currentTime);
  }

  // Выстрел
  shoot() {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    // Короткий высокий тон + шум
    this._createOscillator(220, 'sawtooth', 0.08, 0.25);
    this._noise(0.07, 0.12, 3000);
  }

  // Попадание в танк
  tankHit() {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    this._createOscillator(80, 'square', 0.15, 0.3);
    this._noise(0.1, 0.2, 500);
  }

  // Взрыв танка
  explosion() {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    this._noise(0.6, 0.5, 200);
    this._createOscillator(60, 'sine', 0.5, 0.3);
  }

  // Попадание в блок
  blockHit() {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    this._noise(0.08, 0.15, 800);
    this._createOscillator(150, 'triangle', 0.06, 0.1);
  }

  // Разрушение блока
  blockDestroyed() {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    this._noise(0.25, 0.35, 300);
    this._createOscillator(100, 'square', 0.2, 0.15);
  }

  // Подбор опыта
  pickup() {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    this._createOscillator(600, 'sine', 0.12, 0.15);
    setTimeout(() => this._createOscillator(900, 'sine', 0.1, 0.1), 60);
  }

  // Повышение уровня
  levelUp() {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    const freqs = [400, 500, 600, 800];
    freqs.forEach((f, i) => {
      setTimeout(() => this._createOscillator(f, 'sine', 0.2, 0.2), i * 80);
    });
  }

  // Смерть игрока
  playerDeath() {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    this._noise(0.8, 0.4, 150);
    this._createOscillator(80, 'sawtooth', 0.8, 0.25);
  }

  // Убийство врага
  killEnemy() {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    const freqs = [500, 700, 600, 900];
    freqs.forEach((f, i) => {
      setTimeout(() => this._createOscillator(f, 'triangle', 0.15, 0.2), i * 50);
    });
  }

  // Увеличение арены
  arenaExpand() {
    if (!this.enabled || !this.ctx) return;
    this._resume();
    this._createOscillator(200, 'sine', 0.5, 0.2);
    setTimeout(() => this._createOscillator(300, 'sine', 0.4, 0.15), 200);
  }

  setEnabled(v) { this.enabled = v; }
}

export const soundManager = new SoundManager();
