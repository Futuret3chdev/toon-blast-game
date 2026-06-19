const Game = (() => {
  const SHOP_ITEMS = [
    { id: 'bomb', label: 'Bomb', icon: '💣', price: 100, type: 'bomb' },
    { id: 'rocket', label: 'Rocket', icon: '🚀', price: 150, type: 'rocket_h' },
    { id: 'disco', label: 'Disco', icon: '🪩', price: 200, type: 'disco' },
    { id: 'extra_moves', label: '+5 Moves', icon: '⚡', price: 250, type: 'extra_moves' }
  ];

  let board = null;
  let currentLevel = 1;
  let placementMode = null;
  let progress = loadProgress();

  const $ = id => document.getElementById(id);
  const screens = {
    menu: $('menu-screen'),
    level: $('level-screen'),
    game: $('game-screen'),
    shop: $('shop-screen')
  };

  const boardEl = $('board');
  const particlesCanvas = $('particles');

  function loadProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem('toonblast_progress'));
      return {
        maxLevel: 1,
        stars: {},
        totalStars: 0,
        coins: 500,
        inventory: { bomb: 0, rocket_h: 0, disco: 0, extra_moves: 0 },
        ...saved
      };
    } catch {
      return {
        maxLevel: 1,
        stars: {},
        totalStars: 0,
        coins: 500,
        inventory: { bomb: 0, rocket_h: 0, disco: 0, extra_moves: 0 }
      };
    }
  }

  function saveProgress() {
    localStorage.setItem('toonblast_progress', JSON.stringify(progress));
  }

  function showScreen(name) {
    Object.values(screens).forEach(s => s?.classList.remove('active'));
    screens[name]?.classList.add('active');
    if (name !== 'game') clearPlacementMode();
    if (name === 'shop') renderShop();
    updateMenuStats();
  }

  function calcStars(movesLeft) {
    if (movesLeft >= 5) return 3;
    if (movesLeft >= 2) return 2;
    return 1;
  }

  function updateMenuStats() {
    $('menu-level').textContent = progress.maxLevel;
    $('max-level').textContent = progress.maxLevel;
    $('total-stars').textContent = progress.totalStars;
    $('menu-coins').textContent = progress.coins;
    $('shop-coins').textContent = progress.coins;
    updateInventoryHUD();
  }

  function updateInventoryHUD() {
    const inv = progress.inventory;
    $('inv-bomb-count').textContent = inv.bomb || 0;
    $('inv-rocket-count').textContent = inv.rocket_h || 0;
    $('inv-disco-count').textContent = inv.disco || 0;
    $('inv-moves-count').textContent = inv.extra_moves || 0;

    $('inv-bomb').classList.toggle('disabled', !(inv.bomb > 0));
    $('inv-rocket').classList.toggle('disabled', !(inv.rocket_h > 0));
    $('inv-disco').classList.toggle('disabled', !(inv.disco > 0));
    $('inv-moves').classList.toggle('disabled', !(inv.extra_moves > 0));
  }

  function renderShop() {
    const list = $('shop-items');
    list.innerHTML = '';
    SHOP_ITEMS.forEach(item => {
      const el = document.createElement('div');
      el.className = 'shop-item';
      const invKey = item.type === 'rocket_h' ? 'rocket_h' : item.id === 'extra_moves' ? 'extra_moves' : item.type;
      const owned = progress.inventory[invKey] || 0;
      const canAfford = progress.coins >= item.price;
      el.innerHTML = `
        <div class="shop-item-icon">${item.icon}</div>
        <div class="shop-item-info">
          <span class="shop-item-name">${item.label}</span>
          <span class="shop-item-owned">Owned: ${owned}</span>
        </div>
        <button class="shop-buy-btn ${canAfford ? '' : 'disabled'}" data-item="${item.id}">
          🪙 ${item.price}
        </button>
      `;
      const btn = el.querySelector('.shop-buy-btn');
      if (canAfford) {
        btn.addEventListener('click', () => buyItem(item));
      }
      list.appendChild(el);
    });
  }

  function buyItem(item) {
    if (progress.coins < item.price) return;
    const invKey = item.type === 'rocket_h' ? 'rocket_h' : item.id === 'extra_moves' ? 'extra_moves' : item.type;
    progress.coins -= item.price;
    progress.inventory[invKey] = (progress.inventory[invKey] || 0) + 1;
    saveProgress();
    AudioEngine.purchase();
    renderShop();
    updateMenuStats();
  }

  function clearPlacementMode() {
    placementMode = null;
    boardEl.classList.remove('placement-mode');
    document.querySelectorAll('.inv-btn.active').forEach(b => b.classList.remove('active'));
  }

  function startPlacement(type) {
    if (!board || board.busy) return;
    const invKey = type;
    if (!(progress.inventory[invKey] > 0)) return;

    if (type === 'extra_moves') {
      progress.inventory.extra_moves--;
      board.addMoves(5);
      saveProgress();
      updateInventoryHUD();
      clearPlacementMode();
      return;
    }

    placementMode = type;
    boardEl.classList.add('placement-mode');
    document.querySelectorAll('.inv-btn').forEach(b => b.classList.remove('active'));
    $(`inv-${type === 'rocket_h' ? 'rocket' : type}`)?.classList.add('active');
    AudioEngine.click();
  }

  function buildLevelGrid() {
    const grid = $('level-grid');
    grid.innerHTML = '';
    LEVELS.forEach((lvl, i) => {
      const num = i + 1;
      const btn = document.createElement('button');
      btn.className = 'level-btn';
      const unlocked = num <= progress.maxLevel;
      if (!unlocked) btn.classList.add('locked');
      if (progress.stars[num]) btn.classList.add('completed');

      const stars = progress.stars[num] || 0;
      btn.innerHTML = `${num}${stars ? `<span class="stars">${'⭐'.repeat(stars)}</span>` : ''}`;
      if (unlocked) {
        btn.addEventListener('click', () => startLevel(num));
      }
      grid.appendChild(btn);
    });
  }

  function calcCellSize(width, height) {
    const wrapper = boardEl.parentElement;
    const maxW = wrapper.clientWidth - 20;
    const maxH = wrapper.clientHeight - 20;
    const gap = 3, pad = 12;
    const sizeW = (maxW - pad - gap * (width - 1)) / width;
    const sizeH = (maxH - pad - gap * (height - 1)) / height;
    return Math.min(sizeW, sizeH, 52);
  }

  function renderBoard() {
    boardEl.innerHTML = '';
    const cellSize = calcCellSize(board.width, board.height);
    boardEl.style.setProperty('--cell-size', cellSize + 'px');
    boardEl.style.gridTemplateColumns = `repeat(${board.width}, ${cellSize}px)`;
    boardEl.style.gridTemplateRows = `repeat(${board.height}, ${cellSize}px)`;

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

        cell.addEventListener('click', () => onCellTap(row, col));
        boardEl.appendChild(cell);
      }
    }
    ParticleSystem.resize();
  }

  const CUBE_STYLES = {
    red:    { bg: 'linear-gradient(160deg, #ffb3be 0%, #ff4757 40%, #c0392b 100%)', face: '❤️' },
    green:  { bg: 'linear-gradient(160deg, #a8f5c8 0%, #2ed573 40%, #1e8449 100%)', face: '🍀' },
    blue:   { bg: 'linear-gradient(160deg, #8fa4ff 0%, #3742fa 40%, #1e3799 100%)', face: '💎' },
    yellow: { bg: 'linear-gradient(160deg, #ffe066 0%, #ffa502 40%, #e67e22 100%)', face: '⭐' },
    purple: { bg: 'linear-gradient(160deg, #d4b5ff 0%, #a55eea 40%, #6c3483 100%)', face: '🌸' }
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
      const face = document.createElement('span');
      face.className = 'block-face';
      face.textContent = cube.face;
      el.appendChild(face);
    }
    return el;
  }

  function getCellEl(row, col) {
    return boardEl.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
  }

  function getBlockEl(row, col) {
    const cell = getCellEl(row, col);
    return cell?.querySelector('.block');
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
    panel.innerHTML = '';

    const goalIcons = { box: '📦', stone: '🪨', vase: '🏺' };
    const goalLabels = { box: 'Boxes', stone: 'Stones', vase: 'Vases' };

    Object.entries(board.goals).forEach(([type, count]) => {
      const item = document.createElement('div');
      item.className = 'goal-item';
      item.dataset.goal = type;
      item.innerHTML = `
        <div class="goal-icon" style="background:${BLOCK_META[type]?.color || '#666'}">${goalIcons[type] || '?'}</div>
        <span>${goalLabels[type] || type}</span>
        <span class="goal-count">${board.goalProgress[type]}</span>
      `;
      panel.appendChild(item);
    });

    if (Object.keys(board.goals).length === 0) {
      panel.innerHTML = '<div class="goal-item">🎯 Clear all blocks!</div>';
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

  const callbacks = {
    getCellCenter,

    onExplosion(cells, type) {
      const isBig = type === 'bomb' || type === 'tnt';
      cells.forEach(({ row, col }) => {
        const cell = getCellEl(row, col);
        if (cell) {
          cell.classList.add(isBig ? 'blast-flash' : 'blast-flash-sm');
          setTimeout(() => cell.classList.remove('blast-flash', 'blast-flash-sm'), isBig ? 350 : 200);
        }
        const center = getCellCenter(row, col);
        ParticleSystem.burst(center.x, center.y, BLOCK_META[type]?.color || '#ffeaa7', isBig ? 12 : 6);
      });
    },

    onBlockDestroy(row, col, block) {
      return new Promise(resolve => {
        const el = getBlockEl(row, col);
        if (!el) { resolve(); return; }
        const color = BLOCK_META[block.type]?.color || '#fff';
        ParticleSystem.burstAtCell(boardEl, row, col, board.height, board.width, color);
        el.classList.add('popping');
        AudioEngine.pop();
        setTimeout(() => {
          el.remove();
          getCellEl(row, col)?.classList.add('empty');
          resolve();
        }, 120);
      });
    },

    onBlockUpdated(row, col, block) {
      const cell = getCellEl(row, col);
      if (!cell) return;
      const old = getBlockEl(row, col);
      const el = createBlockEl(block, row, col);
      if (old) cell.replaceChild(el, old);
      else cell.appendChild(el);
    },

    onBlockCreated(row, col, block) {
      const cell = getCellEl(row, col);
      cell?.classList.remove('empty');
      const el = createBlockEl(block, row, col);
      el.style.transform = 'scale(0)';
      cell?.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transform = 'scale(1.2)';
        setTimeout(() => { el.style.transform = ''; }, 150);
      });
    },

    onBlockFall(fromRow, fromCol, toRow, toCol) {
      return new Promise(resolve => {
        const el = getBlockEl(fromRow, fromCol);
        if (!el) { resolve(); return; }

        const cellSize = parseFloat(getComputedStyle(boardEl).getPropertyValue('--cell-size')) || 42;
        const delta = (toRow - fromRow) * (cellSize + 3);
        el.style.transition = 'transform 0.08s cubic-bezier(0.34, 1.2, 0.64, 1)';
        el.style.transform = `translateY(${delta}px)`;

        setTimeout(() => {
          const toCell = getCellEl(toRow, toCol);
          const fromCell = getCellEl(fromRow, fromCol);
          el.style.transition = '';
          el.style.transform = '';
          el.dataset.row = toRow;
          el.dataset.col = toCol;
          toCell?.classList.remove('empty');
          fromCell?.classList.add('empty');
          toCell?.appendChild(el);
          resolve();
        }, 80);
      });
    },

    onBlockSpawn(row, col, block) {
      return new Promise(resolve => {
        const cell = getCellEl(row, col);
        const el = createBlockEl(block, row, col);
        const cellSize = parseFloat(getComputedStyle(boardEl).getPropertyValue('--cell-size')) || 42;
        el.style.transition = 'transform 0.08s cubic-bezier(0.34, 1.2, 0.64, 1)';
        el.style.transform = `translateY(-${cellSize * 2}px)`;
        cell?.classList.remove('empty');
        cell?.appendChild(el);
        requestAnimationFrame(() => {
          el.style.transform = '';
          setTimeout(resolve, 80);
        });
      });
    },

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
      const el = getBlockEl(row, col);
      if (el) {
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 400);
      }
      AudioEngine.invalid();
    },

    onCombo(level) {
      const display = $('combo-display');
      $('combo-text').textContent = `COMBO x${level}!`;
      display.classList.remove('hidden');
      setTimeout(() => display.classList.add('hidden'), 800);
    },

    onHint(cells) {
      cells.forEach(({ row, col }) => {
        getBlockEl(row, col)?.classList.add('hint');
      });
    },

    onHintClear(cells) {
      cells.forEach(({ row, col }) => {
        getBlockEl(row, col)?.classList.remove('hint');
      });
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
      if (board.levelNumber >= progress.maxLevel && board.levelNumber < LEVELS.length) {
        progress.maxLevel = board.levelNumber + 1;
      }

      const coinReward = 50 + stars * 25 + movesLeft * 5;
      progress.coins += coinReward;
      saveProgress();
      updateMenuStats();

      $('win-score').textContent = score;
      $('win-coins').textContent = `+${coinReward} 🪙`;
      $('win-stars').textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
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
        if (board.placePowerUp(row, col, type, type === 'disco' ? color : null)) {
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
    if (!btn) return;
    btn.textContent = AudioEngine.isEnabled() ? '🔊' : '🔇';
    btn.classList.toggle('muted', !AudioEngine.isEnabled());
  }

  function init() {
    ParticleSystem.init(particlesCanvas);
    updateMenuStats();
    updateMuteButton();

    $('play-btn').addEventListener('click', () => {
      AudioEngine.init();
      AudioEngine.setEnabled(true);
      updateMuteButton();
      startLevel(progress.maxLevel);
    });

    $('level-select-btn').addEventListener('click', () => {
      buildLevelGrid();
      showScreen('level');
    });

    $('shop-btn').addEventListener('click', () => {
      AudioEngine.init();
      showScreen('shop');
    });

    $('shop-back').addEventListener('click', () => showScreen('menu'));
    $('level-back').addEventListener('click', () => showScreen('menu'));
    $('game-back').addEventListener('click', () => {
      board?.clearHint();
      showScreen('menu');
    });

    $('mute-btn').addEventListener('click', () => {
      AudioEngine.init();
      AudioEngine.toggle();
      updateMuteButton();
      AudioEngine.click();
    });

    $('inv-bomb').addEventListener('click', () => startPlacement('bomb'));
    $('inv-rocket').addEventListener('click', () => startPlacement('rocket_h'));
    $('inv-disco').addEventListener('click', () => startPlacement('disco'));
    $('inv-moves').addEventListener('click', () => startPlacement('extra_moves'));

    $('next-level-btn').addEventListener('click', () => {
      const next = Math.min(board.levelNumber + 1, LEVELS.length);
      startLevel(next);
    });

    $('win-menu-btn').addEventListener('click', () => showScreen('menu'));
    $('retry-btn').addEventListener('click', () => startLevel(currentLevel));
    $('lose-menu-btn').addEventListener('click', () => showScreen('menu'));

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) board?.clearHint();
    });
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', Game.init);