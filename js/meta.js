const MetaManager = (() => {
  const DEFAULT_META = {
    cards: {},
    stickers: {},
    quests: {},
    stats: {
      levelsWon: 0,
      boxesPopped: 0,
      combos: 0,
      powerUpsUsed: 0
    }
  };

  const RARITY_WEIGHT = { common: 55, uncommon: 30, rare: 15 };

  function ensureMeta(progress) {
    if (!progress.meta) progress.meta = JSON.parse(JSON.stringify(DEFAULT_META));
    progress.meta.cards = progress.meta.cards || {};
    progress.meta.stickers = progress.meta.stickers || {};
    progress.meta.quests = progress.meta.quests || {};
    progress.meta.stats = { ...DEFAULT_META.stats, ...(progress.meta.stats || {}) };
    return progress.meta;
  }

  function uniqueCardCount(meta) {
    return Object.keys(meta.cards).filter(id => meta.cards[id] > 0).length;
  }

  function getStatValue(meta, stat, progress) {
    if (stat === 'totalStars') return progress.totalStars || 0;
    if (stat === 'uniqueCards') return uniqueCardCount(meta);
    return meta.stats[stat] || 0;
  }

  function addCard(meta, cardId, count = 1) {
    meta.cards[cardId] = (meta.cards[cardId] || 0) + count;
    return (meta.cards[cardId] === count);
  }

  function addSticker(meta, stickerId, count = 1) {
    meta.stickers[stickerId] = (meta.stickers[stickerId] || 0) + count;
    return (meta.stickers[stickerId] === count);
  }

  function pickNormalCard(levelNumber = 1) {
    const setKeys = Object.keys(CARD_SETS);
    const set = setKeys[(levelNumber - 1) % setKeys.length];
    const pool = NORMAL_CARDS.filter(c => c.set === set);
    const weights = pool.map(c => RARITY_WEIGHT[c.rarity] || 10);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  }

  function pickRandomCodeCard(owned = {}) {
    const unowned = CODE_CARDS.filter(c => !owned[c.id]);
    const pool = unowned.length ? unowned : CODE_CARDS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function awardWinRewards(progress, levelNumber) {
    const meta = ensureMeta(progress);
    const card = pickNormalCard(levelNumber);
    const isNew = addCard(meta, card.id);
    const setKeys = Object.keys(CARD_SETS);
    const set = setKeys[(levelNumber - 1) % setKeys.length];
    const pool = STICKERS.filter(s => s.set === set && !s.gold);
    const stickerRoll = pool[Math.floor(Math.random() * pool.length)] || STICKERS[0];
    const stickerNew = Math.random() < 0.35 ? addSticker(meta, stickerRoll.id) : false;

    return {
      card: { ...card, type: 'normal' },
      cardIsNew: isNew,
      sticker: stickerNew ? stickerRoll : null,
      stickerIsNew: stickerNew
    };
  }

  function trackStat(progress, stat, amount = 1) {
    const meta = ensureMeta(progress);
    if (meta.stats[stat] !== undefined) {
      meta.stats[stat] += amount;
    }
    return checkQuests(progress);
  }

  function checkQuests(progress) {
    const meta = ensureMeta(progress);
    const completed = [];

    QUESTS.forEach((quest) => {
      const q = meta.quests[quest.id] || { progress: 0, completed: false };
      if (q.completed) return;

      const current = getStatValue(meta, quest.stat, progress);
      q.progress = Math.min(current, quest.target);
      if (current >= quest.target) {
        q.completed = true;
        q.completedAt = Date.now();
        completed.push(quest);
        if (quest.reward?.coins) progress.coins += quest.reward.coins;
        if (quest.reward?.sticker) addSticker(meta, quest.reward.sticker);
        if (Math.random() < (quest.codeChance || 0.15)) {
          const codeCard = pickRandomCodeCard(meta.cards);
          const codeNew = addCard(meta, codeCard.id);
          q.codeReward = { ...codeCard, type: 'code', isNew: codeNew };
        }
      }
      meta.quests[quest.id] = q;
    });

    return completed;
  }

  function getQuestList(progress) {
    const meta = ensureMeta(progress);
    return QUESTS.map((quest) => {
      const saved = meta.quests[quest.id] || {};
      const current = getStatValue(meta, quest.stat, progress);
      return {
        ...quest,
        progress: Math.min(current, quest.target),
        current,
        completed: !!saved.completed,
        codeReward: saved.codeReward || null
      };
    });
  }

  function claimableQuestCount(progress) {
    return getQuestList(progress).filter(q => q.completed).length;
  }

  function renderCardHTML(card, opts = {}) {
    const set = CARD_SETS[card.set] || { name: 'Special', color: '#6c5ce7' };
    const isCode = card.type === 'code';
    const owned = opts.owned !== false;
    return `
      <article class="collect-card${owned ? '' : ' locked'}${isCode ? ' code-card' : ''} rarity-${card.rarity || 'common'}" data-id="${card.id}">
        <div class="collect-card-art${owned ? '' : ' collect-card-empty'}" style="--set-color:${set.color}">${owned ? card.emoji : ''}</div>
        <div class="collect-card-name">${card.name}</div>
        ${isCode && owned ? `<div class="collect-card-code">${card.code}</div>` : ''}
        ${opts.count > 1 ? `<span class="collect-card-count">×${opts.count}</span>` : ''}
      </article>
    `;
  }

  function renderStickerHTML(sticker, opts = {}) {
    const owned = (opts.count || 0) > 0;
    const set = CARD_SETS[sticker.set] || { name: 'Special', color: '#6c5ce7' };
    const frameClass = sticker.gold ? 'sticker-frame-gold' : 'sticker-frame-blue';
    if (!owned) {
      return `
        <article class="sticker-card locked ${frameClass}" data-id="${sticker.id}" title="${sticker.name}">
          <div class="sticker-frame-inner"></div>
          <div class="sticker-name">${sticker.name}</div>
        </article>
      `;
    }
    return `
      <article class="sticker-card owned ${frameClass}" data-id="${sticker.id}">
        <div class="sticker-art" style="--set-color:${set.color}">${sticker.symbol}</div>
        <div class="sticker-name">${sticker.name}</div>
        ${opts.count > 1 ? `<span class="sticker-count">×${opts.count}</span>` : ''}
      </article>
    `;
  }

  function ownedStickerCount(meta) {
    return STICKERS.filter(s => (meta.stickers[s.id] || 0) > 0).length;
  }

  function setMascotState(el, state) {
    if (!el) return;
    el.dataset.state = state;
    el.setAttribute('aria-label', `Blip is ${state}`);
  }

  function mascotFromMoves(moves, maxMoves = 20) {
    if (moves <= 1) return 'sad';
    if (moves <= 3) return 'worried';
    if (moves <= 5) return 'nervous';
    return 'idle';
  }

  return {
    ensureMeta,
    awardWinRewards,
    trackStat,
    checkQuests,
    getQuestList,
    claimableQuestCount,
    pickNormalCard,
    renderCardHTML,
    setMascotState,
    mascotFromMoves,
    uniqueCardCount,
    renderStickerHTML,
    ownedStickerCount,
    DEFAULT_META
  };
})();