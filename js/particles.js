const ParticleSystem = (() => {
  let canvas, ctx;
  let particles = [];
  let shockwaves = [];
  let animating = false;

  function init(canvasEl) {
    if (!canvasEl) return;
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas?.parentElement) return;
    const wrapper = canvas.parentElement;
    const rect = wrapper.getBoundingClientRect();
    canvas.width = rect.width * devicePixelRatio;
    canvas.height = rect.height * devicePixelRatio;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }

  function burst(x, y, color, count = 12) {
    if (!ctx) return;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 2 + Math.random() * 5;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        life: 1,
        decay: 0.025 + Math.random() * 0.02,
        size: 4 + Math.random() * 7,
        color,
        gravity: 0.12
      });
    }
    startLoop();
  }

  function shockwave(x, y, color = '#ffeaa7', maxRadius = 120) {
    if (!ctx) return;
    shockwaves.push({ x, y, radius: 8, maxRadius, life: 1, color });
    startLoop();
  }

  function rocketTrail(x, y, horizontal) {
    if (!ctx) return;
    const count = 16;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + (horizontal ? (Math.random() - 0.5) * 20 : 0),
        y: y + (horizontal ? 0 : (Math.random() - 0.5) * 20),
        vx: horizontal ? (Math.random() > 0.5 ? 8 : -8) : 0,
        vy: horizontal ? 0 : (Math.random() > 0.5 ? 8 : -8),
        life: 1,
        decay: 0.04,
        size: 6 + Math.random() * 8,
        color: `hsl(${35 + Math.random() * 20}, 100%, 65%)`,
        gravity: 0
      });
    }
    startLoop();
  }

  function discoBurst(x, y) {
    if (!ctx) return;
    for (let i = 0; i < 24; i++) {
      const hue = Math.random() * 360;
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1,
        decay: 0.02,
        size: 5 + Math.random() * 6,
        color: `hsl(${hue}, 90%, 65%)`,
        gravity: 0.05,
        star: true
      });
    }
    startLoop();
  }

  function startLoop() {
    if (!animating) {
      animating = true;
      requestAnimationFrame(tick);
    }
  }

  function tick() {
    if (!ctx || !canvas) {
      animating = false;
      return;
    }
    const w = canvas.width / devicePixelRatio;
    const h = canvas.height / devicePixelRatio;
    ctx.clearRect(0, 0, w, h);

    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const s = shockwaves[i];
      s.radius += 6;
      s.life -= 0.04;
      if (s.life <= 0 || s.radius > s.maxRadius) {
        shockwaves.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = s.life * 0.6;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 4 * s.life;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.life -= p.decay;
      p.vx *= 0.97;

      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      if (p.star) drawStar(p.x, p.y, p.size);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    if (particles.length > 0 || shockwaves.length > 0) {
      requestAnimationFrame(tick);
    } else {
      animating = false;
    }
  }

  function drawStar(x, y, size) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const r = i % 2 === 0 ? size : size * 0.4;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function getBoardOffset(boardEl) {
    if (!canvas?.parentElement || !boardEl) return { left: 0, top: 0 };
    const wrapper = canvas.parentElement;
    const wRect = wrapper.getBoundingClientRect();
    const bRect = boardEl.getBoundingClientRect();
    return {
      left: bRect.left - wRect.left,
      top: bRect.top - wRect.top
    };
  }

  function burstAtCell(boardEl, row, col, rows, cols, color) {
    const offset = getBoardOffset(boardEl);
    const cellSize = parseFloat(getComputedStyle(boardEl).getPropertyValue('--cell-size')) || 42;
    const gap = 3;
    const pad = 8;
    const x = offset.left + pad + col * (cellSize + gap) + cellSize / 2;
    const y = offset.top + pad + row * (cellSize + gap) + cellSize / 2;
    burst(x, y, color);
  }

  function shockwaveAtCell(boardEl, row, col, color, scale = 1) {
    const offset = getBoardOffset(boardEl);
    const cellSize = parseFloat(getComputedStyle(boardEl).getPropertyValue('--cell-size')) || 42;
    const gap = 3;
    const pad = 8;
    const x = offset.left + pad + col * (cellSize + gap) + cellSize / 2;
    const y = offset.top + pad + row * (cellSize + gap) + cellSize / 2;
    shockwave(x, y, color, cellSize * 5 * scale);
  }

  return {
    init, burst, shockwave, rocketTrail, discoBurst,
    burstAtCell, shockwaveAtCell, resize
  };
})();