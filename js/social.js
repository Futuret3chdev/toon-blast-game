const SocialManager = (() => {
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
    return {
      id: user.id,
      name: user.name,
      provider: user.provider
    };
  }

  async function syncProfile(progress) {
    const user = userPayload();
    if (!user) return;
    const meta = MetaManager.ensureMeta(progress);
    await api('sync', {
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

  async function searchPlayers(q) {
    return api('search', { q }, 'GET');
  }

  async function getClub() {
    const user = userPayload();
    if (!user) return null;
    return api('club_get', user, 'GET');
  }

  async function createClub(name) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    return api('club_create', { ...user, clubName: name });
  }

  async function joinClub(clubId) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    return api('club_join', { ...user, clubId });
  }

  async function acceptInvite(clubId) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    return api('club_accept_invite', { ...user, clubId });
  }

  async function invitePlayer(targetId) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    return api('club_invite', { ...user, targetId });
  }

  async function promoteMember(targetId, role) {
    const user = userPayload();
    if (!user) throw new Error('Sign in required');
    return api('club_promote', { ...user, targetId, role });
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
    searchPlayers,
    getClub,
    createClub,
    joinClub,
    acceptInvite,
    invitePlayer,
    promoteMember,
    contributeQuest,
    sendHeart,
    fetchInbox,
    claimHeart,
    sendCard,
    requestClubHeart,
    fulfillClubHeart,
    isCodeCard,
    isTradeableCard
  };
})();