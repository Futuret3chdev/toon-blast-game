const MEM = {
  players: {},
  clubs: {},
  heartInbox: {}
};

const KEYS = {
  players: 'mtepop:players',
  clubs: 'mtepop:clubs',
  inbox: 'mtepop:inbox'
};

let kvClient = null;
let kvChecked = false;

async function getKv() {
  if (kvChecked) return kvClient;
  kvChecked = true;
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    const { createClient } = await import('@upstash/redis');
    kvClient = createClient({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN
    });
    return kvClient;
  } catch {
    return null;
  }
}

async function loadKey(key, fallback) {
  const kv = await getKv();
  if (kv) {
    const val = await kv.get(key);
    return val ?? fallback;
  }
  if (key === KEYS.players) return MEM.players;
  if (key === KEYS.clubs) return MEM.clubs;
  if (key === KEYS.inbox) return MEM.heartInbox;
  return fallback;
}

async function saveKey(key, value) {
  const kv = await getKv();
  if (kv) {
    await kv.set(key, value);
    return;
  }
  if (key === KEYS.players) MEM.players = value;
  else if (key === KEYS.clubs) MEM.clubs = value;
  else if (key === KEYS.inbox) MEM.heartInbox = value;
}

export async function getPlayers() {
  return (await loadKey(KEYS.players, {})) || {};
}

export async function savePlayers(players) {
  await saveKey(KEYS.players, players);
}

export async function getClubs() {
  return (await loadKey(KEYS.clubs, {})) || {};
}

export async function saveClubs(clubs) {
  await saveKey(KEYS.clubs, clubs);
}

export async function getInbox() {
  return (await loadKey(KEYS.inbox, {})) || {};
}

export async function saveInbox(inbox) {
  await saveKey(KEYS.inbox, inbox);
}

export function clubId() {
  return 'club_' + Math.random().toString(36).slice(2, 10);
}

export function now() {
  return Date.now();
}

export const LIMITS = {
  HEART_MAX: 5,
  HEART_REGEN_MS: 30 * 60 * 1000,
  HEART_REFILL_COST: 100,
  HEART_SEND_COOLDOWN_MS: 3 * 60 * 60 * 1000,
  HEART_REQUEST_COOLDOWN_MS: 3 * 60 * 60 * 1000
};