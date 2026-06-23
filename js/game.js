const Game = (() => {
  const CLUB_EMBLEMS = ['🏆', '🦁', '🐉', '🌟', '⚡', '🔥', '💎', '🎮', '🌈', '🦊', '👑', '🚀', '🌊', '🍀', '🎯', '⭐'];
  const clubRowCache = {};
  const playerRowCache = {};

  const SHOP_ITEMS = [
    { id: 'hearts', label: 'Refill Hearts', iconKey: 'shopHearts', desc: 'Restore all 5 hearts instantly', price: 100, kind: 'hearts' },
    { id: 'bomb', label: 'Bomb', iconKey: 'shopBomb', desc: 'Blasts a 5×5 area!', price: 100, type: 'bomb' },
    { id: 'rocket', label: 'Rocket', iconKey: 'shopRocket', desc: 'Clears a full row or column', price: 150, type: 'rocket_h' },
    { id: 'disco', label: 'Disco Ball', iconKey: 'shopDisco', desc: 'Destroys all blocks of one color', price: 200, type: 'disco' },
    { id: 'extra_moves', label: '+5 Moves', iconKey: 'shopMoves', desc: 'Instantly add 5 extra moves', price: 250, type: 'extra_moves' }
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
    settings: 'settings-screen',
    quests: 'quests-screen',
    collections: 'collections-screen',
    stickers: 'stickers-screen',
    leaderboard: 'leaderboard-screen'
  };

  let ranksTab = 'players';

  let heartsTimer = null;
  let socialPollTimer = null;
  let lastPendingInviteKey = '';

  function ensureProgress() {
    if (!progress) {
      try {
        progress = AuthManager.loadProgress();
        if (!AuthManager.isLoggedIn()) {
          const guest = JSON.parse(sessionStorage.getItem('mtepop_guest') || 'null');
          if (guest?.hearts) progress.hearts = guest.hearts;
        }
      } catch {
        progress = { ...AuthManager.DEFAULT_PROGRESS };
      }
    }
    return progress;
  }

  function persistGuestHearts() {
    if (AuthManager.isLoggedIn()) return;
    try {
      sessionStorage.setItem('mtepop_guest', JSON.stringify({ hearts: progress.hearts }));
    } catch { /* noop */ }
  }

  const boardEl = $('board');
  const particlesCanvas = $('particles');

  function reloadProgress() {
    progress = AuthManager.loadProgress();
    MetaManager.ensureMeta(progress);
    updateMenuStats();
    updateAuthUI();
    updateQuestBadge();
  }

  function trackMetaStat(stat, amount = 1) {
    if (!AuthManager.isLoggedIn()) return;
    MetaManager.trackStat(progress, stat, amount);
    MetaManager.checkQuests(progress);
    saveProgress();
    updateQuestBadge();
  }

  function updateQuestBadge() {
    const badge = $('quest-badge');
    if (!badge) return;
    const count = AuthManager.isLoggedIn()
      ? MetaManager.claimableQuestCount(progress)
      : QUESTS.length;
    if (AuthManager.isLoggedIn() && count > 0) {
      badge.textContent = String(count);
      badge.classList.remove('hidden');
    } else if (!AuthManager.isLoggedIn()) {
      badge.textContent = '!';
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  function mascotCtx(event = null) {
    return {
      event,
      moves: board?.moves ?? 20,
      startMoves: board?.startMoves ?? board?.moves ?? 20,
      comboChain: board?.comboChain ?? 0,
      board
    };
  }

  function refreshMascot() {
    MascotBrain.refresh(mascotCtx());
  }

  function reactMascot(event, duration) {
    MascotBrain.react(event, mascotCtx(), duration);
  }

  function saveProgress() {
    if (AuthManager.isLoggedIn()) AuthManager.saveProgress(progress);
    else persistGuestHearts();
  }

  function showToast(msg) {
    const t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 2800);
  }

  function renderProfileAvatar(el, prof, user) {
    if (!el) return;
    const avatarUrl = prof.avatarUrl || user?.avatarUrl;
    if (avatarUrl) {
      el.textContent = '';
      el.classList.add('has-image');
      el.style.backgroundImage = `url("${avatarUrl}")`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
      el.style.backgroundColor = 'transparent';
      return;
    }
    el.classList.remove('has-image');
    el.style.backgroundImage = '';
    el.textContent = prof.avatar;
    el.style.background = AuthManager.avatarColor(prof.avatar);
  }

  function updateAuthUI() {
    const loggedIn = AuthManager.isLoggedIn();
    const user = AuthManager.getUser();
    const prof = AuthManager.getProfile();

    $('logout-btn')?.classList.toggle('hidden', !loggedIn);
    $('menu-telegram-btn')?.classList.toggle('hidden', loggedIn);

    const authSection = $('auth-section');
    authSection?.querySelector('.social-login')?.classList.toggle('hidden', loggedIn);
    authSection?.querySelector('.card-sub')?.classList.toggle('hidden', loggedIn);
    const authTitle = authSection?.querySelector('.card-title');
    if (authTitle) authTitle.textContent = loggedIn ? 'Account' : 'Sign In or Sign Up';

    const providerLabels = {
      google: 'Google',
      facebook: 'Facebook',
      x: 'X',
      discord: 'Discord',
      telegram: 'Telegram'
    };
    if ($('profile-name')) $('profile-name').textContent = prof.name;
    renderProfileAvatar($('profile-avatar'), prof, user);

    if ($('profile-frame')) $('profile-frame').style.setProperty('--frame-color', prof.frame);
    if ($('profile-provider')) {
      const provider = providerLabels[user?.provider] || user?.provider;
      $('profile-provider').textContent = loggedIn
        ? (provider ? `Connected via ${provider}` : 'Signed in')
        : 'Playing locally — sign in to sync across devices';
    }
    if ($('profile-name-input')) $('profile-name-input').value = prof.name;
    updateSocialLocks();
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
      if (name === 'quests') renderQuests();
      if (name === 'collections') renderCollections();
      if (name === 'stickers') renderStickers();
      if (name === 'leaderboard') {
        showRanksTab(ranksTab);
        renderLeaderboard();
        renderClubLeaderboard();
        renderClub();
      }
      if (name === 'menu') {
        MascotBrain.refresh();
        syncSocial({ refresh: false });
      }
      if (name === 'leaderboard' || name === 'menu') startSocialPoll();
      else stopSocialPoll();
      ensureProgress();
      updateMenuStats();
    } catch (err) {
      console.error(`Screen "${name}" render failed:`, err);
    }
  }

  function refreshSettings() {
    const activeTab = document.querySelector('.settings-tab.active')?.dataset.settingsTab || 'sound';
    showSettingsTab(activeTab);
    renderProfilePickers();
    updateAuthUI();
    updateInviteSection();
    updateMuteButton();
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
      await syncSocial();
      showToast(`Signed in with ${providerLabel}`);
      showScreen('menu');
      return;
    }
    if (result?.error) showToast(result.error);
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

  function showSettingsTab(tab = 'sound') {
    document.querySelectorAll('.settings-tab').forEach((el) => {
      const active = el.dataset.settingsTab === tab;
      el.classList.toggle('active', active);
      el.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.settings-panel[data-settings-tab]').forEach((el) => {
      el.classList.toggle('active', el.dataset.settingsTab === tab);
    });
  }

  function openSettings(tab = 'sound') {
    AudioEngine.init();
    AudioEngine.click();
    showScreen('settings');
    showSettingsTab(tab);
    if (tab === 'support') {
      requestAnimationFrame(() => {
        $('settings-panel-support')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  function renderQuests() {
    const list = $('quests-list');
    if (!list) return;
    const loggedIn = AuthManager.isLoggedIn();
    const quests = loggedIn
      ? MetaManager.getQuestList(progress)
      : QUESTS.map(q => ({ ...q, progress: 0, current: 0, completed: false }));

    list.innerHTML = quests.map((q) => {
      const pct = Math.round((q.current / q.target) * 100);
      const done = q.completed;
      return `
        <article class="quest-card${done ? ' completed' : ''}">
          <div class="quest-icon" aria-hidden="true">${q.icon}</div>
          <div class="quest-body">
            <h3>${q.title}</h3>
            <p>${q.desc}</p>
            <div class="quest-bar"><span style="width:${Math.min(100, pct)}%"></span></div>
            <span class="quest-progress">${Math.min(q.current, q.target)} / ${q.target}</span>
            ${done ? '<span class="quest-done">Complete!</span>' : ''}
            ${q.codeReward ? `<span class="quest-code-reward">Code card: ${q.codeReward.code}</span>` : ''}
          </div>
        </article>
      `;
    }).join('');

    if (!loggedIn) {
      list.insertAdjacentHTML('afterbegin', '<p class="quest-guest-hint">Sign in to track quests and earn code cards.</p>');
    }
  }

  function clubIsAdmin(club, userId) {
    if (!club || !userId) return false;
    if (String(club.adminId) === String(userId)) return true;
    return !!club.members?.some(m => String(m.id) === String(userId) && m.role === 'admin');
  }

  let cardDetailId = null;

  function renderCollections() {
    const grid = $('collections-grid');
    if (!grid) return;
    const meta = MetaManager.ensureMeta(progress);
    const allCards = [...NORMAL_CARDS, ...CODE_CARDS];

    grid.innerHTML = allCards.map((card) => {
      const full = CARD_BY_ID[card.id];
      const count = meta.cards[card.id] || 0;
      return MetaManager.renderCardHTML(full, { owned: count > 0, count });
    }).join('');

    grid.querySelectorAll('.collect-card.card-tap').forEach((el) => {
      el.addEventListener('click', () => openCardDetail(el.dataset.id));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openCardDetail(el.dataset.id);
        }
      });
    });
  }

  async function openCardDetail(cardId) {
    const card = CARD_BY_ID[cardId];
    if (!card) return;
    cardDetailId = cardId;
    const meta = MetaManager.ensureMeta(progress);
    const count = meta.cards[cardId] || 0;
    const tradeable = SocialManager.isTradeableCard(cardId);
    const loggedIn = AuthManager.isLoggedIn();

    $('card-detail-preview').innerHTML = MetaManager.renderCardHTML(
      { ...card, type: card.type || 'normal' },
      { owned: count > 0, count }
    );
    $('card-detail-name').textContent = card.name;
    $('card-detail-meta').textContent = count > 0
      ? `You own ×${count}${count > 1 ? ' — can send extras' : ''}`
      : 'Not collected yet';

    const actions = $('card-detail-actions');
    actions.innerHTML = '';

    if (!loggedIn) {
      actions.innerHTML = '<p class="card-sub">Sign in to trade cards with your club.</p>';
    } else if (!tradeable) {
      actions.innerHTML = '<p class="card-sub">Gold &amp; code cards cannot be traded.</p>';
    } else if (count === 0) {
      actions.innerHTML = `
        <p class="card-sub">Ask clubmates who have a duplicate to send you this card.</p>
        <button id="card-request-btn" class="btn-primary btn-block" type="button">Request from Club</button>
      `;
      $('card-request-btn')?.addEventListener('click', async () => {
        try {
          await SocialManager.requestCard(cardId);
          showToast('Card request posted to your club!');
          $('card-detail-modal')?.classList.add('hidden');
        } catch (err) { showToast(err.message); }
      });
    } else if (count > 1) {
      let clubData = null;
      try { clubData = await SocialManager.getClub(); } catch { /* noop */ }
      const club = clubData?.club;
      const requests = (club?.cardRequests || []).filter(r => r.cardId === cardId && r.id !== AuthManager.getUser()?.id);

      actions.innerHTML = `
        <label class="field-label" for="card-send-search">Send to player</label>
        <input id="card-send-search" class="field-input" type="text" placeholder="Search username">
        <button id="card-send-search-btn" class="btn-secondary btn-block" type="button">Find Player</button>
        <div id="card-send-results"></div>
        ${requests.length ? `
          <h4 class="card-req-title">Club requests for this card</h4>
          <ul class="card-req-list">
            ${requests.map(r => `
              <li>
                <span>${r.name}</span>
                <button type="button" class="btn-primary card-fulfill-btn" data-id="${r.id}">Send</button>
              </li>
            `).join('')}
          </ul>
        ` : ''}
      `;

      $('card-send-search-btn')?.addEventListener('click', async () => {
        const q = $('card-send-search')?.value?.trim();
        const box = $('card-send-results');
        if (!q || !box) return;
        try {
          const data = await SocialManager.searchPlayers(q);
          box.innerHTML = (data.players || []).map(p => `
            <button type="button" class="btn-secondary card-send-target" data-id="${p.id}">Send to ${p.name}</button>
          `).join('') || '<p>No players found</p>';
          box.querySelectorAll('.card-send-target').forEach((btn) => {
            btn.addEventListener('click', async () => {
              try {
                await SocialManager.sendCard(btn.dataset.id, cardId);
                const m = MetaManager.ensureMeta(progress);
                m.cards[cardId]--;
                saveProgress();
                showToast('Card sent!');
                $('card-detail-modal')?.classList.add('hidden');
                renderCollections();
                updateMenuStats();
              } catch (err) { showToast(err.message); }
            });
          });
        } catch (err) { showToast(err.message); }
      });

      actions.querySelectorAll('.card-fulfill-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          try {
            await SocialManager.fulfillCardRequest(btn.dataset.id, cardId);
            const m = MetaManager.ensureMeta(progress);
            m.cards[cardId]--;
            saveProgress();
            showToast('Card sent to clubmate!');
            $('card-detail-modal')?.classList.add('hidden');
            renderCollections();
            updateMenuStats();
          } catch (err) { showToast(err.message); }
        });
      });
    } else {
      actions.innerHTML = '<p class="card-sub">Win another copy to send this card to a clubmate.</p>';
    }

    $('card-detail-modal')?.classList.remove('hidden');
  }

  function renderStickers() {
    const wrap = $('stickers-collections');
    if (!wrap) return;
    const meta = MetaManager.ensureMeta(progress);

    wrap.innerHTML = Object.entries(STICKER_SETS).map(([key, set]) => {
      const owned = set.stickers.filter(s => (meta.stickers[s.id] || 0) > 0).length;
      return `
        <section class="sticker-set">
          <header class="sticker-set-header" style="--set-color:${set.color}">
            <h3>${set.name}</h3>
            <span class="sticker-set-progress">${owned} / 20</span>
          </header>
          <div class="stickers-grid">
            ${set.stickers.map((sticker) =>
              MetaManager.renderStickerHTML(sticker, { count: meta.stickers[sticker.id] || 0 })
            ).join('')}
          </div>
        </section>
      `;
    }).join('');
  }

  function showRanksTab(tab = 'players') {
    ranksTab = tab;
    document.querySelectorAll('.ranks-tab').forEach((el) => {
      const active = el.dataset.ranksTab === tab;
      el.classList.toggle('active', active);
      el.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.ranks-panel').forEach((el) => {
      el.classList.toggle('active', el.dataset.ranksTab === tab);
    });
    if (tab === 'clubs') renderClubLeaderboard();
    if (tab === 'myclub') renderClub();
  }

  function renderPlayerDetailCard(player, club) {
    const detail = $('player-view-detail');
    if (!detail || !player) return;
    detail.classList.remove('hidden');
    detail.innerHTML = `
      <section class="club-card player-profile-card">
        <button type="button" class="btn-secondary player-detail-close">Close</button>
        <div class="player-profile-head">
          <span class="player-avatar" aria-hidden="true">${(player.name || '?').charAt(0).toUpperCase()}</span>
          <div>
            <h3>${player.name}</h3>
            <p class="player-rank-score">Rank score <strong>${player.score ?? 0}</strong></p>
          </div>
        </div>
        <div class="player-stat-grid">
          <div class="player-stat"><span>⭐ Stars</span><strong>${player.totalStars || 0}</strong></div>
          <div class="player-stat"><span>🗺️ Level</span><strong>${player.maxLevel || 1}</strong></div>
          <div class="player-stat"><span>🃏 Cards</span><strong>${player.uniqueCards || 0}</strong></div>
        </div>
        ${club ? `
          <div class="player-club-block">
            <span class="player-club-emoji">${club.emoji || '🏆'}</span>
            <div>
              <strong>${club.name}</strong>
              <small>${club.role || 'member'} · ${club.memberCount || 0} players · ${club.teamStars || 0}⭐ team</small>
            </div>
          </div>
        ` : '<p class="player-no-club">Not in a club yet</p>'}
      </section>
    `;
    detail.querySelector('.player-detail-close')?.addEventListener('click', () => {
      detail.classList.add('hidden');
    });
  }

  async function viewPlayerDetail(playerId) {
    if (!playerId) return;
    const detail = $('player-view-detail');
    if (detail) {
      detail.classList.remove('hidden');
      detail.innerHTML = '<p class="club-loading">Loading player…</p>';
    }
    const cached = playerRowCache[playerId];
    if (cached) renderPlayerDetailCard(cached, cached.club || null);
    try {
      const data = await SocialManager.viewPlayer(playerId);
      playerRowCache[playerId] = { ...data.player, club: data.club };
      renderPlayerDetailCard(data.player, data.club);
    } catch (err) {
      if (cached) return;
      if (detail) detail.innerHTML = `<p class="club-guest">${err.message || 'Could not load player'}</p>`;
    }
  }

  async function renderLeaderboard() {
    const list = $('leaderboard-list');
    const playerDetail = $('player-view-detail');
    if (!list) return;
    if (!AuthManager.isLoggedIn()) {
      list.innerHTML = '<li class="lb-guest">Sign in to view the leaderboard.</li>';
      return;
    }
    list.innerHTML = '<li class="lb-loading">Loading ranks…</li>';
    if (playerDetail) playerDetail.classList.add('hidden');
    try {
      await syncSocial();
      const data = await SocialManager.fetchLeaderboard();
      const user = AuthManager.getUser();
      list.innerHTML = (data.rows || []).map((row, i) => {
        playerRowCache[row.id] = { ...row };
        return `
        <li class="lb-row${row.id === user?.id ? ' me' : ''}">
          <span class="lb-rank">#${i + 1}</span>
          <button type="button" class="lb-player-btn" data-player-id="${row.id}">
            <strong>${row.name}</strong>
            <small>${row.totalStars || 0}⭐ · Lv ${row.maxLevel || 1}</small>
          </button>
          <span class="lb-score">${row.score}</span>
        </li>
      `;
      }).join('') || '<li class="lb-guest">No ranks yet — be the first!</li>';
      list.querySelectorAll('.lb-player-btn').forEach((btn) => {
        btn.addEventListener('click', () => viewPlayerDetail(btn.dataset.playerId));
      });
    } catch {
      list.innerHTML = '<li class="lb-guest">Could not load leaderboard.</li>';
    }
  }

  async function renderClubLeaderboard() {
    const list = $('club-leaderboard-list');
    const detail = $('club-view-detail');
    if (!list) return;
    if (!AuthManager.isLoggedIn()) {
      list.innerHTML = '<li class="lb-guest">Sign in to view top clubs.</li>';
      return;
    }
    list.innerHTML = '<li class="lb-loading">Loading clubs…</li>';
    if (detail) detail.classList.add('hidden');
    try {
      const data = await SocialManager.fetchClubLeaderboard();
      list.innerHTML = (data.rows || []).map((row, i) => {
        clubRowCache[row.id] = row;
        return `
        <li class="lb-row club-lb-row">
          <span class="lb-rank">#${i + 1}</span>
          <button type="button" class="club-lb-name" data-club-id="${row.id}">
            <span class="club-lb-emoji">${row.emoji || '🏆'}</span>
            <strong>${row.name}</strong>
            <small>${row.memberCount} players · ${row.teamStars}⭐</small>
          </button>
          <span class="lb-score">${row.teamStars}</span>
        </li>
      `;
      }).join('') || '<li class="lb-guest">No clubs yet — create one in My Club!</li>';
      list.querySelectorAll('.club-lb-name').forEach((btn) => {
        btn.addEventListener('click', () => viewClubDetail(btn.dataset.clubId));
      });
    } catch {
      list.innerHTML = '<li class="lb-guest">Could not load clubs.</li>';
    }
  }

  function renderClubDetailCard(club) {
    const detail = $('club-view-detail');
    if (!detail || !club) return;
    const members = club.members || [];
    const memberCount = club.memberCount ?? members.length;
    const teamStars = club.teamStars ?? members.reduce((s, m) => s + (m.stars || 0), 0);
    detail.classList.remove('hidden');
    detail.innerHTML = `
      <section class="club-card">
        <button type="button" class="btn-secondary club-detail-close">Close</button>
        <div class="club-detail-head">
          <span class="club-detail-emoji">${club.emoji || '🏆'}</span>
          <div>
            <h3>${club.name}</h3>
            ${club.description ? `<p class="club-motto">${club.description}</p>` : ''}
            <p><strong>${teamStars}</strong> team stars · <strong>${memberCount}</strong> players</p>
          </div>
        </div>
        <ul class="club-members">
          ${members.map(m => `
            <li>
              <button type="button" class="club-member-link" data-player-id="${m.id}">
                <span>${m.name}</span> <em>${m.role}</em> <span class="member-stars">${m.stars || 0}⭐</span>
              </button>
            </li>
          `).join('') || '<li>No members listed</li>'}
        </ul>
      </section>
    `;
    detail.querySelector('.club-detail-close')?.addEventListener('click', () => {
      detail.classList.add('hidden');
    });
    detail.querySelectorAll('.club-member-link').forEach((btn) => {
      btn.addEventListener('click', () => viewPlayerDetail(btn.dataset.playerId));
    });
  }

  async function viewClubDetail(clubId) {
    const detail = $('club-view-detail');
    if (!detail || !clubId) return;
    detail.classList.remove('hidden');
    detail.innerHTML = '<p class="club-loading">Loading club…</p>';
    const cached = clubRowCache[clubId];
    if (cached?.members?.length) renderClubDetailCard(cached);
    try {
      const data = await SocialManager.viewClub(clubId);
      clubRowCache[clubId] = { ...clubRowCache[clubId], ...data.club };
      renderClubDetailCard(data.club);
    } catch (err) {
      if (cached?.members?.length) return;
      detail.innerHTML = `<p class="club-guest">${err.message || 'Could not load club'}</p>`;
    }
  }

  function formatClubDate(ts) {
    if (!ts) return '';
    try {
      return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }

  function joinModeLabel(mode) {
    if (mode === 'invite') return 'Invite only';
    if (mode === 'approval') return 'Admin approval';
    return 'Open (Club ID)';
  }

  function escAttr(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  function openClubScreen() {
    if (!AuthManager.isLoggedIn()) {
      showToast('Sign in to manage your club');
      return;
    }
    AudioEngine.init();
    AudioEngine.click();
    ranksTab = 'myclub';
    showScreen('leaderboard');
  }

  async function renderClub() {
    const panel = $('club-panel');
    if (!panel) return;
    if (!AuthManager.isLoggedIn()) {
      panel.innerHTML = '<p class="club-guest">Sign in to join or create a club.</p>';
      return;
    }
    panel.innerHTML = '<p class="club-loading">Loading club…</p>';
    try {
      const data = await SocialManager.getClub();
      let club = data.club;
      if (!club) {
        const cached = SocialManager.getCachedMyClub?.();
        if (cached) club = cached;
      }
      const pendingInvites = data.pendingInvites || [];
      if (!club) {
        panel.innerHTML = `
          ${pendingInvites.length ? `
            <section class="club-card">
              <h3>Club Invites</h3>
              <ul class="club-invites">
                ${pendingInvites.map(inv => `
                  <li>
                    <span>${inv.clubName}</span>
                    <button type="button" class="btn-primary club-accept-invite" data-id="${inv.clubId}">Accept</button>
                  </li>
                `).join('')}
              </ul>
            </section>
          ` : ''}
          <section class="club-card">
            <h3>Your Player Profile</h3>
            <p class="card-sub">Set your display name in <button type="button" class="link-btn" id="club-goto-settings">Settings</button> so teammates recognize you.</p>
            <p class="club-you">Signed in as <strong>${AuthManager.getProfile()?.name || AuthManager.getUser()?.name || 'Player'}</strong></p>
          </section>
          <section class="club-card">
            <h3>Create a Club</h3>
            <p class="card-sub">You become admin — set name, motto &amp; who can join.</p>
            <input id="club-name-input" class="field-input" type="text" maxlength="24" placeholder="Club name">
            <button id="club-create-btn" class="btn-primary btn-block" type="button">Create Club</button>
          </section>
          <section class="club-card">
            <h3>Join a Club</h3>
            <p class="card-sub">Search by team name or accept an invite above.</p>
            <input id="club-join-input" class="field-input" type="text" maxlength="24" placeholder="Search team name">
            <button id="club-join-search-btn" class="btn-secondary btn-block" type="button">Search Teams</button>
            <div id="club-join-results" class="club-join-results"></div>
            <button id="club-join-btn" class="btn-primary btn-block" type="button">Join Top Result / Request</button>
          </section>
          <section class="club-card">
            <h3>Find Players</h3>
            <input id="club-search-input" class="field-input" type="text" placeholder="Search player username">
            <button id="club-search-btn" class="btn-secondary btn-block" type="button">Search Players</button>
            <div id="club-search-results" class="club-search-results"></div>
          </section>
        `;
        bindClubCreateUI();
        $('club-goto-settings')?.addEventListener('click', () => openSettings('account'));
        panel.querySelectorAll('.club-accept-invite').forEach((btn) => {
          btn.addEventListener('click', async () => {
            try {
              await SocialManager.acceptInvite(btn.dataset.id);
              showToast('Joined club!');
              renderClub();
            } catch (e) { showToast(e.message); }
          });
        });
        return;
      }

      const user = AuthManager.getUser();
      const profile = AuthManager.getProfile();
      const isAdmin = clubIsAdmin(club, user?.id);
      const canManage = club.members.some(m => String(m.id) === String(user?.id) && (m.role === 'admin' || m.role === 'officer'));
      const quests = data.teamQuests || [];
      const qp = club.questProgress || {};
      const teamStars = club.members.reduce((s, m) => s + (m.stars || 0), 0);
      const joinMode = club.joinMode || 'open';
      const invites = club.invites || [];
      const joinRequests = club.joinRequests || [];

      panel.innerHTML = `
        <section class="club-card club-profile-card">
          <div class="club-profile-header">
            <div class="club-avatar" aria-hidden="true">${club.emoji || '🏆'}</div>
            <div class="club-profile-meta">
              ${isAdmin ? `
                <label class="field-label">Team Picture</label>
                <div id="club-emoji-picker" class="club-emoji-picker">
                  ${CLUB_EMBLEMS.map(e => `
                    <button type="button" class="club-emoji-opt${(club.emoji || '🏆') === e ? ' active' : ''}" data-emoji="${e}">${e}</button>
                  `).join('')}
                </div>
                <label class="field-label" for="club-name-edit">Club Name</label>
                <input id="club-name-edit" class="field-input" type="text" maxlength="24" value="${escAttr(club.name)}">
                <label class="field-label" for="club-desc-edit">Club Motto</label>
                <input id="club-desc-edit" class="field-input" type="text" maxlength="120" placeholder="Short motto or description" value="${escAttr(club.description)}">
                <label class="field-label" for="club-join-mode">Who Can Join</label>
                <select id="club-join-mode" class="field-input">
                  <option value="open"${joinMode === 'open' ? ' selected' : ''}>Anyone with Club ID</option>
                  <option value="invite"${joinMode === 'invite' ? ' selected' : ''}>Invite only</option>
                  <option value="approval"${joinMode === 'approval' ? ' selected' : ''}>Request — admin approves</option>
                </select>
                <button id="club-save-profile" class="btn-primary btn-block" type="button">Save Club Profile</button>
              ` : `
                <h3>${club.name}</h3>
                ${club.description ? `<p class="club-motto">${club.description}</p>` : ''}
                <p class="club-join-hint">Join policy: ${joinModeLabel(joinMode)}</p>
              `}
              <p class="club-id">Club ID: <code>${club.id}</code>
                <button type="button" id="club-copy-id" class="btn-secondary btn-sm">Copy</button>
              </p>
              <p class="club-stats-line"><strong>${teamStars}</strong> team stars · <strong>${club.members.length}</strong>/30 players</p>
            </div>
          </div>
          <p class="club-you">Playing as <strong>${profile?.name || user?.name}</strong></p>
          <button id="club-heart-request" class="btn-secondary btn-block" type="button">Request Heart from Club</button>
          ${!isAdmin ? `<button id="club-leave-btn" class="btn-secondary btn-block" type="button">Leave Club</button>` : ''}
        </section>

        ${canManage && joinRequests.length ? `
        <section class="club-card">
          <h3>Join Requests (${joinRequests.length})</h3>
          <ul class="club-requests">
            ${joinRequests.map(r => `
              <li>
                <span>${r.name}</span>
                <button type="button" class="btn-primary club-approve-join" data-id="${r.id}">Approve</button>
                <button type="button" class="btn-secondary club-deny-join" data-id="${r.id}">Deny</button>
              </li>
            `).join('')}
          </ul>
        </section>
        ` : ''}

        ${canManage && invites.length ? `
        <section class="club-card">
          <h3>Pending Invites (${invites.length})</h3>
          <ul class="club-invites">
            ${invites.map(i => `
              <li>
                <span>${i.name}</span>
                <button type="button" class="btn-secondary club-revoke-invite" data-id="${i.id}">Revoke</button>
              </li>
            `).join('')}
          </ul>
        </section>
        ` : ''}

        <section class="club-card">
          <h3>Members (${club.members.length})</h3>
          <ul class="club-members club-roster">
            ${club.members.map(m => `
              <li>
                <button type="button" class="member-avatar member-profile-btn" data-player-id="${m.id}" aria-label="View ${m.name}">${(m.name || '?').charAt(0).toUpperCase()}</button>
                <button type="button" class="member-info member-profile-btn" data-player-id="${m.id}">
                  <strong>${m.name}</strong>
                  <small>${m.role}${m.joinedAt ? ` · joined ${formatClubDate(m.joinedAt)}` : ''} · ${m.stars || 0}⭐</small>
                </button>
                <span class="member-actions">
                  ${m.id !== user?.id ? `<button type="button" class="club-send-heart" data-id="${m.id}">❤️</button>` : ''}
                  ${isAdmin && m.role !== 'admin' ? `
                    <button type="button" class="club-promote" data-id="${m.id}" data-role="officer">Officer</button>
                    <button type="button" class="club-promote" data-id="${m.id}" data-role="member">Member</button>
                    <button type="button" class="club-kick" data-id="${m.id}">Remove</button>
                  ` : ''}
                </span>
              </li>
            `).join('')}
          </ul>
          ${(club.heartRequests || []).length ? `
            <h4>Heart Requests</h4>
            <ul class="club-requests">
              ${club.heartRequests.map(r => `
                <li>${r.name} ${r.id !== user?.id ? `<button type="button" class="club-fulfill" data-id="${r.id}">Give ❤️</button>` : ''}</li>
              `).join('')}
            </ul>
          ` : ''}
        </section>

        ${canManage ? `
        <section class="club-card">
          <h3>Invite Players</h3>
          <p class="card-sub">Search by display name (player must have signed in at least once).</p>
          <input id="club-invite-input" class="field-input" type="text" placeholder="Search player name">
          <button id="club-invite-btn" class="btn-secondary btn-block" type="button">Search Players</button>
          <div id="club-invite-results"></div>
        </section>
        ` : ''}

        <section class="club-card">
          <h3>Team Quests</h3>
          ${quests.map(q => {
            const cur = qp[q.stat] || 0;
            const pct = Math.min(100, Math.round((cur / q.target) * 100));
            return `
              <div class="team-quest">
                <strong>${q.title}</strong> <span class="quest-diff">${q.difficulty}</span>
                <p>${q.desc}</p>
                <div class="quest-bar"><span style="width:${pct}%"></span></div>
                <span class="quest-progress">${cur} / ${q.target}</span>
              </div>
            `;
          }).join('')}
        </section>
      `;
      bindClubPanelUI(club);
    } catch (err) {
      panel.innerHTML = `<p class="club-guest">${err.message || 'Could not load club'}</p>`;
    }
  }

  function bindClubCreateUI() {
    $('club-create-btn')?.addEventListener('click', async () => {
      const name = $('club-name-input')?.value?.trim();
      if (!name) return showToast('Enter a club name');
      try {
        const result = await SocialManager.createClub(name);
        showToast('Club created! Set up your profile below.');
        ranksTab = 'myclub';
        showRanksTab('myclub');
        if (result?.club) SocialManager.cacheMyClub?.(result.club);
        renderClub();
      } catch (e) { showToast(e.message); }
    });
    $('club-join-search-btn')?.addEventListener('click', async () => {
      const q = $('club-join-input')?.value?.trim();
      await searchClubsToJoin(q, $('club-join-results'));
    });
    $('club-join-btn')?.addEventListener('click', async () => {
      const query = $('club-join-input')?.value?.trim();
      if (!query) return showToast('Enter a team name to search');
      try {
        await syncSocial();
        const result = await SocialManager.joinClub(query);
        showToast(result?.pending ? 'Join request sent to admin!' : 'Joined club!');
        if (!result?.pending) {
          showRanksTab('myclub');
          renderClub();
        }
      } catch (e) { showToast(e.message); }
    });
    $('club-join-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('club-join-search-btn')?.click();
    });
    $('club-search-btn')?.addEventListener('click', async () => {
      const q = $('club-search-input')?.value?.trim();
      const box = $('club-search-results');
      if (!q || !box) return;
      box.innerHTML = '<p class="club-loading">Searching players…</p>';
      try {
        await syncSocial();
        const data = await SocialManager.searchPlayers(q);
        box.innerHTML = (data.players || []).map(p =>
          `<button type="button" class="search-row search-player-btn" data-player-id="${p.id}">
            <strong>${p.name}</strong>
            <small>${p.totalStars || 0}⭐ · Lv ${p.maxLevel || 1}${p.clubId ? ' · in club' : ''}</small>
          </button>`
        ).join('') || '<p class="club-guest">No players found — they must sign in first</p>';
        box.querySelectorAll('.search-player-btn').forEach((btn) => {
          btn.addEventListener('click', () => viewPlayerDetail(btn.dataset.playerId));
        });
      } catch (e) { showToast(e.message); }
    });
    $('club-search-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('club-search-btn')?.click();
    });
  }

  function bindClubPanelUI(club) {
    let selectedEmoji = club.emoji || '🏆';
    const picker = $('club-emoji-picker');
    picker?.querySelectorAll('.club-emoji-opt').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedEmoji = btn.dataset.emoji;
        picker.querySelectorAll('.club-emoji-opt').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const av = document.querySelector('.club-profile-card .club-avatar');
        if (av) av.textContent = selectedEmoji;
      });
    });

    $('club-save-profile')?.addEventListener('click', async () => {
      try {
        await SocialManager.updateClub({
          clubName: $('club-name-edit')?.value?.trim(),
          description: $('club-desc-edit')?.value?.trim(),
          joinMode: $('club-join-mode')?.value,
          emoji: selectedEmoji
        });
        showToast('Club profile saved!');
        renderClub();
      } catch (err) { showToast(err.message); }
    });

    $('club-copy-id')?.addEventListener('click', async () => {
      const id = club.id;
      try {
        await navigator.clipboard.writeText(id);
        showToast('Club ID copied!');
      } catch {
        showToast(id);
      }
    });

    $('club-leave-btn')?.addEventListener('click', async () => {
      try {
        await SocialManager.leaveClub();
        showToast('Left club');
        renderClub();
      } catch (err) { showToast(err.message); }
    });

    $('club-panel')?.querySelectorAll('.club-approve-join').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await SocialManager.approveJoin(btn.dataset.id);
          showToast('Player added to club!');
          renderClub();
        } catch (err) { showToast(err.message); }
      });
    });

    $('club-panel')?.querySelectorAll('.club-deny-join').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await SocialManager.denyJoin(btn.dataset.id);
          showToast('Request denied');
          renderClub();
        } catch (err) { showToast(err.message); }
      });
    });

    $('club-panel')?.querySelectorAll('.club-revoke-invite').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await SocialManager.revokeInvite(btn.dataset.id);
          showToast('Invite revoked');
          renderClub();
        } catch (err) { showToast(err.message); }
      });
    });

    $('club-panel')?.querySelectorAll('.club-kick').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await SocialManager.kickMember(btn.dataset.id);
          showToast('Member removed');
          renderClub();
        } catch (err) { showToast(err.message); }
      });
    });

    $('club-heart-request')?.addEventListener('click', async () => {
      const h = HeartsManager.ensure(progress);
      if (!HeartsManager.canRequest(h)) return showToast('Heart request cooldown (3 hours)');
      try {
        await SocialManager.requestClubHeart();
        HeartsManager.markRequest(h);
        saveProgress();
        showToast('Heart request sent to club!');
        renderClub();
      } catch (e) { showToast(e.message); }
    });

    $('club-panel')?.querySelectorAll('.club-send-heart').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await SocialManager.sendHeart(btn.dataset.id);
          showToast('Heart sent!');
        } catch (err) { showToast(err.message); }
      });
    });
    $('club-panel')?.querySelectorAll('.club-fulfill').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await SocialManager.fulfillClubHeart(btn.dataset.id);
          showToast('Heart gifted!');
          renderClub();
        } catch (err) { showToast(err.message); }
      });
    });
    $('club-panel')?.querySelectorAll('.club-promote').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await SocialManager.promoteMember(btn.dataset.id, btn.dataset.role);
          showToast('Role updated');
          renderClub();
        } catch (err) { showToast(err.message); }
      });
    });

    $('club-panel')?.querySelectorAll('.member-profile-btn').forEach((btn) => {
      btn.addEventListener('click', () => viewPlayerDetail(btn.dataset.playerId));
    });

    $('club-invite-btn')?.addEventListener('click', async () => {
      const q = $('club-invite-input')?.value?.trim();
      const box = $('club-invite-results');
      if (!q || !box) return;
      box.innerHTML = '<p class="club-loading">Searching players…</p>';
      try {
        await syncSocial();
        const data = await SocialManager.searchPlayers(q);
        const eligible = (data.players || []).filter(p => !p.clubId && !club.members.some(m => m.id === p.id));
        box.innerHTML = eligible.map(p => `
          <button type="button" class="btn-secondary club-invite-target" data-id="${p.id}" data-name="${escAttr(p.name)}">
            Invite ${p.name} <small>(${p.totalStars || 0}⭐)</small>
          </button>
        `).join('') || '<p class="club-guest">No available players — already in a club or not signed in yet</p>';
        box.querySelectorAll('.club-invite-target').forEach(btn => {
          btn.addEventListener('click', async () => {
            try {
              await SocialManager.invitePlayer(btn.dataset.id, btn.dataset.name);
              showToast(`Invite sent to ${btn.dataset.name}!`);
              renderClub();
            } catch (err) { showToast(err.message); }
          });
        });
      } catch (err) { showToast(err.message); }
    });
    $('club-invite-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') $('club-invite-btn')?.click();
    });

  }

  function showWinRewards(rewards, loggedIn) {
    const wrap = $('win-reward');
    const cardEl = $('win-card-preview');
    const stickerEl = $('win-sticker-preview');
    if (!wrap || !cardEl) return;

    if (!rewards) {
      wrap.classList.add('hidden');
      return;
    }

    wrap.classList.remove('hidden');
    cardEl.innerHTML = MetaManager.renderCardHTML(
      { ...rewards.card, type: 'normal' },
      { owned: true }
    );
    if (rewards.sticker && stickerEl) {
      stickerEl.textContent = `${rewards.stickerIsNew ? 'New sticker: ' : 'Sticker: '}${rewards.sticker.emoji} ${rewards.sticker.name}`;
      stickerEl.classList.remove('hidden');
    } else if (stickerEl) {
      stickerEl.classList.add('hidden');
    }

    const label = $('win-reward-label');
    if (label) {
      label.textContent = loggedIn
        ? (rewards.cardIsNew ? 'New card!' : 'Card collected!')
        : 'Card earned — sign in to keep it!';
    }
  }

  function calcStars(movesLeft) {
    if (movesLeft >= 5) return 3;
    if (movesLeft >= 2) return 2;
    if (movesLeft > 0) return 1;
    return 0;
  }

  function getStarBarState(movesLeft, startMoves) {
    if (movesLeft <= 0) {
      return { fill: 0, maxStars: 0, earned: [false, false, false], label: 'No stars' };
    }

    const movesUsed = Math.max(0, startMoves - movesLeft);
    const maxStars = calcStars(movesLeft);
    const pace3 = Math.max(1, startMoves - 5);
    const pace2 = Math.max(pace3 + 1, startMoves - 2);
    const labels = ['', 'Good', 'Great', 'Perfect'];

    let fill = 0;
    if (maxStars === 3) {
      fill = (movesUsed / pace3) * 100;
    } else if (maxStars === 2) {
      const span = Math.max(1, pace2 - pace3);
      fill = 66 + (Math.max(0, movesUsed - pace3) / span) * 34;
    } else {
      const span = Math.max(1, startMoves - pace2);
      fill = 33 + (Math.max(0, movesUsed - pace2) / span) * 33;
    }
    fill = Math.min(100, Math.max(0, fill));

    const thresholds = [33, 66, 100];
    const earned = thresholds.map((t, i) => fill >= t - 2 && (i + 1) <= maxStars);

    return {
      fill,
      maxStars,
      earned,
      label: movesUsed === 0 ? 'Keep going' : (labels[maxStars] || 'Good')
    };
  }

  function initStarBarSlots() {
    const svg = MTEIcons?.starHollow || '';
    document.querySelectorAll('#star-bar .star-slot').forEach((el) => {
      if (!el.innerHTML.trim()) el.innerHTML = svg;
    });
  }

  function updateStarBar(movesLeft) {
    const startMoves = board?.startMoves ?? board?.moves ?? movesLeft;
    const state = getStarBarState(movesLeft, startMoves);
    const quality = $('star-quality');
    if (quality) quality.textContent = state.label;

    const fillEl = $('star-track-fill');
    if (fillEl) fillEl.style.width = `${state.fill}%`;

    document.querySelectorAll('#star-bar .star-slot').forEach((el) => {
      const tier = Number(el.dataset.tier);
      const on = state.earned[tier - 1];
      el.classList.toggle('earned', on);
      el.classList.toggle('pending', !on && tier <= state.maxStars);
      el.classList.toggle('lost', tier > state.maxStars);
    });
  }

  function updateHeartsHUD() {
    if (!progress) return;
    HeartsManager.renderBar($('menu-hearts'), progress);
    clearInterval(heartsTimer);
    heartsTimer = setInterval(() => {
      if (progress) HeartsManager.renderBar($('menu-hearts'), progress);
    }, 30000);
  }

  function updateSocialLocks() {
    const loggedIn = AuthManager.isLoggedIn();
    $('leaderboard-btn')?.classList.toggle('hub-tile-locked', !loggedIn);
    $('club-btn')?.classList.toggle('hub-tile-locked', !loggedIn);
  }

  function refreshSocialScreens() {
    if (!$('leaderboard-screen')?.classList.contains('active')) return;
    if (ranksTab === 'players') renderLeaderboard();
    else if (ranksTab === 'clubs') renderClubLeaderboard();
    else if (ranksTab === 'myclub') renderClub();
  }

  function startSocialPoll() {
    stopSocialPoll();
    if (!AuthManager.isLoggedIn()) return;
    const intervalMs = $('leaderboard-screen')?.classList.contains('active') ? 5000 : 8000;
    const tick = () => {
      const onRanks = $('leaderboard-screen')?.classList.contains('active');
      syncSocial({ refresh: onRanks }).catch(() => {});
    };
    tick();
    socialPollTimer = setInterval(tick, intervalMs);
  }

  function stopSocialPoll() {
    if (socialPollTimer) clearInterval(socialPollTimer);
    socialPollTimer = null;
  }

  async function syncSocial(opts = {}) {
    if (!AuthManager.isLoggedIn()) return null;
    try {
      const syncData = await SocialManager.syncProfile(progress);
      const inbox = await SocialManager.fetchInbox();
      let changed = false;

      if (inbox.gifts?.length) {
        inbox.gifts.forEach(() => HeartsManager.add(progress, 1));
        for (let i = inbox.gifts.length - 1; i >= 0; i--) {
          try { await SocialManager.claimHeart(i); } catch { /* noop */ }
        }
        changed = true;
        showToast(`Received ${inbox.gifts.length} heart(s) from teammates!`);
      }

      const pendingGifts = syncData?.cardGifts?.length
        ? syncData.cardGifts
        : [];
      if (pendingGifts.length) {
        const claim = await SocialManager.claimCardGifts();
        if (claim.claimed?.length) {
          const meta = MetaManager.ensureMeta(progress);
          claim.claimed.forEach((cardId) => {
            meta.cards[cardId] = (meta.cards[cardId] || 0) + 1;
          });
          changed = true;
          showToast(`Received ${claim.claimed.length} card gift(s)!`);
        }
      }

      const invites = syncData?.pendingInvites || [];
      if (invites.length) {
        const key = invites.map(i => i.clubId).sort().join(',');
        if (key !== lastPendingInviteKey) {
          lastPendingInviteKey = key;
          const first = invites[0];
          showToast(`${first.emoji || '🏆'} Club invite: ${first.clubName}`);
        }
      } else {
        lastPendingInviteKey = '';
      }

      if (changed) {
        saveProgress();
        updateHeartsHUD();
        updateMenuStats();
      }

      if (opts.refresh) refreshSocialScreens();
      return syncData;
    } catch { /* offline */ }
    return null;
  }

  function joinModeShort(mode) {
    if (mode === 'invite') return 'Invite only';
    if (mode === 'approval') return 'Approval';
    return 'Open';
  }

  function renderClubJoinResults(clubs, box) {
    if (!box) return;
    box.innerHTML = (clubs || []).map(c => `
      <div class="club-join-row">
        <button type="button" class="club-join-pick" data-club-id="${c.id}">
          <span class="club-lb-emoji">${c.emoji || '🏆'}</span>
          <span>
            <strong>${c.name}</strong>
            <small>${c.memberCount}/30 · ${c.teamStars}⭐ · ${joinModeShort(c.joinMode)}</small>
          </span>
        </button>
      </div>
    `).join('') || '<p class="club-guest">No teams found — try another name</p>';
    box.querySelectorAll('.club-join-pick').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const clubName = btn.querySelector('strong')?.textContent || 'team';
        try {
          const result = await SocialManager.joinClub(btn.dataset.clubId, { clubId: btn.dataset.clubId });
          showToast(result?.pending ? 'Join request sent to admin!' : `Joined ${clubName}!`);
          if (!result?.pending) {
            showRanksTab('myclub');
            renderClub();
          }
        } catch (e) { showToast(e.message); }
      });
    });
  }

  async function searchClubsToJoin(query, box) {
    if (!query || !box) return;
    box.innerHTML = '<p class="club-loading">Searching teams…</p>';
    try {
      await syncSocial();
      const data = await SocialManager.searchClubs(query);
      let clubs = data.clubs || [];
      if (!clubs.length) {
        const cached = Object.values(clubRowCache).filter(c => {
          const name = (c.name || '').toLowerCase();
          const q = query.toLowerCase();
          return name.includes(q) || c.id.toLowerCase().includes(q);
        });
        if (cached.length) clubs = cached;
      }
      renderClubJoinResults(clubs, box);
    } catch (e) {
      box.innerHTML = `<p class="club-guest">${e.message || 'Search failed'}</p>`;
    }
  }

  function updateMenuStats() {
    if (!progress) return;
    HeartsManager.regen(HeartsManager.ensure(progress));
    updateHeartsHUD();
    updateSocialLocks();
    const playLevel = AuthManager.getPlayLevel(progress);
    if ($('menu-level')) $('menu-level').textContent = playLevel;
    if ($('max-level')) $('max-level').textContent = progress.maxLevel;
    if ($('total-stars')) $('total-stars').textContent = progress.totalStars;
    if ($('menu-coins')) $('menu-coins').textContent = progress.coins;
    if ($('shop-coins')) $('shop-coins').textContent = progress.coins;
    const meta = MetaManager.ensureMeta(progress);
    if ($('menu-card-count')) {
      $('menu-card-count').textContent = MetaManager.uniqueCardCount(meta);
    }
    if ($('menu-sticker-count')) {
      $('menu-sticker-count').textContent = MetaManager.ownedStickerCount(meta);
    }
    updateInventoryHUD();
    updateQuestBadge();
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

    const hearts = HeartsManager.regen(HeartsManager.ensure(data));

    SHOP_ITEMS.forEach(item => {
      const invKey = item.type === 'rocket_h' ? 'rocket_h' : item.id === 'extra_moves' ? 'extra_moves' : item.type;
      const owned = item.kind === 'hearts'
        ? `${hearts.current}/${hearts.max}`
        : `In bag: ${(data.inventory && data.inventory[invKey]) || 0}`;
      const canAfford = data.coins >= item.price;
      const heartsFull = item.kind === 'hearts' && hearts.current >= hearts.max;
      const iconSvg = MTEIcons[item.iconKey] || '';

      const el = document.createElement('article');
      el.className = 'shop-item';
      el.innerHTML = `
        <div class="shop-item-icon shop-item-svg" aria-hidden="true">${iconSvg}</div>
        <div class="shop-item-body">
          <div class="shop-item-head">
            <span class="shop-item-name">${item.label}</span>
            <span class="shop-item-owned">${item.kind === 'hearts' ? `Hearts: ${owned}` : owned}</span>
          </div>
          <p class="shop-item-desc">${item.desc}</p>
        </div>
        <button class="shop-buy-btn ${canAfford && !heartsFull ? '' : 'disabled'}" type="button">
          <span class="coin-badge coin-badge-sm" aria-hidden="true"></span>
          <span>${item.price}</span>
        </button>
      `;
      const btn = el.querySelector('.shop-buy-btn');
      btn.addEventListener('click', () => {
        if (heartsFull && item.kind === 'hearts') {
          showToast('Hearts already full');
          return;
        }
        if (canAfford) buyItem(item);
        else AudioEngine.invalid();
      });
      list.appendChild(el);
    });
  }

  function buyItem(item) {
    if (progress.coins < item.price) return;
    if (item.kind === 'hearts') {
      const result = HeartsManager.refill(progress);
      if (!result.ok) {
        showToast(result.error || 'Cannot refill');
        return;
      }
    } else {
      const invKey = item.type === 'rocket_h' ? 'rocket_h' : item.id === 'extra_moves' ? 'extra_moves' : item.type;
      progress.coins -= item.price;
      if (!progress.inventory) progress.inventory = {};
      progress.inventory[invKey] = (progress.inventory[invKey] || 0) + 1;
      saveProgress();
      AudioEngine.purchase();
      renderShop();
      updateMenuStats();
      return;
    }
    saveProgress();
    AudioEngine.purchase();
    updateHeartsHUD();
    renderShop();
    updateMenuStats();
    showToast('Hearts refilled!');
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

  function refreshBoardDOM(dropIn = false) {
    for (let row = 0; row < board.height; row++) {
      for (let col = 0; col < board.width; col++) {
        const block = board.getBlock(row, col);
        const cell = getCellEl(row, col);
        if (!cell) continue;
        const existing = getBlockEl(row, col);

        if (!block) {
          existing?.remove();
          cell.classList.add('empty');
          continue;
        }

        cell.classList.remove('empty');
        if (existing && existing.dataset.id === block.id) continue;

        existing?.remove();
        const el = createBlockEl(block, row, col);
        if (dropIn) el.classList.add('drop-in');
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
      if (cells.length >= 2) {
        reactMascot('match', 700);
        if (AuthManager.isLoggedIn()) {
          SocialManager.contributeQuest('pops', cells.length).catch(() => {});
        }
      }
    },

    async onPowerUpExplosion(originRow, originCol, cells, type) {
      boardEl.parentElement?.classList.add('screen-shake');
      setTimeout(() => boardEl.parentElement?.classList.remove('screen-shake'), 260);

      ParticleSystem.shockwaveAtCell(boardEl, originRow, originCol, '#ffeaa7', type === 'tnt' ? 2.2 : 1.6);

      const originEl = getBlockEl(originRow, originCol);
      originEl?.classList.add('power-charge');

      const flashClass = type === 'rocket_h' || type === 'rocket_v'
        ? 'rocket-blast'
        : type === 'disco'
          ? 'disco-flash'
          : 'blast-flash';

      cells.forEach(({ row, col }) => {
        getCellEl(row, col)?.classList.add(flashClass);
        getBlockEl(row, col)?.classList.add('exploding');
      });

      if (type === 'rocket_h' || type === 'rocket_v') {
        const isH = type === 'rocket_h';
        const step = Math.max(1, Math.floor(cells.length / 6));
        cells.forEach(({ row, col }, i) => {
          if (i % step !== 0 && i !== cells.length - 1) return;
          const c = getCellCenter(row, col);
          ParticleSystem.rocketTrail(c.x, c.y, isH);
        });
      } else if (type === 'bomb' || type === 'tnt') {
        const step = Math.max(1, Math.floor(cells.length / 8));
        cells.forEach(({ row, col }, i) => {
          if (i % step !== 0 && i !== cells.length - 1) return;
          const c = getCellCenter(row, col);
          ParticleSystem.burst(c.x, c.y, '#ff7675', 6);
        });
      } else if (type === 'disco') {
        const step = Math.max(1, Math.floor(cells.length / 10));
        cells.forEach(({ row, col }, i) => {
          if (i % step !== 0 && i !== cells.length - 1) return;
          const c = getCellCenter(row, col);
          ParticleSystem.discoBurst(c.x, c.y);
        });
      }

      await delay(32);

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
        const finish = () => {
          el.remove();
          getCellEl(row, col)?.classList.add('empty');
          resolve();
        };
        if (fast) {
          requestAnimationFrame(finish);
          return;
        }
        setTimeout(finish, 120);
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
      refreshBoardDOM(spawns.length > 0);
      if (!falls.length && !spawns.length) return;
      await delay(20);
      document.querySelectorAll('.block.drop-in').forEach(el => el.classList.remove('drop-in'));
    },

    onBlockFall() { return Promise.resolve(); },
    onBlockSpawn() { return Promise.resolve(); },

    onMovesChanged(moves) {
      $('moves-count').textContent = moves;
      $('moves-count').classList.toggle('low', moves <= 3);
      updateStarBar(moves);
      refreshMascot();
    },

    onStatEvent(stat, amount = 1) {
      trackMetaStat(stat, amount);
    },

    onGoalUpdate(type, remaining) {
      const item = document.querySelector(`.goal-item[data-goal="${type}"]`);
      if (item) {
        item.querySelector('.goal-count').textContent = remaining;
        if (remaining <= 0) item.classList.add('done');
      }
      refreshMascot();
    },

    onInvalidTap(row, col) {
      getBlockEl(row, col)?.classList.add('shake');
      setTimeout(() => getBlockEl(row, col)?.classList.remove('shake'), 400);
      AudioEngine.invalid();
      reactMascot('invalid', 900);
    },

    onCombo(level) {
      const display = $('combo-display');
      $('combo-text').textContent = `COMBO x${level}!`;
      display.classList.remove('hidden');
      setTimeout(() => display.classList.add('hidden'), 800);
      trackMetaStat('combos', 1);
      reactMascot('combo', 1200);
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
      MascotBrain.apply(mascotCtx('win'), { forceQuip: true });

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

      let rewards = null;
      let questCompletions = [];
      if (loggedIn) {
        progress.coins += coinReward;
        trackMetaStat('levelsWon', 1);
        rewards = MetaManager.awardWinRewards(progress, board.levelNumber);
        questCompletions = MetaManager.checkQuests(progress);
        saveProgress();
        SocialManager.syncProfile(progress).catch(() => {});
        SocialManager.contributeQuest('wins', 1).catch(() => {});
        SocialManager.contributeQuest('stars', stars).catch(() => {});
      } else {
        const preview = JSON.parse(JSON.stringify(progress));
        MetaManager.ensureMeta(preview);
        rewards = MetaManager.awardWinRewards(preview, board.levelNumber);
      }

      $('win-coins').textContent = loggedIn
        ? `+${coinReward} coins`
        : 'Sign in to save progress & unlock levels!';
      showWinRewards(rewards, loggedIn);
      updateMenuStats();

      if (questCompletions.length) {
        const names = questCompletions.map(q => q.title).join(', ');
        setTimeout(() => showToast(`Quest complete: ${names}!`), 400);
      }

      $('win-score').textContent = score;
      $('win-stars').textContent = renderStarRow(stars);
      updateAuthUI();
      $('win-modal').classList.remove('hidden');
    },

    onLose() {
      AudioEngine.lose();
      MascotBrain.apply(mascotCtx('lose'), { forceQuip: true });
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
    ensureProgress();
    if (!HeartsManager.canPlay(progress)) {
      showToast('No hearts! Wait 30 min or refill for 100 coins');
      return;
    }
    if (!HeartsManager.spend(progress)) {
      showToast('No hearts left');
      return;
    }
    saveProgress();
    updateHeartsHUD();

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
    board.startMoves = board.moves;
    updateStarBar(board.moves);
    refreshMascot();
  }

  function updateMuteButton() {
    const sfxOn = AudioEngine.isEnabled();
    const musicOn = AudioEngine.isMusicEnabled();
    const btn = $('mute-btn');
    if (btn) {
      btn.dataset.on = sfxOn ? 'true' : 'false';
      btn.setAttribute('aria-pressed', sfxOn ? 'false' : 'true');
      const state = btn.querySelector('.sound-toggle-state');
      if (state) state.textContent = sfxOn ? 'On' : 'Off';
    }
    const musicBtn = $('music-btn');
    if (musicBtn) {
      musicBtn.dataset.on = musicOn ? 'true' : 'false';
      musicBtn.setAttribute('aria-pressed', musicOn ? 'false' : 'true');
      const state = musicBtn.querySelector('.sound-toggle-state');
      if (state) state.textContent = musicOn ? 'On' : 'Off';
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
      case 'settings-cog-btn':
        e.preventDefault();
        openSettings('sound');
        break;
      case 'quests-btn':
        e.preventDefault();
        AudioEngine.init();
        AudioEngine.click();
        showScreen('quests');
        break;
      case 'collections-btn':
        e.preventDefault();
        AudioEngine.init();
        AudioEngine.click();
        showScreen('collections');
        break;
      case 'stickers-btn':
        e.preventDefault();
        AudioEngine.init();
        AudioEngine.click();
        showScreen('stickers');
        break;
      case 'leaderboard-btn':
        e.preventDefault();
        if (!AuthManager.isLoggedIn()) { showToast('Sign in for ranks & clubs'); return; }
        AudioEngine.init();
        AudioEngine.click();
        ranksTab = 'players';
        showScreen('leaderboard');
        break;
      case 'club-btn':
        e.preventDefault();
        openClubScreen();
        break;
      case 'invite-win-btn':
        e.preventDefault();
        $('win-modal')?.classList.add('hidden');
        openSettings('account');
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
      if (AuthManager.isLoggedIn()) {
        syncSocial({ refresh: true }).catch(() => {});
        startSocialPoll();
      } else {
        stopSocialPoll();
      }
      if ($('level-screen')?.classList.contains('active')) buildLevelMap();
    });

    $('card-detail-close')?.addEventListener('click', () => {
      $('card-detail-modal')?.classList.add('hidden');
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
    $('quests-back')?.addEventListener('click', () => showScreen('menu'));
    $('collections-back')?.addEventListener('click', () => showScreen('menu'));
    $('stickers-back')?.addEventListener('click', () => showScreen('menu'));
    $('leaderboard-back')?.addEventListener('click', () => showScreen('menu'));
    document.querySelectorAll('.ranks-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        AudioEngine.click();
        showRanksTab(tab.dataset.ranksTab);
      });
    });
    document.querySelectorAll('.settings-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        AudioEngine.click();
        showSettingsTab(tab.dataset.settingsTab);
      });
    });
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
      syncSocial().catch(() => {});
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
      openSettings('account');
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
      if (document.hidden) {
        board?.clearHint();
      } else {
        setTimeout(resizeBoard, 200);
        if (AuthManager.isLoggedIn()) {
          syncSocial({ refresh: $('leaderboard-screen')?.classList.contains('active') }).catch(() => {});
          startSocialPoll();
        }
      }
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

    try { initStarBarSlots(); } catch (err) { console.warn('Star bar init failed:', err); }

    try {
      ParticleSystem.init(particlesCanvas);
    } catch (err) {
      console.warn('Particles unavailable:', err);
    }

    reloadProgress();
    finishTelegramUrlAuth().catch((err) => console.warn('Telegram URL auth:', err));

    updateMuteButton();
    try { renderShop(); } catch (err) { console.warn('Shop render failed:', err); }
    try { renderProfilePickers(); } catch (err) { console.warn('Profile pickers failed:', err); }
    try { updateInviteSection(); } catch (err) { console.warn('Invite section failed:', err); }
    updateAuthUI();
    if (AuthManager.isLoggedIn()) {
      syncSocial({ refresh: false }).catch(() => {});
      startSocialPoll();
    }
    MascotBrain.init();
    showSettingsTab('sound');

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