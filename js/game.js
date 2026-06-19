const Game = (() => {
  const SHOP_ITEMS = [
    { id: 'bomb', label: 'Bomb', icon: '💣', desc: 'Blasts a 5×5 area!', price: 100, type: 'bomb' },
    { id: 'rocket', label: 'Rocket', icon: '🚀', desc: 'Clears a full row or column', price: 150, type: 'rocket_h' },
    { id: 'disco', label: 'Disco Ball', icon: '🪩', desc: 'Destroys all blocks of one color', price: 200, type: 'disco' },
    { id: 'extra_moves', label: '+5 Moves', icon: '⚡', desc: 'Instantly add 5 extra moves', price: 250, type: 'extra_moves' }
  ];

  const STATION_THEMES = [
    { name: 'Sunny Meadow', color: '#55efc4' },
    { name: 'Rocky Hills', color: '#74b9ff' },
    { name: 'Golden Desert', color: '#fdcb6e' },
    { name: 'Pine Forest', color: '#00b894' },
    { name: 'Royal Castle', color: '#a29bfe' },
    { name: 'Ocean Cove', color: '#0984e3' },
    { name: 'Ice Kingdom', color: '#dfe6e9' },
    { name: 'Volcano Peak', color: '#d63031' },
    { name: 'Cloud City', color: '#fd79a8' },
    { name: 'Star Valley', color: '#ffeaa7' }
  ];

  function getStationData(index) {
    const theme = STATION_THEMES[index % STATION_THEMES.length];
    const zone = Math.floor(index / STATION_THEMES.length) + 1;
    return {
      name: zone > 1 ? `${theme.name} ${zone}` : theme.name,
      color: theme.color
    };
  }

  let board = null;
  let currentLevel = 1;
  let placementMode = null;
  let progress = null;
  let uiReady = false;
  const $ = id => document.getElementById(id);

  const SCREEN_IDS = {
    menu: 'menu-screen',
    level: 'level-screen',
    game: 'game-screen',
    shop: 'shop-screen',
    settings: 'settings-screen'
  };

  function ensureProgress() {
    if (!progress) {
      try {
        progress = AuthManager.loadProgress();
      } catch {
        progress = { ...AuthManager.DEFAULT_PROGRESS };
      }
    }
    return progress;
  }

  const boardEl = $('board');
  const particlesCanvas = $('particles');

  function reloadProgress() {
    progress = AuthManager.loadProgress();
    updateMenuStats();
    updateAuthUI();
  }

  function saveProgress() {
    AuthManager.saveProgress(progress);
  }

  function showToast(msg) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 2800);
  }

  function updateAuthUI() {
    const loggedIn = AuthManager.isLoggedIn();
    const user = AuthManager.getUser();
    const prof = AuthManager.getProfile();

    $('logout-btn')?.classList.toggle('hidden', !loggedIn);
    $('menu-telegram-btn')?.classList.toggle('hidden', loggedIn);
    $('login-telegram')?.classList.remove('hidden');

    const providerLabels = {
      google: 'Google',
      facebook: 'Facebook',
      x: 'X',
      discord: 'Discord',
      telegram: 'Telegram'
    };
    const avatarColor = AuthManager.avatarColor(prof.avatar);
    if ($('profile-name')) $('profile-name').textContent = prof.name;
    if ($('profile-avatar')) {
      $('profile-avatar').textContent = prof.avatar;
      $('profile-avatar').style.background = avatarColor;
    }

    if ($('profile-frame')) $('profile-frame').style.setProperty('--frame-color', prof.frame);
    if ($('profile-provider')) {
      $('profile-provider').textContent = loggedIn
        ? `Signed in via ${providerLabels[user?.provider] || user?.provider}`
        : 'Playing locally — sign in to sync across devices';
    }
    if ($('profile-name-input')) $('profile-name-input').value = prof.name;
  }

  function renderProfilePickers() {
    const avatars = $('avatar-picker');
    const frames = $('frame-picker');
    if (!avatars || !frames) return;
    avatars.innerHTML = '';
    frames.innerHTML = '';
    const prof = AuthManager.getProfile();

    AuthManager.AVATARS.forEach(letter => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `avatar-opt${prof.avatar === letter ? ' active' : ''}`;
      btn.textContent = letter;
      btn.style.background = AuthManager.avatarColor(letter);
      btn.addEventListener('click', () => {
        avatars.querySelectorAll('.avatar-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const color = AuthManager.avatarColor(letter);
        $('profile-avatar').textContent = letter;
        $('profile-avatar').style.background = color;

      });
      avatars.appendChild(btn);
    });

    AuthManager.FRAMES.forEach(color => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `frame-opt${prof.frame === color ? ' active' : ''}`;
      btn.style.background = color;
      btn.addEventListener('click', () => {
        frames.querySelectorAll('.frame-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $('profile-frame').style.setProperty('--frame-color', color);
      });
      frames.appendChild(btn);
    });
  }

  function showScreen(name) {
    const targetId = SCREEN_IDS[name] || `${name}-screen`;
    document.querySelectorAll('#app > .screen').forEach(s => {
      s.classList.toggle('active', s.id === targetId);
    });
    if (name !== 'game') clearPlacementMode();

    try {
      if (name === 'shop') renderShop();
      if (name === 'level') buildLevelMap();
      if (name === 'settings') refreshSettings();
      ensureProgress();
      updateMenuStats();
    } catch (err) {
      console.error(`Screen "${name}" render failed:`, err);
    }
  }

  function refreshSettings() {
    renderProfilePickers();
    updateAuthUI();
    updateInviteSection();
    AuthManager.renderGoogleButton($('google-btn-container'));
    AuthManager.renderTelegramWidget($('telegram-login-container'));
  }

  async function handleAuthResult(result, providerLabel) {
    if (result?.pending) return;
    if (result?.needsHandle) {
      $('x-username-input').value = '';
      $('x-login-modal')?.classList.remove('hidden');
      return;
    }
    if (result?.error === 'Cancelled') return;
    if (result?.ok) {
      reloadProgress();
      updateAuthUI();
      showToast(`Signed in with ${providerLabel}`);
      showScreen('menu');
      return;
    }
    if (result?.error) showToast(result.error);
  }

  function openLevelMap() {
    AudioEngine.init();
    AudioEngine.click();
    showScreen('level');
  }

  function openShop() {
    AudioEngine.init();
    AudioEngine.click();
    showScreen('shop');
  }

  function getInviteUrl() {
    const origin = window.location.origin;
    const isUsableOrigin = origin && origin !== 'null' && !origin.startsWith('file');
    if (isUsableOrigin) {
      return origin + (window.location.pathname || '/');
    }
    return MTEPOP_CONFIG.appUrl || 'https://mte-pop.vercel.app';
  }

  function updateInviteSection() {
    const url = getInviteUrl();
    const link = $('invite-link');
    if (link) {
      link.href = url;
      link.textContent = url;
    }
    const shareBtn = $('invite-share-btn');
    if (shareBtn) shareBtn.style.display = navigator.share ? '' : 'none';
  }

  function openSettings(scrollToInvite = false) {
    AudioEngine.init();
    AudioEngine.click();
    showScreen('settings');
    if (scrollToInvite) {
      requestAnimationFrame(() => {
        $('invite-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  function calcStars(movesLeft) {
    if (movesLeft >= 5) return 3;
    if (movesLeft >= 2) return 2;
    return 1;
  }

  function updateMenuStats() {
    if (!progress) return;
    const playLevel = AuthManager.getPlayLevel(progress);
    if ($('menu-level')) $('menu-level').textContent = playLevel;
    if ($('max-level')) $('max-level').textContent = progress.maxLevel;
    if ($('total-stars')) $('total-stars').textContent = progress.totalStars;
    if ($('menu-coins')) $('menu-coins').textContent = progress.coins;
    if ($('shop-coins')) $('shop-coins').textContent = progress.coins;
    updateInventoryHUD();
  }

  function updateInventoryHUD() {
    const inv = progress.inventory || {};
    if ($('inv-bomb-count')) $('inv-bomb-count').textContent = inv.bomb || 0;
    if ($('inv-rocket-count')) $('inv-rocket-count').textContent = inv.rocket_h || 0;
    if ($('inv-disco-count')) $('inv-disco-count').textContent = inv.disco || 0;
    if ($('inv-moves-count')) $('inv-moves-count').textContent = inv.extra_moves || 0;

    $('inv-bomb')?.classList.toggle('disabled', !(inv.bomb > 0));
    $('inv-rocket')?.classList.toggle('disabled', !(inv.rocket_h > 0));
    $('inv-disco')?.classList.toggle('disabled', !(inv.disco > 0));
    $('inv-moves')?.classList.toggle('disabled', !(inv.extra_moves > 0));
  }

  function renderShop() {
    const list = $('shop-items');
    if (!list) return;
    const data = ensureProgress();
    list.innerHTML = '';

    SHOP_ITEMS.forEach(item => {
      const invKey = item.type === 'rocket_h' ? 'rocket_h' : item.id === 'extra_moves' ? 'extra_moves' : item.type;
      const owned = (data.inventory && data.inventory[invKey]) || 0;
      const canAfford = data.coins >= item.price;

      const el = document.createElement('article');
      el.className = 'shop-item';
      el.innerHTML = `
        <div class="shop-item-icon" aria-hidden="true">${item.icon}</div>
        <div class="shop-item-body">
          <div class="shop-item-head">
            <span class="shop-item-name">${item.label}</span>
            <span class="shop-item-owned">In bag: ${owned}</span>
          </div>
          <p class="shop-item-desc">${item.desc}</p>
        </div>
        <button class="shop-buy-btn ${canAfford ? '' : 'disabled'}" type="button">
          <span class="coin-badge coin-badge-sm" aria-hidden="true"></span>
          <span>${item.price}</span>
        </button>
      `;
      const btn = el.querySelector('.shop-buy-btn');
      btn.addEventListener('click', () => {
        if (canAfford) buyItem(item);
        else AudioEngine.invalid();
      });
      list.appendChild(el);
    });
  }

  function buyItem(item) {
    if (progress.coins < item.price) return;
    const invKey = item.type === 'rocket_h' ? 'rocket_h' : item.id === 'extra_moves' ? 'extra_moves' : item.type;
    progress.coins -= item.price;
    if (!progress.inventory) progress.inventory = {};
    progress.inventory[invKey] = (progress.inventory[invKey] || 0) + 1;
    saveProgress();
    AudioEngine.purchase();
    renderShop();
    updateMenuStats();
  }

  function clearPlacementMode() {
    placementMode = null;
    boardEl?.classList.remove('placement-mode');
    document.querySelectorAll('.inv-btn.active').forEach(b => b.classList.remove('active'));
  }

  function startPlacement(type) {
    if (!board || board.busy) return;
    if (!(progress.inventory && progress.inventory[type] > 0)) return;

    if (type === 'extra_moves') {
      progress.inventory.extra_moves--;
      board.addMoves(5);
      saveProgress();
      updateInventoryHUD();
      return;
    }

    placementMode = type;
    boardEl.classList.add('placement-mode');
    document.querySelectorAll('.inv-btn').forEach(b => b.classList.remove('active'));
    $(`inv-${type === 'rocket_h' ? 'rocket' : type}`)?.classList.add('active');
    AudioEngine.click();
  }

  function buildLevelMap() {
    const map = $('level-map') || $('level-grid');
    const prog = ensureProgress();
    if (!map) return;
    if (typeof LEVELS === 'undefined' || !LEVELS.length) {
      map.innerHTML = '<p class="map-error">Levels could not load. Refresh the page.</p>';
      return;
    }

    try {
    map.innerHTML = '<div class="map-sky"></div><div class="map-ground"></div>';

    const track = document.createElement('div');
    track.className = 'map-track';

    LEVELS.forEach((_, i) => {
      const num = i + 1;
      const stationData = getStationData(i);
      const side = i % 2 === 0 ? 'left' : 'right';
      const loggedIn = AuthManager.isLoggedIn();
      const stars = prog.stars[num] || 0;
      const unlocked = loggedIn
        ? (num <= prog.maxLevel || stars > 0)
        : num === 1;
      const isCurrent = loggedIn && num === prog.maxLevel;
      const isReplay = loggedIn && num < prog.maxLevel;

      if (i > 0) {
        const rail = document.createElement('div');
        rail.className = `map-rail ${side} ${unlocked ? 'active' : 'locked'}`;
        rail.innerHTML = '<div class="rail-ties"></div><div class="rail-line"></div>';
        track.appendChild(rail);
      }

      const stationEl = document.createElement('div');
      stationEl.className = `map-station ${side} ${unlocked ? 'unlocked' : 'locked'} ${isCurrent ? 'current' : ''} ${stars > 0 ? 'completed' : ''} ${isReplay ? 'replay' : ''}`;
      stationEl.dataset.level = num;
      stationEl.innerHTML = `
        <div class="station-scenery" style="--station-color:${stationData.color}">
          <span class="scenery-dot"></span>
          <span class="scenery-name">${stationData.name}</span>
        </div>
        <button class="station-btn" type="button" ${unlocked ? '' : 'disabled'} aria-label="Level ${num}${isReplay ? ' replay' : ''}">
          <span class="station-num">${num}</span>
          <span class="station-stars">${renderStarRow(stars)}</span>
          ${isReplay ? '<span class="station-replay">Replay</span>' : ''}
        </button>
        ${isCurrent ? '<div class="station-train">YOU</div>' : ''}
        ${!loggedIn && num > 1 ? '<div class="station-lock-hint">Sign in</div>' : ''}
      `;

      if (unlocked) {
        const play = () => {
          AudioEngine.click();
          startLevel(num);
        };
        stationEl.querySelector('.station-btn').addEventListener('click', play);
        if (isReplay) stationEl.addEventListener('click', (e) => {
          if (!e.target.closest('.station-btn')) play();
        });
      }
      track.appendChild(stationEl);
    });

    map.appendChild(track);

    requestAnimationFrame(() => {
      const current = map.querySelector('.map-station.current');
      if (current) current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    } catch (err) {
      console.error('Map build failed:', err);
      map.innerHTML = '<p class="map-error">Could not load map. Tap back and try again.</p>';
    }
  }

  function renderStarRow(filled, total = 3) {
    return '★'.repeat(Math.min(filled, total)) + '☆'.repeat(Math.max(0, total - filled));
  }

  function calcCellSize(width, height) {
    const wrapper = boardEl.parentElement;
    if (!wrapper) return 42;
    const maxW = wrapper.clientWidth - 12;
    const maxH = wrapper.clientHeight - 12;
    const gap = 3, pad = 16;
    const sizeW = (maxW - pad - gap * (width - 1)) / width;
    const sizeH = (maxH - pad - gap * (height - 1)) / height;
    const isMobile = window.innerWidth < 520 || 'ontouchstart' in window;
    const maxCell = isMobile ? 44 : 58;
    return Math.max(26, Math.min(sizeW, sizeH, maxCell));
  }

  function applyBoardSizing() {
    if (!board || !boardEl) return;
    const cellSize = calcCellSize(board.width, board.height);
    boardEl.style.setProperty('--cell-size', cellSize + 'px');
    boardEl.style.gridTemplateColumns = `repeat(${board.width}, ${cellSize}px)`;
    boardEl.style.gridTemplateRows = `repeat(${board.height}, ${cellSize}px)`;
  }

  function resizeBoard() {
    if (!board || !$('game-screen')?.classList.contains('active')) return;
    applyBoardSizing();
    ParticleSystem.resize();
  }

  function bindCellInput(cell, row, col) {
    let tapStart = null;

    cell.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      tapStart = { x: e.clientX, y: e.clientY, id: e.pointerId };
      cell.setPointerCapture(e.pointerId);
    }, { passive: true });

    cell.addEventListener('pointerup', (e) => {
      if (!tapStart || e.pointerId !== tapStart.id) return;
      const dx = Math.abs(e.clientX - tapStart.x);
      const dy = Math.abs(e.clientY - tapStart.y);
      tapStart = null;
      if (dx <= 14 && dy <= 14) {
        e.preventDefault();
        onCellTap(row, col);
      }
      try { cell.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
    });

    cell.addEventListener('pointercancel', () => { tapStart = null; });
    cell.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  function renderBoard() {
    if (!boardEl || !board) return;
    boardEl.innerHTML = '';
    applyBoardSizing();

    for (let row = 0; row < board.height; row++) {
      for (let col = 0; col < board.width; col++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = row;
        cell.dataset.col = col;

        const block = board.getBlock(row, col);
        if (block) {
          cell.appendChild(createBlockEl(block, row, col));
        } else {
          cell.classList.add('empty');
        }

        bindCellInput(cell, row, col);
        boardEl.appendChild(cell);
      }
    }
    ParticleSystem.resize();
  }

  function refreshBoardDOM() {
    boardEl.querySelectorAll('.block').forEach(el => el.remove());
    boardEl.querySelectorAll('.cell').forEach(cell => cell.classList.add('empty'));

    for (let row = 0; row < board.height; row++) {
      for (let col = 0; col < board.width; col++) {
        const block = board.getBlock(row, col);
        const cell = getCellEl(row, col);
        if (!block || !cell) continue;
        cell.classList.remove('empty');
        const el = createBlockEl(block, row, col);
        el.classList.add('drop-in');
        cell.appendChild(el);
      }
    }
  }

  const CUBE_STYLES = {
    red:    { bg: 'linear-gradient(160deg, #ffb3be 0%, #ff4757 40%, #c0392b 100%)' },
    green:  { bg: 'linear-gradient(160deg, #a8f5c8 0%, #2ed573 40%, #1e8449 100%)' },
    blue:   { bg: 'linear-gradient(160deg, #8fa4ff 0%, #3742fa 40%, #1e3799 100%)' },
    yellow: { bg: 'linear-gradient(160deg, #ffe066 0%, #ffa502 40%, #e67e22 100%)' },
    purple: { bg: 'linear-gradient(160deg, #d4b5ff 0%, #a55eea 40%, #6c3483 100%)' }
  };

  function createBlockEl(block, row, col) {
    const el = document.createElement('div');
    el.className = `block ${block.type}`;
    el.dataset.id = block.id;
    el.dataset.row = row;
    el.dataset.col = col;

    const cube = CUBE_STYLES[block.type];
    if (cube) {
      el.style.background = cube.bg;
      const shine = document.createElement('span');
      shine.className = 'block-shine';
      el.appendChild(shine);
    }
    return el;
  }

  function getCellEl(row, col) {
    return boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  }

  function getBlockEl(row, col) {
    return getCellEl(row, col)?.querySelector('.block');
  }

  function getCellCenter(row, col) {
    const wrapper = boardEl.parentElement;
    const wRect = wrapper.getBoundingClientRect();
    const cell = getCellEl(row, col);
    const cRect = cell.getBoundingClientRect();
    return {
      x: cRect.left - wRect.left + cRect.width / 2,
      y: cRect.top - wRect.top + cRect.height / 2
    };
  }

  function renderGoals() {
    const panel = $('goals-panel');
    if (!panel || !board) return;
    panel.innerHTML = '';

    const goalLabels = { box: 'Boxes', stone: 'Stones', vase: 'Vases' };
    const goalLetters = { box: 'B', stone: 'S', vase: 'V' };

    Object.entries(board.goals).forEach(([type, count]) => {
      const item = document.createElement('div');
      item.className = 'goal-item';
      item.dataset.goal = type;
      item.innerHTML = `
        <div class="goal-icon" style="background:${BLOCK_META[type]?.color || '#666'}">${goalLetters[type] || '?'}</div>
        <span>${goalLabels[type] || type}</span>
        <span class="goal-count">${board.goalProgress[type]}</span>
      `;
      panel.appendChild(item);
    });

    if (Object.keys(board.goals).length === 0) {
      panel.innerHTML = '<div class="goal-item">Clear all blocks!</div>';
    }
  }

  function updateHUD() {
    $('hud-level').textContent = board.levelNumber;
    const movesEl = $('moves-count');
    movesEl.textContent = board.moves;
    movesEl.classList.toggle('low', board.moves <= 3);
    $('score-value').textContent = board.score;
    updateInventoryHUD();
  }

  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  const callbacks = {
    getCellCenter,

    onMatchPop(cells) {
      cells.forEach(({ row, col }) => {
        const el = getBlockEl(row, col);
        if (el) el.classList.add('popping');
      });
    },

    async onPowerUpExplosion(originRow, originCol, cells, type) {
      boardEl.parentElement?.classList.add('screen-shake');
      setTimeout(() => boardEl.parentElement?.classList.remove('screen-shake'), 450);

      ParticleSystem.shockwaveAtCell(boardEl, originRow, originCol, '#ffeaa7', type === 'tnt' ? 2.2 : 1.6);

      const originEl = getBlockEl(originRow, originCol);
      originEl?.classList.add('power-charge');

      if (type === 'rocket_h' || type === 'rocket_v') {
        const isH = type === 'rocket_h';
        const sorted = [...cells].sort((a, b) => isH ? a.col - b.col : a.row - b.row);
        for (const { row, col } of sorted) {
          const cell = getCellEl(row, col);
          cell?.classList.add('rocket-blast');
          getBlockEl(row, col)?.classList.add('exploding');
          const c = getCellCenter(row, col);
          ParticleSystem.rocketTrail(c.x, c.y, isH);
          await delay(18);
        }
        await delay(60);
      } else if (type === 'bomb' || type === 'tnt') {
        const sorted = [...cells].sort((a, b) => {
          const da = Math.abs(a.row - originRow) + Math.abs(a.col - originCol);
          const db = Math.abs(b.row - originRow) + Math.abs(b.col - originCol);
          return da - db;
        });
        for (const { row, col } of sorted) {
          const dist = Math.abs(row - originRow) + Math.abs(col - originCol);
          await delay(dist * 22);
          const cell = getCellEl(row, col);
          cell?.classList.add('blast-flash');
          getBlockEl(row, col)?.classList.add('exploding');
          const c = getCellCenter(row, col);
          ParticleSystem.burst(c.x, c.y, '#ff7675', 10);
        }
        await delay(80);
      } else if (type === 'disco') {
        for (let i = 0; i < cells.length; i++) {
          const { row, col } = cells[i];
          const cell = getCellEl(row, col);
          cell?.classList.add('disco-flash');
          getBlockEl(row, col)?.classList.add('exploding');
          const c = getCellCenter(row, col);
          ParticleSystem.discoBurst(c.x, c.y);
          await delay(16);
        }
        await delay(100);
      }

      originEl?.classList.remove('power-charge');
      document.querySelectorAll('.rocket-blast, .blast-flash, .disco-flash, .exploding').forEach(el => {
        el.classList.remove('rocket-blast', 'blast-flash', 'disco-flash', 'exploding');
      });
    },

    onBlockDestroy(row, col, block, fast = false) {
      return new Promise(resolve => {
        const el = getBlockEl(row, col);
        if (!el) { resolve(); return; }
        const color = BLOCK_META[block.type]?.color || '#fff';
        ParticleSystem.burstAtCell(boardEl, row, col, board.height, board.width, color);
        el.classList.add('popping');
        AudioEngine.pop();
        const ms = fast ? 35 : 120;
        setTimeout(() => {
          el.remove();
          getCellEl(row, col)?.classList.add('empty');
          resolve();
        }, ms);
      });
    },

    onBlockUpdated(row, col, block) {
      const cell = getCellEl(row, col);
      if (!cell) return;
      const old = getBlockEl(row, col);
      const el = createBlockEl(block, row, col);
      el.classList.add('power-spawn');
      if (old) cell.replaceChild(el, old);
      else cell.appendChild(el);
    },

    onBlockCreated(row, col, block) {
      const cell = getCellEl(row, col);
      cell?.classList.remove('empty');
      const el = createBlockEl(block, row, col);
      el.classList.add('power-spawn');
      cell?.appendChild(el);
    },

    async onBatchSettle(falls, spawns) {
      if (!falls.length && !spawns.length) return;
      refreshBoardDOM();
      await delay(60);
      document.querySelectorAll('.block.drop-in').forEach(el => el.classList.remove('drop-in'));
    },

    onBlockFall() { return Promise.resolve(); },
    onBlockSpawn() { return Promise.resolve(); },

    onMovesChanged(moves) {
      $('moves-count').textContent = moves;
      $('moves-count').classList.toggle('low', moves <= 3);
    },

    onGoalUpdate(type, remaining) {
      const item = document.querySelector(`.goal-item[data-goal="${type}"]`);
      if (item) {
        item.querySelector('.goal-count').textContent = remaining;
        if (remaining <= 0) item.classList.add('done');
      }
    },

    onInvalidTap(row, col) {
      getBlockEl(row, col)?.classList.add('shake');
      setTimeout(() => getBlockEl(row, col)?.classList.remove('shake'), 400);
      AudioEngine.invalid();
    },

    onCombo(level) {
      const display = $('combo-display');
      $('combo-text').textContent = `COMBO x${level}!`;
      display.classList.remove('hidden');
      setTimeout(() => display.classList.add('hidden'), 800);
    },

    onHint(cells) {
      cells.forEach(({ row, col }) => getBlockEl(row, col)?.classList.add('hint'));
    },

    onHintClear(cells) {
      cells.forEach(({ row, col }) => getBlockEl(row, col)?.classList.remove('hint'));
    },

    onStateChange() {
      $('score-value').textContent = board.score;
    },

    onWin(score, movesLeft) {
      AudioEngine.win();
      const stars = calcStars(movesLeft);
      const prev = progress.stars[board.levelNumber] || 0;
      if (stars > prev) {
        progress.totalStars += stars - prev;
        progress.stars[board.levelNumber] = stars;
      }
      const loggedIn = AuthManager.isLoggedIn();
      if (loggedIn && board.levelNumber >= progress.maxLevel && board.levelNumber < LEVELS.length) {
        progress.maxLevel = board.levelNumber + 1;
      }
      const coinReward = loggedIn ? (50 + stars * 25 + movesLeft * 5) : 0;
      if (loggedIn) {
        progress.coins += coinReward;
        saveProgress();
      }
      $('win-coins').textContent = loggedIn
        ? `+${coinReward} coins`
        : 'Sign in to save progress & unlock levels!';
      updateMenuStats();

      $('win-score').textContent = score;
      $('win-stars').textContent = renderStarRow(stars);
      updateAuthUI();
      $('win-modal').classList.remove('hidden');
    },

    onLose() {
      AudioEngine.lose();
      $('lose-modal').classList.remove('hidden');
    }
  };

  async function onCellTap(row, col) {
    AudioEngine.init();

    if (placementMode && board && !board.busy) {
      const block = board.getBlock(row, col);
      if (block && BLOCK_META[block.type]?.matchColor) {
        const color = BLOCK_META[block.type].matchColor;
        const type = placementMode;
        if (await board.placeAndActivate(row, col, type, type === 'disco' ? color : null)) {
          progress.inventory[type]--;
          saveProgress();
          updateInventoryHUD();
          clearPlacementMode();
        }
      } else {
        AudioEngine.invalid();
      }
      return;
    }

    await board.handleTap(row, col);
  }

  function startLevel(num) {
    currentLevel = num;
    const levelInfo = LEVELS[num - 1];
    if (!levelInfo) return;

    board = new GameBoard(levelInfo, callbacks);
    $('win-modal').classList.add('hidden');
    $('lose-modal').classList.add('hidden');
    $('combo-display').classList.add('hidden');
    clearPlacementMode();

    showScreen('game');
    renderBoard();
    renderGoals();
    updateHUD();
    board.resetHintTimer();
  }

  function updateMuteButton() {
    const btn = $('mute-btn');
    if (btn) {
      btn.dataset.on = AudioEngine.isEnabled() ? 'true' : 'false';
      btn.setAttribute('aria-pressed', AudioEngine.isEnabled() ? 'false' : 'true');
    }
    const musicBtn = $('music-btn');
    if (musicBtn) {
      musicBtn.dataset.on = AudioEngine.isMusicEnabled() ? 'true' : 'false';
      musicBtn.setAttribute('aria-pressed', AudioEngine.isMusicEnabled() ? 'false' : 'true');
    }
  }

  function onAppClick(e) {
    const btn = e.target.closest('button');
    if (!btn || !uiReady) return;

    switch (btn.id) {
      case 'level-select-btn':
        e.preventDefault();
        openLevelMap();
        break;
      case 'shop-btn':
        e.preventDefault();
        openShop();
        break;
      case 'settings-btn':
      case 'profile-btn':
        e.preventDefault();
        openSettings();
        break;
      case 'invite-win-btn':
        e.preventDefault();
        $('win-modal')?.classList.add('hidden');
        openSettings(true);
        break;
      default:
        break;
    }
  }

  function bindUI() {
    if (uiReady) return;
    uiReady = true;
    $('app')?.addEventListener('click', onAppClick, { passive: false });

    document.addEventListener('mtepop:authchange', () => {
      reloadProgress();
      renderProfilePickers();
      updateAuthUI();
      if ($('level-screen')?.classList.contains('active')) buildLevelMap();
    });

    $('play-btn')?.addEventListener('click', () => {
      AudioEngine.init();
      startLevel(AuthManager.getPlayLevel(progress));
    });

    $('shop-back')?.addEventListener('click', () => showScreen('menu'));
    $('level-back')?.addEventListener('click', () => showScreen('menu'));
    $('game-back')?.addEventListener('click', () => {
      board?.clearHint();
      showScreen('menu');
    });

    $('mute-btn')?.addEventListener('click', () => {
      AudioEngine.init();
      AudioEngine.setEnabled(!AudioEngine.isEnabled());
      updateMuteButton();
      AudioEngine.click();
    });

    $('music-btn')?.addEventListener('click', () => {
      AudioEngine.init();
      AudioEngine.toggleMusic();
      updateMuteButton();
      AudioEngine.click();
    });

    $('settings-back')?.addEventListener('click', () => showScreen('menu'));
    $('login-google')?.addEventListener('click', async () => {
      const result = await AuthManager.signInGoogle();
      await handleAuthResult(result, 'Google');
    });

    $('login-facebook')?.addEventListener('click', async () => {
      const result = await AuthManager.signInFacebook();
      await handleAuthResult(result, 'Facebook');
    });

    $('login-x')?.addEventListener('click', async () => {
      const result = await AuthManager.signInXOAuth();
      await handleAuthResult(result, 'X');
    });

    $('login-discord')?.addEventListener('click', async () => {
      const result = await AuthManager.signInDiscord();
      await handleAuthResult(result, 'Discord');
    });

    async function beginTelegramDeepLink() {
      const bot = MTEPOP_CONFIG.telegramBotUsername?.replace('@', '') || 'mod_futuret3ch_bot';
      const session = await AuthManager.startTelegramDeepLink();
      if (!session?.ok) {
        showToast(session?.error || 'Telegram sign-in unavailable');
        $('telegram-username-input').value = '';
        $('telegram-login-modal')?.classList.remove('hidden');
        return;
      }

      const linkEl = $('telegram-open-bot');
      if (linkEl) {
        linkEl.href = session.deepLink;
        linkEl.textContent = `Open @${bot}`;
      }
      $('telegram-auth-waiting')?.classList.remove('hidden');
      $('telegram-auth-status').innerHTML = `Open <strong>@${bot}</strong>, tap <strong>Start</strong>, then tap the <strong>Finish sign-in</strong> button the bot sends you.`;
      $('telegram-login-modal')?.classList.remove('hidden');
    }

    async function finishTelegramUrlAuth() {
      const params = new URLSearchParams(window.location.search);
      const token = params.get('tg_auth');
      if (!token) return;

      const result = await AuthManager.exchangeTelegramLoginToken(token);
      params.delete('tg_auth');
      const next = `${window.location.pathname || '/'}${params.toString() ? `?${params}` : ''}`;
      window.history.replaceState({}, '', next);

      if (result?.ok) {
        await handleAuthResult(result, 'Telegram');
      } else if (result?.error) {
        showToast(result.error);
      }
    }

    async function startTelegramSignIn() {
      const mode = MTEPOP_CONFIG.telegramAuthMode || 'deeplink';
      const container = $('telegram-login-container');

      if (mode === 'widget' && container?.querySelector('iframe')) {
        container.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast('Use the Telegram button below');
        return;
      }

      const webApp = await AuthManager.tryTelegramWebAppAuth();
      if (webApp?.ok) {
        await handleAuthResult(webApp, 'Telegram');
        return;
      }

      await beginTelegramDeepLink();
    }

    $('login-telegram')?.addEventListener('click', startTelegramSignIn);
    $('menu-telegram-btn')?.addEventListener('click', startTelegramSignIn);

    $('telegram-login-cancel')?.addEventListener('click', () => {
      $('telegram-auth-waiting')?.classList.add('hidden');
      $('telegram-login-modal')?.classList.add('hidden');
    });

    $('telegram-login-confirm')?.addEventListener('click', () => {
      const handle = $('telegram-username-input')?.value?.trim();
      const result = AuthManager.signInTelegramHandle(handle);
      if (result?.ok) {
        $('telegram-login-modal')?.classList.add('hidden');
        handleAuthResult(result, 'Telegram');
      } else {
        showToast(result?.error || 'Enter your Telegram username');
      }
    });

    document.addEventListener('mtepop:telegramauth', () => {
      reloadProgress();
      updateAuthUI();
      showToast('Signed in with Telegram');
      showScreen('menu');
    });

    $('x-login-cancel')?.addEventListener('click', () => {
      $('x-login-modal').classList.add('hidden');
    });

    $('x-login-confirm')?.addEventListener('click', async () => {
      const handle = $('x-username-input')?.value?.trim();
      const result = AuthManager.signInXHandle(handle);
      if (result?.ok) {
        $('x-login-modal')?.classList.add('hidden');
        await handleAuthResult(result, 'X');
      } else {
        showToast(result?.error || 'Enter a username');
      }
    });

    $('logout-btn')?.addEventListener('click', () => {
      AuthManager.signOut();
      reloadProgress();
      showToast('Signed out — playing as guest');
      showScreen('menu');
    });

    $('save-profile-btn')?.addEventListener('click', () => {
      const name = $('profile-name-input')?.value?.trim() || 'Player';
      const avatar = $('profile-avatar')?.textContent || 'P';
      const frame = $('profile-frame')?.style.getPropertyValue('--frame-color')?.trim() || '#6c5ce7';
      AuthManager.setProfile({ name, avatar, frame });
      showToast('Profile saved!');
      updateAuthUI();
    });

    $('invite-copy-btn')?.addEventListener('click', async () => {
      const text = `${MTEPOP_CONFIG.inviteMessage}\n${getInviteUrl()}`;
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          showToast('Invite link copied!');
          return;
        }
      } catch { /* fallback below */ }
      const link = $('invite-link');
      if (link) {
        const range = document.createRange();
        range.selectNodeContents(link);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      showToast('Link selected — long-press to copy');
    });

    $('invite-link')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const text = `${MTEPOP_CONFIG.inviteMessage}\n${getInviteUrl()}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: MTEPOP_CONFIG.appName, text: MTEPOP_CONFIG.inviteMessage, url: getInviteUrl() });
          showToast('Invite shared!');
          return;
        } catch (err) {
          if (err?.name === 'AbortError') return;
        }
      }
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          showToast('Link copied!');
        }
      } catch {
        showToast('Long-press the link to copy');
      }
    });

    $('invite-share-btn')?.addEventListener('click', async () => {
      try {
        const result = await AuthManager.inviteFriends();
        if (result?.message === 'Share cancelled') return;
        showToast(result?.message || 'Invite shared!');
      } catch {
        showToast('Could not share — tap the link or use Copy');
      }
    });

    $('invite-win-btn')?.addEventListener('click', () => {
      $('win-modal')?.classList.add('hidden');
      openSettings(true);
    });

    $('inv-bomb')?.addEventListener('click', () => startPlacement('bomb'));
    $('inv-rocket')?.addEventListener('click', () => startPlacement('rocket_h'));
    $('inv-disco')?.addEventListener('click', () => startPlacement('disco'));
    $('inv-moves')?.addEventListener('click', () => startPlacement('extra_moves'));

    $('next-level-btn')?.addEventListener('click', () => {
      startLevel(Math.min(board.levelNumber + 1, LEVELS.length));
    });

    $('win-menu-btn')?.addEventListener('click', () => showScreen('menu'));
    $('retry-btn')?.addEventListener('click', () => startLevel(currentLevel));
    $('lose-menu-btn')?.addEventListener('click', () => showScreen('menu'));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) board?.clearHint();
      else setTimeout(resizeBoard, 200);
    });

    let resizeTimer;
    const scheduleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resizeBoard, 100);
    };
    window.addEventListener('resize', scheduleResize);
    window.addEventListener('orientationchange', () => setTimeout(resizeBoard, 350));
    window.visualViewport?.addEventListener('resize', scheduleResize);

    boardEl?.parentElement?.addEventListener('touchmove', (e) => {
      if ($('game-screen')?.classList.contains('active')) e.preventDefault();
    }, { passive: false });

    boardEl?.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  function init() {
    try {
      AuthManager.init();
      PWA.init();
      progress = AuthManager.loadProgress();
    } catch (err) {
      console.error('Startup failed:', err);
      progress = { ...AuthManager.DEFAULT_PROGRESS };
    }

    bindUI();
    reloadProgress();
    finishTelegramUrlAuth();

    try {
      ParticleSystem.init(particlesCanvas);
    } catch (err) {
      console.warn('Particles unavailable:', err);
    }

    updateMuteButton();
    try { renderShop(); } catch (err) { console.warn('Shop render failed:', err); }
    try { renderProfilePickers(); } catch (err) { console.warn('Profile pickers failed:', err); }
    try { updateInviteSection(); } catch (err) { console.warn('Invite section failed:', err); }
    updateAuthUI();

    if (AudioEngine.isMusicEnabled()) {
      AudioEngine.init();
      AudioEngine.startMusic();
    }
  }

  return { init };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', Game.init);
} else {
  Game.init();
}