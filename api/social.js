import { getPlayers, savePlayers, getClubs, saveClubs, getInbox, saveInbox, clubId, now, LIMITS } from './_data.js';

const CODE_CARD_IDS = new Set([
  'code_sunny', 'code_bloom', 'code_royal', 'code_magic',
  'code_tide', 'code_pearl', 'code_blaze', 'code_pop'
]);

const TEAM_QUESTS = [
  { id: 'tq_pops', title: 'Pop Patrol', desc: 'Pop 200 cubes as a team', target: 200, stat: 'pops', difficulty: 'easy', reward: 150 },
  { id: 'tq_wins', title: 'Victory Squad', desc: 'Win 15 levels combined', target: 15, stat: 'wins', difficulty: 'medium', reward: 250 },
  { id: 'tq_stars', title: 'Star Alliance', desc: 'Earn 30 stars together', target: 30, stat: 'stars', difficulty: 'hard', reward: 400 }
];

function scoreOf(p) {
  return (p.totalStars || 0) * 10 + (p.maxLevel || 1) * 5 + (p.uniqueCards || 0) * 3;
}

function sanitizeUser(body) {
  const id = String(body?.id || '').trim();
  const name = String(body?.name || 'Player').trim().slice(0, 24);
  if (!id || id.length > 80) return null;
  return { id, name, provider: String(body?.provider || 'local').slice(0, 20) };
}

function getMemberRole(club, userId) {
  const m = club.members?.find(x => x.id === userId);
  return m?.role || null;
}

function canManage(club, userId) {
  const role = getMemberRole(club, userId);
  return role === 'admin' || role === 'officer';
}

function isClubAdmin(club, userId) {
  if (!club || !userId) return false;
  if (String(club.adminId) === String(userId)) return true;
  return !!club.members?.some(m => String(m.id) === String(userId) && m.role === 'admin');
}

function normalizeClub(club, players) {
  if (!club) return null;
  if (!club.adminId) {
    const adm = club.members?.find(m => m.role === 'admin');
    if (adm) club.adminId = adm.id;
  }
  return {
    ...club,
    emoji: club.emoji || '🏆',
    members: (club.members || []).map(m => ({
      ...m,
      stars: players[m.id]?.totalStars || 0
    }))
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const action = req.query?.action || body.action;

  try {
    switch (action) {
      case 'sync': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        if (!user) return res.status(400).json({ error: 'Invalid user' });

        const players = await getPlayers();
        const existing = players[user.id] || {};
        players[user.id] = {
          ...existing,
          ...user,
          totalStars: body.totalStars ?? existing.totalStars ?? 0,
          maxLevel: body.maxLevel ?? existing.maxLevel ?? 1,
          uniqueCards: body.uniqueCards ?? existing.uniqueCards ?? 0,
          cards: body.cards ?? existing.cards ?? {},
          updatedAt: now()
        };
        const gifts = players[user.id]?.cardGifts || [];
        const clubId = players[user.id]?.clubId;
        if (clubId) {
          const clubs = await getClubs();
          const club = clubs[clubId];
          const member = club?.members?.find(m => m.id === user.id);
          if (member && user.name) member.name = user.name;
          if (club) await saveClubs(clubs);
        }
        await savePlayers(players);
        return res.status(200).json({ ok: true, cardGifts: gifts });
      }

      case 'leaderboard': {
        const players = await getPlayers();
        const rows = Object.values(players)
          .map(p => ({
            id: p.id,
            name: p.name,
            score: scoreOf(p),
            totalStars: p.totalStars || 0,
            maxLevel: p.maxLevel || 1
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 50);
        return res.status(200).json({ rows });
      }

      case 'search': {
        const q = String(req.query?.q || body.q || '').trim().toLowerCase();
        if (q.length < 2) return res.status(200).json({ players: [] });
        const players = await getPlayers();
        const playersList = Object.values(players)
          .filter(p => (p.name || '').toLowerCase().includes(q) || p.id.toLowerCase().includes(q))
          .slice(0, 20)
          .map(p => ({ id: p.id, name: p.name, clubId: p.clubId || null }));
        return res.status(200).json({ players: playersList });
      }

      case 'club_leaderboard': {
        const players = await getPlayers();
        const clubs = await getClubs();
        const rows = Object.values(clubs)
          .map((c) => {
            const teamStars = (c.members || []).reduce(
              (sum, m) => sum + (players[m.id]?.totalStars || 0),
              0
            );
            return {
              id: c.id,
              name: c.name,
              memberCount: c.members?.length || 0,
              teamStars,
              adminName: c.members?.find(m => m.id === c.adminId)?.name || 'Unknown'
            };
          })
          .sort((a, b) => b.teamStars - a.teamStars || b.memberCount - a.memberCount)
          .slice(0, 20);
        return res.status(200).json({ rows });
      }

      case 'club_view': {
        const clubId = String(req.query?.clubId || body.clubId || '').trim();
        if (!clubId) return res.status(400).json({ error: 'clubId required' });
        const players = await getPlayers();
        const clubs = await getClubs();
        const club = clubs[clubId];
        if (!club) return res.status(404).json({ error: 'Club not found' });
        const teamStars = (club.members || []).reduce(
          (sum, m) => sum + (players[m.id]?.totalStars || 0),
          0
        );
        return res.status(200).json({
          club: {
            id: club.id,
            name: club.name,
            adminId: club.adminId,
            memberCount: club.members?.length || 0,
            teamStars,
            members: (club.members || []).map(m => ({
              id: m.id,
              name: m.name,
              role: m.role,
              stars: players[m.id]?.totalStars || 0
            })),
            questProgress: club.questProgress || { pops: 0, wins: 0, stars: 0 }
          },
          teamQuests: TEAM_QUESTS
        });
      }

      case 'club_get': {
        const user = sanitizeUser({
          id: body.id || req.query?.id || req.query?.userId,
          name: body.name || req.query?.name,
          provider: body.provider || req.query?.provider
        });
        if (!user?.id) return res.status(400).json({ error: 'userId required' });
        const players = await getPlayers();
        const clubs = await getClubs();
        const player = players[user.id];
        let club = player?.clubId ? normalizeClub(clubs[player.clubId], players) : null;
        const pendingInvites = [];
        if (!player?.clubId) {
          for (const c of Object.values(clubs)) {
            if ((c.invites || []).some(i => i.id === user.id)) {
              pendingInvites.push({ clubId: c.id, clubName: c.name });
            }
          }
        }
        return res.status(200).json({ club, teamQuests: TEAM_QUESTS, player: player || null, pendingInvites });
      }

      case 'club_accept_invite': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const joinId = String(body.clubId || '').trim();
        if (!user || !joinId) return res.status(400).json({ error: 'Invalid request' });

        const players = await getPlayers();
        const clubs = await getClubs();
        const club = clubs[joinId];
        if (!club) return res.status(404).json({ error: 'Club not found' });
        if (players[user.id]?.clubId) return res.status(400).json({ error: 'Already in a club' });
        if (!(club.invites || []).some(i => i.id === user.id)) {
          return res.status(403).json({ error: 'No invite for this club' });
        }
        if (club.members.length >= 30) return res.status(400).json({ error: 'Club is full' });

        club.invites = (club.invites || []).filter(i => i.id !== user.id);
        club.members.push({ id: user.id, name: user.name, role: 'member', joinedAt: now() });
        players[user.id] = { ...(players[user.id] || {}), ...user, clubId: joinId, updatedAt: now() };
        await saveClubs(clubs);
        await savePlayers(players);
        return res.status(200).json({ ok: true, club });
      }

      case 'club_create': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const clubName = String(body.clubName || '').trim().slice(0, 24);
        if (!user || !clubName) return res.status(400).json({ error: 'Name and club name required' });

        const players = await getPlayers();
        const clubs = await getClubs();
        if (players[user.id]?.clubId) return res.status(400).json({ error: 'Already in a club' });

        const id = clubId();
        clubs[id] = {
          id,
          name: clubName,
          description: '',
          emoji: '🏆',
          joinMode: 'open',
          adminId: user.id,
          cardRequests: [],
          createdAt: now(),
          members: [{ id: user.id, name: user.name, role: 'admin', joinedAt: now() }],
          questProgress: { pops: 0, wins: 0, stars: 0 },
          invites: [],
          joinRequests: []
        };
        players[user.id] = { ...(players[user.id] || {}), ...user, clubId: id, updatedAt: now() };
        await saveClubs(clubs);
        await savePlayers(players);
        return res.status(200).json({ ok: true, club: clubs[id] });
      }

      case 'club_join': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const joinId = String(body.clubId || '').trim();
        if (!user || !joinId) return res.status(400).json({ error: 'Invalid request' });

        const players = await getPlayers();
        const clubs = await getClubs();
        const club = clubs[joinId];
        if (!club) return res.status(404).json({ error: 'Club not found' });
        if (players[user.id]?.clubId) return res.status(400).json({ error: 'Already in a club' });
        if (club.members.length >= 30) return res.status(400).json({ error: 'Club is full' });

        const joinMode = club.joinMode || 'open';
        if (joinMode === 'invite') {
          return res.status(403).json({ error: 'Invite-only club — accept an invite to join' });
        }
        if (joinMode === 'approval') {
          club.joinRequests = club.joinRequests || [];
          if (club.joinRequests.some(r => r.id === user.id)) {
            return res.status(400).json({ error: 'Join request already pending' });
          }
          club.joinRequests.push({ id: user.id, name: user.name, at: now() });
          await saveClubs(clubs);
          return res.status(200).json({ ok: true, pending: true });
        }

        club.members.push({ id: user.id, name: user.name, role: 'member', joinedAt: now() });
        players[user.id] = { ...(players[user.id] || {}), ...user, clubId: joinId, updatedAt: now() };
        await saveClubs(clubs);
        await savePlayers(players);
        return res.status(200).json({ ok: true, club });
      }

      case 'club_update': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const players = await getPlayers();
        const clubs = await getClubs();
        const club = clubs[players[user.id]?.clubId];
        if (!club || !isClubAdmin(club, user.id)) return res.status(403).json({ error: 'Admin only' });

        if (body.clubName !== undefined) {
          const clubName = String(body.clubName || '').trim().slice(0, 24);
          if (!clubName) return res.status(400).json({ error: 'Club name required' });
          club.name = clubName;
        }
        if (body.description !== undefined) {
          club.description = String(body.description || '').trim().slice(0, 120);
        }
        if (body.joinMode !== undefined) {
          const mode = ['open', 'invite', 'approval'].includes(body.joinMode) ? body.joinMode : 'open';
          club.joinMode = mode;
        }
        if (body.emoji !== undefined) {
          const emoji = String(body.emoji || '').trim().slice(0, 8);
          if (emoji) club.emoji = emoji;
        }
        await saveClubs(clubs);
        return res.status(200).json({ ok: true, club });
      }

      case 'club_approve_join': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const targetId = String(body.targetId || '').trim();
        const players = await getPlayers();
        const clubs = await getClubs();
        const club = clubs[players[user.id]?.clubId];
        if (!club || !canManage(club, user.id)) return res.status(403).json({ error: 'No permission' });
        if (club.members.length >= 30) return res.status(400).json({ error: 'Club is full' });
        const reqIdx = (club.joinRequests || []).findIndex(r => r.id === targetId);
        if (reqIdx < 0) return res.status(404).json({ error: 'No join request' });
        const reqUser = club.joinRequests[reqIdx];
        if (players[targetId]?.clubId) {
          club.joinRequests.splice(reqIdx, 1);
          await saveClubs(clubs);
          return res.status(400).json({ error: 'Player already in a club' });
        }
        club.joinRequests.splice(reqIdx, 1);
        club.members.push({
          id: targetId,
          name: players[targetId]?.name || reqUser.name,
          role: 'member',
          joinedAt: now()
        });
        players[targetId] = { ...(players[targetId] || {}), id: targetId, clubId: club.id, updatedAt: now() };
        await saveClubs(clubs);
        await savePlayers(players);
        return res.status(200).json({ ok: true, club });
      }

      case 'club_deny_join': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const targetId = String(body.targetId || '').trim();
        const players = await getPlayers();
        const clubs = await getClubs();
        const club = clubs[players[user.id]?.clubId];
        if (!club || !canManage(club, user.id)) return res.status(403).json({ error: 'No permission' });
        club.joinRequests = (club.joinRequests || []).filter(r => r.id !== targetId);
        await saveClubs(clubs);
        return res.status(200).json({ ok: true });
      }

      case 'club_kick': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const targetId = String(body.targetId || '').trim();
        const players = await getPlayers();
        const clubs = await getClubs();
        const club = clubs[players[user.id]?.clubId];
        if (!club || !isClubAdmin(club, user.id)) return res.status(403).json({ error: 'Admin only' });
        if (targetId === user.id || String(targetId) === String(club.adminId)) {
          return res.status(400).json({ error: 'Cannot remove this member' });
        }
        club.members = club.members.filter(m => m.id !== targetId);
        if (players[targetId]?.clubId === club.id) {
          players[targetId] = { ...players[targetId], clubId: null, updatedAt: now() };
          await savePlayers(players);
        }
        await saveClubs(clubs);
        return res.status(200).json({ ok: true, club });
      }

      case 'club_revoke_invite': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const targetId = String(body.targetId || '').trim();
        const players = await getPlayers();
        const clubs = await getClubs();
        const club = clubs[players[user.id]?.clubId];
        if (!club || !canManage(club, user.id)) return res.status(403).json({ error: 'No permission' });
        club.invites = (club.invites || []).filter(i => i.id !== targetId);
        await saveClubs(clubs);
        return res.status(200).json({ ok: true });
      }

      case 'club_leave': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const players = await getPlayers();
        const clubs = await getClubs();
        const clubId = players[user.id]?.clubId;
        const club = clubId ? clubs[clubId] : null;
        if (!club) return res.status(400).json({ error: 'Not in a club' });
        if (isClubAdmin(club, user.id)) {
          return res.status(400).json({ error: 'Admin cannot leave — remove members first or stay as leader' });
        }
        club.members = club.members.filter(m => m.id !== user.id);
        club.heartRequests = (club.heartRequests || []).filter(r => r.id !== user.id);
        players[user.id] = { ...players[user.id], clubId: null, updatedAt: now() };
        await saveClubs(clubs);
        await savePlayers(players);
        return res.status(200).json({ ok: true });
      }

      case 'club_invite': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const targetId = String(body.targetId || '').trim();
        if (!user || !targetId) return res.status(400).json({ error: 'Invalid request' });

        const players = await getPlayers();
        const clubs = await getClubs();
        const club = clubs[players[user.id]?.clubId];
        if (!club || !canManage(club, user.id)) return res.status(403).json({ error: 'No permission' });
        if (!players[targetId]) return res.status(404).json({ error: 'Player not found' });
        if (players[targetId].clubId) return res.status(400).json({ error: 'Player already in a club' });

        club.invites = club.invites || [];
        if (!club.invites.find(i => i.id === targetId)) {
          club.invites.push({ id: targetId, name: players[targetId].name, at: now() });
        }
        await saveClubs(clubs);
        return res.status(200).json({ ok: true });
      }

      case 'club_promote': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const targetId = String(body.targetId || '').trim();
        const role = body.role === 'officer' ? 'officer' : 'member';
        const players = await getPlayers();
        const clubs = await getClubs();
        const club = clubs[players[user.id]?.clubId];
        if (!club || !isClubAdmin(club, user.id)) return res.status(403).json({ error: 'Admin only' });
        const member = club.members.find(m => m.id === targetId);
        if (!member || member.role === 'admin') return res.status(400).json({ error: 'Invalid member' });
        member.role = role;
        await saveClubs(clubs);
        return res.status(200).json({ ok: true, club });
      }

      case 'club_quest': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const stat = String(body.stat || '');
        const amount = Number(body.amount) || 0;
        if (!user || !amount) return res.status(400).json({ error: 'Invalid' });

        const players = await getPlayers();
        const clubs = await getClubs();
        const club = clubs[players[user.id]?.clubId];
        if (!club) return res.status(400).json({ error: 'Not in a club' });

        club.questProgress = club.questProgress || { pops: 0, wins: 0, stars: 0 };
        if (['pops', 'wins', 'stars'].includes(stat)) {
          club.questProgress[stat] = (club.questProgress[stat] || 0) + amount;
        }
        await saveClubs(clubs);
        return res.status(200).json({ ok: true, questProgress: club.questProgress, teamQuests: TEAM_QUESTS });
      }

      case 'heart_send': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const targetId = String(body.targetId || '').trim();
        if (!user || !targetId || targetId === user.id) return res.status(400).json({ error: 'Invalid' });

        const players = await getPlayers();
        const sender = players[user.id] || {};
        const sentLog = sender.sentHearts || {};
        const last = sentLog[targetId] || 0;
        if (now() - last < LIMITS.HEART_SEND_COOLDOWN_MS) {
          return res.status(429).json({ error: 'Can send 1 heart every 3 hours' });
        }

        const inbox = await getInbox();
        inbox[targetId] = inbox[targetId] || [];
        inbox[targetId].push({ from: user.id, fromName: user.name, at: now() });
        sentLog[targetId] = now();
        players[user.id] = { ...sender, ...user, sentHearts: sentLog, updatedAt: now() };
        await saveInbox(inbox);
        await savePlayers(players);
        return res.status(200).json({ ok: true });
      }

      case 'heart_inbox': {
        const userId = String(req.query?.userId || body.userId || '').trim();
        if (!userId) return res.status(400).json({ error: 'userId required' });
        const inbox = await getInbox();
        const gifts = (inbox[userId] || []).filter(g => now() - g.at < 7 * 24 * 60 * 60 * 1000);
        return res.status(200).json({ gifts });
      }

      case 'heart_claim': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const userId = String(body.userId || '').trim();
        const index = Number(body.index);
        if (!userId) return res.status(400).json({ error: 'userId required' });
        const inbox = await getInbox();
        const gifts = inbox[userId] || [];
        if (index < 0 || index >= gifts.length) return res.status(400).json({ error: 'Invalid gift' });
        gifts.splice(index, 1);
        inbox[userId] = gifts;
        await saveInbox(inbox);
        return res.status(200).json({ ok: true, hearts: 1 });
      }

      case 'club_heart_request': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const players = await getPlayers();
        const clubs = await getClubs();
        const club = clubs[players[user.id]?.clubId];
        if (!club || !user) return res.status(400).json({ error: 'Not in a club' });
        const member = players[user.id] || {};
        if (member.lastHeartRequest && now() - member.lastHeartRequest < LIMITS.HEART_REQUEST_COOLDOWN_MS) {
          return res.status(429).json({ error: 'Heart request cooldown (3 hours)' });
        }
        club.heartRequests = club.heartRequests || [];
        club.heartRequests = club.heartRequests.filter(r => r.id !== user.id);
        club.heartRequests.push({ id: user.id, name: user.name, at: now() });
        players[user.id] = { ...member, ...user, lastHeartRequest: now(), updatedAt: now() };
        await saveClubs(clubs);
        await savePlayers(players);
        return res.status(200).json({ ok: true });
      }

      case 'club_heart_fulfill': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const targetId = String(body.targetId || '').trim();
        if (!user || !targetId || targetId === user.id) return res.status(400).json({ error: 'Invalid' });
        const players = await getPlayers();
        const clubs = await getClubs();
        const club = clubs[players[user.id]?.clubId];
        if (!club || !getMemberRole(club, user.id)) return res.status(403).json({ error: 'Not in club' });
        if (!club.members.some(m => m.id === targetId)) return res.status(400).json({ error: 'Not a club member' });
        const sender = players[user.id] || {};
        const sentLog = sender.sentHearts || {};
        if (sentLog[targetId] && now() - sentLog[targetId] < LIMITS.HEART_SEND_COOLDOWN_MS) {
          return res.status(429).json({ error: 'Send cooldown (3 hours)' });
        }
        const inbox = await getInbox();
        inbox[targetId] = inbox[targetId] || [];
        inbox[targetId].push({ from: user.id, fromName: user.name, at: now() });
        sentLog[targetId] = now();
        club.heartRequests = (club.heartRequests || []).filter(r => r.id !== targetId);
        players[user.id] = { ...sender, sentHearts: sentLog, updatedAt: now() };
        await saveInbox(inbox);
        await saveClubs(clubs);
        await savePlayers(players);
        return res.status(200).json({ ok: true });
      }

      case 'card_send': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const targetId = String(body.targetId || '').trim();
        const cardId = String(body.cardId || '').trim();
        if (!user || !targetId || !cardId) return res.status(400).json({ error: 'Invalid' });
        if (CODE_CARD_IDS.has(cardId)) return res.status(400).json({ error: 'Gold/code cards cannot be sent' });

        const players = await getPlayers();
        const sender = players[user.id] || {};
        const cards = body.cards || sender.cards || {};
        if ((cards[cardId] || 0) <= 1) return res.status(400).json({ error: 'Need more than 1 of this card' });

        cards[cardId]--;
        const target = players[targetId] || { id: targetId, name: 'Player' };
        target.cardGifts = target.cardGifts || [];
        target.cardGifts.push({ cardId, from: user.name, fromId: user.id, at: now() });

        players[user.id] = { ...sender, cards, updatedAt: now() };
        players[targetId] = { ...target, updatedAt: now() };
        await savePlayers(players);
        return res.status(200).json({ ok: true });
      }

      case 'card_request': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const cardId = String(body.cardId || '').trim();
        if (!user || !cardId) return res.status(400).json({ error: 'Invalid' });
        if (CODE_CARD_IDS.has(cardId)) return res.status(400).json({ error: 'Cannot request gold/code cards' });

        const players = await getPlayers();
        const clubs = await getClubs();
        const club = clubs[players[user.id]?.clubId];
        if (!club) return res.status(400).json({ error: 'Join a club to request cards' });

        const owned = (players[user.id]?.cards || {})[cardId] || 0;
        if (owned > 0) return res.status(400).json({ error: 'You already have this card' });

        club.cardRequests = club.cardRequests || [];
        club.cardRequests = club.cardRequests.filter(r => !(r.id === user.id && r.cardId === cardId));
        club.cardRequests.push({ id: user.id, name: user.name, cardId, at: now() });
        await saveClubs(clubs);
        return res.status(200).json({ ok: true });
      }

      case 'card_fulfill_request': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const user = sanitizeUser(body);
        const targetId = String(body.targetId || '').trim();
        const cardId = String(body.cardId || '').trim();
        if (!user || !targetId || !cardId) return res.status(400).json({ error: 'Invalid' });
        if (CODE_CARD_IDS.has(cardId)) return res.status(400).json({ error: 'Cannot send gold/code cards' });

        const players = await getPlayers();
        const clubs = await getClubs();
        const club = clubs[players[user.id]?.clubId];
        if (!club) return res.status(400).json({ error: 'Not in a club' });
        if (!club.members.some(m => m.id === targetId)) return res.status(400).json({ error: 'Not a club member' });

        const reqIdx = (club.cardRequests || []).findIndex(r => r.id === targetId && r.cardId === cardId);
        if (reqIdx < 0) return res.status(404).json({ error: 'No matching request' });

        const sender = players[user.id] || {};
        const cards = body.cards || sender.cards || {};
        if ((cards[cardId] || 0) <= 1) return res.status(400).json({ error: 'Need more than 1 of this card' });

        cards[cardId]--;
        const target = players[targetId] || { id: targetId, name: 'Player' };
        target.cardGifts = target.cardGifts || [];
        target.cardGifts.push({ cardId, from: user.name, fromId: user.id, at: now() });

        club.cardRequests.splice(reqIdx, 1);
        players[user.id] = { ...sender, cards, updatedAt: now() };
        players[targetId] = { ...target, updatedAt: now() };
        await saveClubs(clubs);
        await savePlayers(players);
        return res.status(200).json({ ok: true });
      }

      case 'card_claim': {
        if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
        const userId = String(body.userId || '').trim();
        if (!userId) return res.status(400).json({ error: 'userId required' });
        const players = await getPlayers();
        const player = players[userId];
        if (!player) return res.status(404).json({ error: 'Player not found' });
        const gifts = player.cardGifts || [];
        if (!gifts.length) return res.status(200).json({ ok: true, claimed: [] });

        const claimed = gifts.map(g => g.cardId);
        const tCards = player.cards || {};
        gifts.forEach((g) => {
          tCards[g.cardId] = (tCards[g.cardId] || 0) + 1;
        });
        player.cards = tCards;
        player.cardGifts = [];
        players[userId] = { ...player, updatedAt: now() };
        await savePlayers(players);
        return res.status(200).json({ ok: true, claimed, cards: tCards });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}