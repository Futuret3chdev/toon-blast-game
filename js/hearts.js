const HeartsManager = (() => {
  const MAX = 5;
  const REGEN_MS = 30 * 60 * 1000;
  const REFILL_COST = 100;
  const REQUEST_CD_MS = 3 * 60 * 60 * 1000;

  const DEFAULT = {
    current: MAX,
    max: MAX,
    lastTick: Date.now(),
    lastRequestAt: 0,
    sentTo: {}
  };

  function ensure(progress) {
    if (!progress.hearts) progress.hearts = { ...DEFAULT };
    progress.hearts = { ...DEFAULT, ...progress.hearts };
    return progress.hearts;
  }

  function regen(hearts) {
    const elapsed = Date.now() - (hearts.lastTick || Date.now());
    const gained = Math.floor(elapsed / REGEN_MS);
    if (gained > 0) {
      hearts.current = Math.min(hearts.max, hearts.current + gained);
      hearts.lastTick = Date.now() - (elapsed % REGEN_MS);
    }
    return hearts;
  }

  function timeToNext(hearts) {
    if (hearts.current >= hearts.max) return 0;
    const elapsed = Date.now() - (hearts.lastTick || Date.now());
    return Math.max(0, REGEN_MS - elapsed);
  }

  function formatWait(ms) {
    const m = Math.ceil(ms / 60000);
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm ? `${h}h ${rm}m` : `${h}h`;
  }

  function canPlay(progress) {
    const h = regen(ensure(progress));
    return h.current > 0;
  }

  function spend(progress) {
    const h = regen(ensure(progress));
    if (h.current <= 0) return false;
    const wasFull = h.current >= h.max;
    h.current--;
    if (wasFull) h.lastTick = Date.now();
    return true;
  }

  function refill(progress) {
    const h = regen(ensure(progress));
    if (h.current >= h.max) return { ok: false, error: 'Hearts full' };
    if ((progress.coins || 0) < REFILL_COST) return { ok: false, error: 'Need 100 coins' };
    progress.coins -= REFILL_COST;
    h.current = h.max;
    h.lastTick = Date.now();
    return { ok: true };
  }

  function add(progress, n = 1) {
    const h = regen(ensure(progress));
    h.current = Math.min(h.max, h.current + n);
    return h.current;
  }

  function canRequest(hearts) {
    return Date.now() - (hearts.lastRequestAt || 0) >= REQUEST_CD_MS;
  }

  function markRequest(hearts) {
    hearts.lastRequestAt = Date.now();
  }

  function renderBar(container, progress) {
    if (!container) return;
    const h = regen(ensure(progress));
    container.innerHTML = '';
    for (let i = 0; i < h.max; i++) {
      const span = document.createElement('span');
      span.className = 'heart-icon' + (i < h.current ? ' filled' : '');
      span.textContent = '❤️';
      span.setAttribute('aria-hidden', 'true');
      container.appendChild(span);
    }
    const timer = container.parentElement?.querySelector('.hearts-timer');
    if (timer) {
      const wait = timeToNext(h);
      timer.textContent = h.current >= h.max ? 'Full' : `+1 in ${formatWait(wait)}`;
    }
  }

  return {
    MAX, REGEN_MS, REFILL_COST, REQUEST_CD_MS,
    ensure, regen, canPlay, spend, refill, add,
    canRequest, markRequest, timeToNext, formatWait, renderBar, DEFAULT
  };
})();