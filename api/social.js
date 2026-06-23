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
        await savePlayers(players);
        return res.status(200).json({ ok: true });
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
        const club = player?.clubId ? clubs[player.clubId] : null;
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
          adminId: user.id,
          createdAt: now(),
          members: [{ id: user.id, name: user.name, role: 'admin', joinedAt: now() }],
          questProgress: { pops: 0, wins: 0, stars: 0 },
          invites: []
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

        club.members.push({ id: user.id, name: user.name, role: 'member', joinedAt: now() });
        players[user.id] = { ...(players[user.id] || {}), ...user, clubId: joinId, updatedAt: now() };
        await saveClubs(clubs);
        await savePlayers(players);
        return res.status(200).json({ ok: true, club });
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
        if (!club || club.adminId !== user.id) return res.status(403).json({ error: 'Admin only' });
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
        if ((cards[cardId] || 0) < 2) return res.status(400).json({ error: 'Need duplicate card' });

        cards[cardId]--;
        const target = players[targetId] || { id: targetId, name: 'Player' };
        const tCards = target.cards || {};
        tCards[cardId] = (tCards[cardId] || 0) + 1;
        target.cards = tCards;
        target.cardGifts = target.cardGifts || [];
        target.cardGifts.push({ cardId, from: user.name, at: now() });

        players[user.id] = { ...sender, cards, updatedAt: now() };
        players[targetId] = { ...target, updatedAt: now() };
        await savePlayers(players);
        return res.status(200).json({ ok: true });
      }

      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}