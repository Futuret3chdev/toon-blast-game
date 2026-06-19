const AudioEngine = (() => {
  let ctx = null;
  let enabled = true;
  let musicGain = null;
  let musicTimer = null;
  let musicStep = 0;

  const MELODY = [523, 587, 659, 698, 784, 698, 659, 587];

  function init() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.04;
      musicGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function playTone(freq, duration, type = 'sine', volume = 0.15, decay = true) {
    if (!enabled || !ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    if (decay) gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function playNoise(duration, volume = 0.1) {
    if (!enabled || !ctx) return;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }

  function startMusic() {
    if (!enabled || !ctx || musicTimer) return;
    const tick = () => {
      if (!enabled || !ctx) return;
      const freq = MELODY[musicStep % MELODY.length];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
      musicStep++;
    };
    tick();
    musicTimer = setInterval(tick, 420);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  return {
    init,
    isEnabled() { return enabled; },
    setEnabled(v) {
      enabled = v;
      if (enabled) {
        init();
        startMusic();
      } else {
        stopMusic();
      }
    },
    toggle() {
      this.setEnabled(!enabled);
      return enabled;
    },

    pop() {
      playTone(520, 0.08, 'sine', 0.12);
      setTimeout(() => playTone(780, 0.06, 'sine', 0.08), 30);
    },

    match(count) {
      const base = 300 + count * 40;
      for (let i = 0; i < Math.min(count, 6); i++) {
        setTimeout(() => playTone(base + i * 60, 0.07, 'triangle', 0.1), i * 25);
      }
    },

    powerUp() {
      playTone(440, 0.1, 'square', 0.1);
      setTimeout(() => playTone(660, 0.1, 'square', 0.1), 60);
      setTimeout(() => playTone(880, 0.15, 'square', 0.12), 120);
    },

    explode(type = 'bomb') {
      const big = type === 'tnt' || type === 'bomb';
      playNoise(big ? 0.35 : 0.15, big ? 0.2 : 0.1);
      playTone(big ? 80 : 120, big ? 0.4 : 0.2, 'sawtooth', big ? 0.18 : 0.12);
      if (big) {
        setTimeout(() => playTone(60, 0.3, 'sawtooth', 0.1), 80);
        setTimeout(() => playNoise(0.15, 0.08), 150);
      }
    },

    fall() {
      playTone(200, 0.04, 'sine', 0.04);
    },

    win() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sine', 0.15), i * 120));
    },

    lose() {
      playTone(392, 0.3, 'sine', 0.12);
      setTimeout(() => playTone(330, 0.4, 'sine', 0.12), 180);
    },

    invalid() {
      playTone(180, 0.12, 'sawtooth', 0.08);
    },

    combo(level) {
      playTone(400 + level * 80, 0.12, 'triangle', 0.14);
    },

    coin() {
      playTone(880, 0.08, 'sine', 0.12);
      setTimeout(() => playTone(1175, 0.1, 'sine', 0.1), 60);
    },

    purchase() {
      playTone(660, 0.1, 'square', 0.12);
      setTimeout(() => playTone(990, 0.12, 'square', 0.1), 80);
      setTimeout(() => playTone(1320, 0.1, 'sine', 0.08), 160);
    },

    click() {
      playTone(600, 0.05, 'sine', 0.06);
    }
  };
})();