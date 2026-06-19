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
      const key = `${row},${col}`;
      if (destroyed.has(key)) continue;
      destroyed.add(key);
      await this.destroyBlock(row, col);
      this.score += 10;
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
    for (const [dr, dc] of dirs) {
      const nr = row + dr, nc = col + dc;
      const key = `${nr},${nc}`;
      if (destroyed.has(key)) continue;
      const neighbor = this.getBlock(nr, nc);
      if (!neighbor) continue;
      const meta = BLOCK_META[neighbor.type];
      if (meta?.interacts) {
        destroyed.add(key);
        await this.damageBlock(nr, nc);
        this.score += 15;
      }
    }
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

  async activatePowerUp(row, col, block, useMove) {
    this.busy = true;
    this.comboChain++;
    if (this.comboChain > 1) {
      this.callbacks.onCombo(this.comboChain);
      AudioEngine.combo(this.comboChain);
    }

    const affected = this.getPowerUpArea(row, col, block);
    const destroyed = new Set();

    for (const { row: r, col: c } of affected) {
      const key = `${r},${c}`;
      if (destroyed.has(key)) continue;
      const b = this.getBlock(r, c);
      if (!b) continue;
      destroyed.add(key);

      if (b.type === 'vase' && b.health > 1) {
        b.health = 1;
        b.type = 'vase_cracked';
        this.callbacks.onBlockUpdated(r, c, b);
      } else if (BLOCK_META[b.type]?.interacts || this.isCube(b) || this.isPower(b)) {
        await this.destroyBlock(r, c);
        this.score += 20;
        await this.damageNeighbors(r, c, destroyed);
      }
    }

    AudioEngine.explode();
    ParticleSystem.sparkle(
      this.callbacks.getCellCenter(row, col).x,
      this.callbacks.getCellCenter(row, col).y
    );

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

    switch (block.type) {
      case 'rocket_h':
        for (let c = 0; c < this.width; c++) cells.push({ row, col: c });
        break;
      case 'rocket_v':
        for (let r = 0; r < this.height; r++) cells.push({ row: r, col });
        break;
      case 'bomb':
      case 'tnt':
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const r = row + dr, c = col + dc;
            if (r >= 0 && r < this.height && c >= 0 && c < this.width) {
              cells.push({ row: r, col: c });
            }
          }
        }
        if (block.type === 'tnt') {
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              if (Math.abs(dr) <= 1 && Math.abs(dc) <= 1) continue;
              if (Math.abs(dr) + Math.abs(dc) <= 2) {
                const r = row + dr, c = col + dc;
                if (r >= 0 && r < this.height && c >= 0 && c < this.width) {
                  cells.push({ row: r, col: c });
                }
              }
            }
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
    let moved = false;
    for (let col = 0; col < this.width; col++) {
      for (let row = this.height - 1; row >= 0; row--) {
        if (this.getBlock(row, col) !== null) continue;

        for (let above = row - 1; above >= 0; above--) {
          const block = this.getBlock(above, col);
          if (block === null) continue;
          if (!BLOCK_META[block.type]?.fallable) break;

          this.setBlock(row, col, block);
          this.setBlock(above, col, null);
          await this.callbacks.onBlockFall(above, col, row, col);
          moved = true;
          break;
        }
      }
    }
    if (moved) AudioEngine.fall();
    return moved;
  }

  async spawnNew() {
    let spawned = false;
    for (let col = 0; col < this.width; col++) {
      if (this.getBlock(0, col) === null) {
        const newBlock = randomCube();
        this.setBlock(0, col, newBlock);
        await this.callbacks.onBlockSpawn(0, col, newBlock);
        spawned = true;
      }
    }
    return spawned;
  }

  async settle() {
    let changed = true;
    while (changed) {
      changed = await this.applyGravity();
      changed = (await this.spawnNew()) || changed;
      if (changed) await delay(100);
    }
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