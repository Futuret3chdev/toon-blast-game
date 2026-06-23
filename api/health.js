import { getStorageInfo } from './_data.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  try {
    const info = await getStorageInfo();
    res.status(200).json({
      ok: true,
      service: 'mte-pop',
      storage: info.mode,
      redisConfigured: info.hasEnv,
      redisPing: info.mode === 'redis'
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message || 'Health check failed' });
  }
}