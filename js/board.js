class GameBoard {
  constructor(levelInfo, callbacks) {
    this.callbacks = callbacks;
    const parsed = parseLevel(levelInfo);
    this.width = parsed.width;
    this.height = parsed.height;
    this.cells = parsed.cells;
    this.moves = parsed.moves;
    this.goals = { ...parsed.goals };
    this.goalProgress = { ...parsed.goals };
    this.levelNumber = parsed.levelNumber;
    this.busy = false;
    this.score = 0;
    this.comboChain = 0;
    this.hintTimer = null;
    this.hintCells = [];
  }

  getBlock(row, col) {
    if (row < 0 || row >= this.height || col < 0 || col >= this.width) return null;
    return this.cells[row][col];
  }

  setBlock(row, col, block) {
    this.cells[row][col] = block;
  }

  isCube(block) {
    return block && BLOCK_META[block.type]?.matchColor;
  }

  isPower(block) {
    return block && BLOCK_META[block.type]?.power;
  }

  findMatch(row, col) {
    const start = this.getBlock(row, col);
    if (!start || !this.isCube(start)) return [];

    const color = BLOCK_META[start.type].matchColor;
    const visited = new Set();
    const result = [];
    const stack = [[row, col]];

    while (stack.length) {
      const [r, c] = stack.pop();
      const key = `${r},${c}`;
      if (visited.has(key)) continue;
      const block = this.getBlock(r, c);
      if (!block || BLOCK_META[block.type]?.matchColor !== color) continue;
      visited.add(key);
      result.push({ row: r, col: c, block });
      stack.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
    }
    return result;
  }

  getClusterShape(match) {
    const rows = match.map(m => m.row);
    const cols = match.map(m => m.col);
    const height = Math.max(...rows) - Math.min(...rows) + 1;
    const width = Math.max(...cols) - Math.min(...cols) + 1;
    return { width, height };
  }

  createPowerUp(type, color) {
    const block = { type, id: uid() };
    if (color) block.sourceColor = color;
    return block;
  }

  determinePowerUp(match, tapRow, tapCol) {
    const cubeCount = match.length;
    if (cubeCount < 5) return null;

    const color = BLOCK_META[match[0].block.type].matchColor;
    const { width, height } = this.getClusterShape(match);

    if (cubeCount >= 9) {
      return this.createPowerUp('disco', color);
    }
    if (cubeCount >= 7) {
      return this.createPowerUp('bomb');
    }
    return this.createPowerUp(width >= height ? 'rocket_h' : 'rocket_v');
  }

  async handleTap(row, col) {
    if (this.busy) return;
    this.clearHint();

    const block = this.getBlock(row, col);
    if (!block) return;

    if (this.isPower(block)) {
      await this.activatePowerUp(row, col, block, true);
      return;
    }

    if (!this.isCube(block)) return;

    const match = this.findMatch(row, col);
    if (match.length < 2) {
      this.callbacks.onInvalidTap(row, col);
      return;
    }

    this.busy = true;
    this.comboChain = 0;
    const powerUp = this.determinePowerUp(match, row, col);
    const tapCell = { row, col };

    await this.destroyMatch(match, tapCell, powerUp);
    this.moves--;
    this.callbacks.onMovesChanged(this.moves);

    await this.settle();
    this.busy = false;

    this.callbacks.onStateChange();
    this.checkEnd();
    this.resetHintTimer();
  }

  async destroyMatch(match, tapCell, powerUp) {
    const destroyed = new Set();
    const toDestroy = [...match];

    for (const { row, col } of toDestroy) {
      destroyed.add(`${row},${col}`);
    }

    await Promise.all(toDestroy.map(async ({ row, col }) => {
      await this.destroyBlock(row, col);
      this.score += 10;
    }));

    for (const { row, col } of toDestroy) {
      await this.damageNeighbors(row, col, destroyed);
    }

    AudioEngine.match(match.length);

    if (powerUp) {
      this.setBlock(tapCell.row, tapCell.col, powerUp);
      this.callbacks.onBlockCreated(tapCell.row, tapCell.col, powerUp);
      AudioEngine.powerUp();
    }
  }

  async damageNeighbors(row, col, destroyed) {
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    const tasks = [];
    for (const [dr, dc] of dirs) {
      const nr = row + dr, nc = col + dc;
      const key = `${nr},${nc}`;
      if (destroyed.has(key)) continue;
      const neighbor = this.getBlock(nr, nc);
      if (!neighbor) continue;
      const meta = BLOCK_META[neighbor.type];
      if (meta?.interacts) {
        destroyed.add(key);
        tasks.push((async () => {
          await this.damageBlock(nr, nc);
          this.score += 15;
        })());
      }
    }
    await Promise.all(tasks);
  }

  async damageBlock(row, col) {
    const block = this.getBlock(row, col);
    if (!block) return;

    if (block.type === 'vase' && block.health > 1) {
      block.health = 1;
      block.type = 'vase_cracked';
      this.callbacks.onBlockUpdated(row, col, block);
      AudioEngine.pop();
      return;
    }

    await this.destroyBlock(row, col);
  }

  async destroyBlock(row, col) {
    const block = this.getBlock(row, col);
    if (!block) return;
    this.updateGoals(block.type === 'vase_cracked' ? 'vase' : block.type);
    await this.callbacks.onBlockDestroy(row, col, block);
    this.setBlock(row, col, null);
  }

  updateGoals(type) {
    const meta = BLOCK_META[type];
    if (meta?.goal && this.goalProgress[type] > 0) {
      this.goalProgress[type]--;
      this.callbacks.onGoalUpdate(type, this.goalProgress[type]);
    }
  }

  collectPowerUpArea(row, col, block, into) {
    const cells = this.getPowerUpArea(row, col, block);
    for (const cell of cells) {
      const key = `${cell.row},${cell.col}`;
      if (!into.has(key)) into.set(key, cell);
    }
  }

  async activatePowerUp(row, col, block, useMove) {
    this.busy = true;
    this.comboChain++;
    if (this.comboChain > 1) {
      this.callbacks.onCombo(this.comboChain);
      AudioEngine.combo(this.comboChain);
    }

    const affected = new Map();
    const chain = [{ row, col, block }];
    const chained = new Set();

    while (chain.length) {
      const current = chain.pop();
      const key = `${current.row},${current.col}`;
      if (chained.has(key)) continue;
      chained.add(key);
      this.collectPowerUpArea(current.row, current.col, current.block, affected);

      for (const { row: r, col: c } of this.getPowerUpArea(current.row, current.col, current.block)) {
        const b = this.getBlock(r, c);
        if (!b || !this.isPower(b)) continue;
        if (r === current.row && c === current.col) continue;
        chain.push({ row: r, col: c, block: b });
      }
    }

    const cells = [...affected.values()];
    this.callbacks.onExplosion(cells, block.type);

    const destroyed = new Set();
    const destroyTasks = [];

    for (const { row: r, col: c } of cells) {
      const cellKey = `${r},${c}`;
      if (destroyed.has(cellKey)) continue;
      const b = this.getBlock(r, c);
      if (!b) continue;
      destroyed.add(cellKey);

      if (b.type === 'vase' && b.health > 1) {
        b.health = 1;
        b.type = 'vase_cracked';
        this.callbacks.onBlockUpdated(r, c, b);
      } else if (BLOCK_META[b.type]?.interacts || this.isCube(b) || this.isPower(b)) {
        destroyTasks.push((async () => {
          await this.destroyBlock(r, c);
          this.score += 20;
          await this.damageNeighbors(r, c, destroyed);
        })());
      }
    }

    await Promise.all(destroyTasks);

    AudioEngine.explode(block.type);

    if (useMove) {
      this.moves--;
      this.callbacks.onMovesChanged(this.moves);
    }

    await this.settle();
    this.busy = false;
    this.callbacks.onStateChange();
    this.checkEnd();
    this.resetHintTimer();
  }

  getPowerUpArea(row, col, block) {
    const cells = [];
    const add = (r, c) => {
      if (r >= 0 && r < this.height && c >= 0 && c < this.width) {
        cells.push({ row: r, col: c });
      }
    };

    switch (block.type) {
      case 'rocket_h':
        for (let c = 0; c < this.width; c++) cells.push({ row, col: c });
        break;
      case 'rocket_v':
        for (let r = 0; r < this.height; r++) cells.push({ row: r, col });
        break;
      case 'bomb':
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            add(row + dr, col + dc);
          }
        }
        break;
      case 'tnt':
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            if (Math.abs(dr) + Math.abs(dc) <= 2) add(row + dr, col + dc);
          }
        }
        for (let dr = -3; dr <= 3; dr++) {
          for (let dc = -3; dc <= 3; dc++) {
            if (Math.abs(dr) + Math.abs(dc) === 3) add(row + dr, col + dc);
          }
        }
        break;
      case 'disco': {
        const color = block.sourceColor;
        for (let r = 0; r < this.height; r++) {
          for (let c = 0; c < this.width; c++) {
            const b = this.getBlock(r, c);
            if (b && BLOCK_META[b.type]?.matchColor === color) {
              cells.push({ row: r, col: c });
            }
          }
        }
        break;
      }
    }
    return cells;
  }

  async applyGravity() {
    const falls = [];

    for (let col = 0; col < this.width; col++) {
      let writeRow = this.height - 1;

      for (let readRow = this.height - 1; readRow >= 0; readRow--) {
        const block = this.getBlock(readRow, col);
        if (block === null) continue;

        if (!BLOCK_META[block.type]?.fallable) {
          writeRow = readRow - 1;
          continue;
        }

        if (readRow !== writeRow) {
          this.setBlock(writeRow, col, block);
          this.setBlock(readRow, col, null);
          falls.push({ fromRow: readRow, fromCol: col, toRow: writeRow, toCol: col });
        }
        writeRow--;
      }
    }

    if (falls.length) {
      AudioEngine.fall();
      await Promise.all(falls.map(f =>
        this.callbacks.onBlockFall(f.fromRow, f.fromCol, f.toRow, f.toCol)
      ));
    }
    return falls.length > 0;
  }

  async spawnNew() {
    const spawns = [];

    for (let col = 0; col < this.width; col++) {
      if (this.getBlock(0, col) === null) {
        const newBlock = randomCube();
        this.setBlock(0, col, newBlock);
        spawns.push({ row: 0, col, block: newBlock });
      }
    }

    if (spawns.length) {
      await Promise.all(spawns.map(s =>
        this.callbacks.onBlockSpawn(s.row, s.col, s.block)
      ));
    }
    return spawns.length > 0;
  }

  async settle() {
    let changed = true;
    let passes = 0;
    while (changed && passes < 30) {
      passes++;
      changed = await this.applyGravity();
      changed = (await this.spawnNew()) || changed;
      if (changed) await delay(20);
    }
  }

  placePowerUp(row, col, type, sourceColor) {
    if (this.busy) return false;
    const block = this.getBlock(row, col);
    if (!block || !this.isCube(block)) return false;

    const powerUp = this.createPowerUp(type, sourceColor);
    this.setBlock(row, col, powerUp);
    this.callbacks.onBlockUpdated(row, col, powerUp);
    AudioEngine.powerUp();
    return true;
  }

  addMoves(count) {
    this.moves += count;
    this.callbacks.onMovesChanged(this.moves);
    AudioEngine.coin();
  }

  checkEnd() {
    const goalsDone = Object.keys(this.goals).every(
      type => this.goalProgress[type] <= 0
    );

    if (goalsDone) {
      this.callbacks.onWin(this.score, this.moves);
      return;
    }

    if (this.moves <= 0) {
      this.callbacks.onLose();
    }
  }

  findHint() {
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        const block = this.getBlock(row, col);
        if (!this.isCube(block) && !this.isPower(block)) continue;
        if (this.isPower(block)) return [{ row, col }];
        const match = this.findMatch(row, col);
        if (match.length >= 2) return match.slice(0, 3).map(m => ({ row: m.row, col: m.col }));
      }
    }
    return [];
  }

  resetHintTimer() {
    clearTimeout(this.hintTimer);
    this.clearHint();
    this.hintTimer = setTimeout(() => {
      if (!this.busy) {
        this.hintCells = this.findHint();
        this.callbacks.onHint(this.hintCells);
      }
    }, 5000);
  }

  clearHint() {
    if (this.hintCells.length) {
      this.callbacks.onHintClear(this.hintCells);
      this.hintCells = [];
    }
  }

  allGoalsMet() {
    return Object.keys(this.goals).every(type => this.goalProgress[type] <= 0);
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}