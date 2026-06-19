const AudioEngine = (() => {
  let ctx = null;
  let sfxEnabled = true;
  let musicEnabled = true;
  let musicGain = null;
  let bassGain = null;
  let musicTimer = null;
  let musicStep = 0;

  const MELODY = [523, 587, 659, 784, 659, 587, 523, 494];
  const BASS = [131, 147, 165, 196, 165, 147, 131, 123];

  function init() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      musicGain = ctx.createGain();
      bassGain = ctx.createGain();
      musicGain.gain.value = 0.06;
      bassGain.gain.value = 0.05;
      musicGain.connect(ctx.destination);
      bassGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function playTone(freq, duration, type = 'sine', volume = 0.15, dest = null) {
    if (!ctx) return;
    const target = dest || ctx.destination;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(target);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function playNoise(duration, volume = 0.1) {
    if (!sfxEnabled || !ctx) return;
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
    if (!musicEnabled || !ctx || musicTimer) return;
    const tick = () => {
      if (!musicEnabled || !ctx) return;
      const i = musicStep % MELODY.length;
      playTone(MELODY[i], 0.4, 'triangle', 0.1, musicGain);
      playTone(MELODY[i] / 2, 0.5, 'sine', 0.04, musicGain);
      playTone(BASS[i], 0.55, 'sawtooth', 0.07, bassGain);
      musicStep++;
    };
    tick();
    musicTimer = setInterval(tick, 480);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem('mtepop_audio') || '{}');
      sfxEnabled = p.sfx !== false;
      musicEnabled = p.music !== false;
    } catch { /* defaults */ }
  }

  function savePrefs() {
    localStorage.setItem('mtepop_audio', JSON.stringify({ sfx: sfxEnabled, music: musicEnabled }));
  }

  loadPrefs();

  return {
    init,
    isEnabled() { return sfxEnabled; },
    isMusicEnabled() { return musicEnabled; },

    setEnabled(v) {
      sfxEnabled = v;
      savePrefs();
    },

    setMusicEnabled(v) {
      musicEnabled = v;
      savePrefs();
      if (musicEnabled) { init(); startMusic(); }
      else stopMusic();
    },

    toggle() {
      sfxEnabled = !sfxEnabled;
      musicEnabled = sfxEnabled;
      savePrefs();
      if (musicEnabled) { init(); startMusic(); }
      else stopMusic();
      return sfxEnabled;
    },

    toggleMusic() {
      this.setMusicEnabled(!musicEnabled);
      return musicEnabled;
    },

    startMusic() { init(); startMusic(); },
    stopMusic,

    pop() {
      if (!sfxEnabled || !ctx) return;
      playTone(520, 0.08, 'sine', 0.12);
      setTimeout(() => playTone(780, 0.06, 'sine', 0.08), 30);
    },

    match(count) {
      if (!sfxEnabled || !ctx) return;
      const base = 300 + count * 40;
      for (let i = 0; i < Math.min(count, 6); i++) {
        setTimeout(() => playTone(base + i * 60, 0.07, 'triangle', 0.1), i * 25);
      }
    },

    powerUp() {
      if (!sfxEnabled || !ctx) return;
      playTone(440, 0.1, 'square', 0.1);
      setTimeout(() => playTone(660, 0.1, 'square', 0.1), 60);
      setTimeout(() => playTone(880, 0.15, 'square', 0.12), 120);
    },

    explode(type = 'bomb') {
      if (!sfxEnabled || !ctx) return;
      const big = type === 'tnt' || type === 'bomb';
      playNoise(big ? 0.35 : 0.15, big ? 0.2 : 0.1);
      playTone(big ? 80 : 120, big ? 0.4 : 0.2, 'sawtooth', big ? 0.18 : 0.12);
    },

    fall() {
      if (!sfxEnabled || !ctx) return;
      playTone(200, 0.04, 'sine', 0.04);
    },

    win() {
      if (!sfxEnabled || !ctx) return;
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => playTone(f, 0.2, 'sine', 0.15), i * 120));
    },

    lose() {
      if (!sfxEnabled || !ctx) return;
      playTone(392, 0.3, 'sine', 0.12);
      setTimeout(() => playTone(330, 0.4, 'sine', 0.12), 180);
    },

    invalid() {
      if (!sfxEnabled || !ctx) return;
      playTone(180, 0.12, 'sawtooth', 0.08);
    },

    combo(level) {
      if (!sfxEnabled || !ctx) return;
      playTone(400 + level * 80, 0.12, 'triangle', 0.14);
    },

    coin() {
      if (!sfxEnabled || !ctx) return;
      playTone(880, 0.08, 'sine', 0.12);
      setTimeout(() => playTone(1175, 0.1, 'sine', 0.1), 60);
    },

    purchase() {
      if (!sfxEnabled || !ctx) return;
      playTone(660, 0.1, 'square', 0.12);
      setTimeout(() => playTone(990, 0.12, 'square', 0.1), 80);
    },

    click() {
      if (!sfxEnabled || !ctx) return;
      playTone(600, 0.05, 'sine', 0.06);
    }
  };
})();