const SocialManager = (() => {
  const CLUB_CACHE_PREFIX = 'mtepop:myclub:';

  async function api(action, payload = {}, method = 'POST') {
    const url = method === 'GET'
      ? `/api/social?action=${encodeURIComponent(action)}&${new URLSearchParams(payload)}`
      : '/api/social';
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (method !== 'GET') opts.body = JSON.stringify({ action, ...payload });
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  function userPayload() {
    const user = AuthManager.getUser();
    if (!user) return null;
    const profile = AuthManager.getProfile?.() || {};
    return {
      id: user.id,
      name: profile.name || user.name,
      provider: user.provider
    };
  }

  function cacheMyClub(club) {
    const user = userPayload();
    if (!user?.id || !club) return;
    try {
      localStorage.setItem(`${CLUB_CACHE_PREFIX}${user.id}`, JSON.stringify({ club, at: Date.now() }));
    } catch { /* quota */ }
  }

  function getCachedMyClub() {
    const user = userPayload();
    if (!user?.id) return null;
    try {
      const raw = localStorage.getItem(`${CLUB_CACHE_PREFIX}${user.id}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.club || null;
    } catch {
      return null;
    }
  }

  function clearMyClubCache() {
    const user = userPayload();
    if (!user?.id) return;
    try { localStorage.removeItem(`${CLUB_CACHE_PREFIX}${user.id}`); } catch { /* */ }
  }

  async function syncProfile(progress) {
    const user = userPayload();
    if (!user) return null;
    const meta = MetaManager.ensureMeta(progress);
    return api('sync', {
      ...user,
      totalStars: progress.totalStars || 0,
      maxLevel: progress.maxLevel || 1,
      uniqueCards: MetaManager.uniqueCardCount(meta),
      cards: meta.cards
    });
  }

  async function fetchLeaderboard() {
    return api('leaderboard', {}, 'GET');
  }

  async function fetchClubLeaderboard() {
    return api('club_leaderboard', {}, 'GET');
  }

  async function viewClub(clubId) {
    return api('club_view', { clubId }, 'GET');
  }

  async function viewPlayer(playerId) {
    return api('player_view', { playerId }, 'GET');
  }

  async function claimCardGifts() {
    const user = userPayload();
    if (!user) return { claimed: [] };
    return api('card_claim', { userId: user.id });
  }

  async function searchPlayers(q) {
    return api('search', { q }, 'GET');
  }

  async function searchClubs(q) {
    return api('club_search', { q }, 'GET');
  }

  async function getClub() {
    const user = userPayload();
    if (!user) return null;
    const data = await api('club_get', user, 'GET');
    if (data.club) {
      cacheMyClub(data.club);
      return data;
    }
    const cached = getCachedMyClub();
    if (cached) {
      return { ...data, club: cached, fromCache: true };
    }
    return data;
  }

  async function createClub(name) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    const result = await api('club_create', { ...user, clubName: name });
    if (result.club) cacheMyClub(result.club);
    return result;
  }

  async function joinClub(clubIdOrQuery, opts = {}) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    const raw = String(clubIdOrQuery || '').trim();
    const payload = { ...user };
    if (opts.clubId || raw.startsWith('club_')) {
      payload.clubId = opts.clubId || raw;
    } else {
      payload.clubQuery = raw;
    }
    const result = await api('club_join', payload);
    if (result.club) cacheMyClub(result.club);
    return result;
  }

  async function acceptInvite(clubId) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    const result = await api('club_accept_invite', { ...user, clubId });
    if (result.club) cacheMyClub(result.club);
    return result;
  }

  async function invitePlayer(targetId, targetName) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    const cached = getCachedMyClub();
    return api('club_invite', {
      ...user,
      targetId,
      targetName,
      clubId: cached?.id
    });
  }

  async function updateClub(fields) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    const result = await api('club_update', { ...user, ...fields });
    if (result.club) cacheMyClub(result.club);
    return result;
  }

  async function approveJoin(targetId) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    const result = await api('club_approve_join', { ...user, targetId });
    if (result.club) cacheMyClub(result.club);
    return result;
  }

  async function denyJoin(targetId) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    return api('club_deny_join', { ...user, targetId });
  }

  async function kickMember(targetId) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    const result = await api('club_kick', { ...user, targetId });
    if (result.club) cacheMyClub(result.club);
    return result;
  }

  async function revokeInvite(targetId) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    return api('club_revoke_invite', { ...user, targetId });
  }

  async function leaveClub() {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    const result = await api('club_leave', user);
    clearMyClubCache();
    return result;
  }

  async function promoteMember(targetId, role) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    const result = await api('club_promote', { ...user, targetId, role });
    if (result.club) cacheMyClub(result.club);
    return result;
  }

  async function contributeQuest(stat, amount) {
    const user = userPayload();
    if (!user) return;
    return api('club_quest', { ...user, stat, amount });
  }

  async function sendHeart(targetId) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    return api('heart_send', { ...user, targetId });
  }

  async function fetchInbox() {
    const user = userPayload();
    if (!user) return { gifts: [] };
    return api('heart_inbox', { userId: user.id }, 'GET');
  }

  async function claimHeart(index) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    return api('heart_claim', { userId: user.id, index });
  }

  async function sendCard(targetId, cardId) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    const meta = MetaManager.ensureMeta(AuthManager.loadProgress());
    return api('card_send', { ...user, targetId, cardId, cards: meta.cards });
  }

  async function requestCard(cardId) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    return api('card_request', { ...user, cardId });
  }

  async function fulfillCardRequest(targetId, cardId) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    const meta = MetaManager.ensureMeta(AuthManager.loadProgress());
    return api('card_fulfill_request', { ...user, targetId, cardId, cards: meta.cards });
  }

  async function requestClubHeart() {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    return api('club_heart_request', user);
  }

  async function fulfillClubHeart(targetId) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    return api('club_heart_fulfill', { ...user, targetId });
  }

  function isCodeCard(cardId) {
    return !!CODE_CARDS?.find(c => c.id === cardId);
  }

  function isTradeableCard(cardId) {
    if (isCodeCard(cardId)) return false;
    const card = CARD_BY_ID?.[cardId];
    return card?.type !== 'code' && card?.rarity !== 'legendary';
  }

  return {
    syncProfile,
    fetchLeaderboard,
    fetchClubLeaderboard,
    viewClub,
    viewPlayer,
    claimCardGifts,
    searchPlayers,
    searchClubs,
    getClub,
    createClub,
    joinClub,
    acceptInvite,
    invitePlayer,
    updateClub,
    approveJoin,
    denyJoin,
    kickMember,
    revokeInvite,
    leaveClub,
    promoteMember,
    contributeQuest,
    sendHeart,
    fetchInbox,
    claimHeart,
    sendCard,
    requestCard,
    fulfillCardRequest,
    requestClubHeart,
    fulfillClubHeart,
    isCodeCard,
    isTradeableCard,
    cacheMyClub,
    getCachedMyClub
  };
})();