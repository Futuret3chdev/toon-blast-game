import { hmacSign, mintLoginToken } from '../_crypto.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'TELEGRAM_WEBHOOK_SECRET not configured on Vercel' });
    return;
  }

  const header = req.headers['x-telegram-secret'];
  if (header !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  const code = String(body.code || '').trim();
  const sig = String(body.sig || '').trim();
  const id = Number(body.id);

  if (!code || !sig || !id) {
    res.status(400).json({ error: 'Missing code, sig, or id' });
    return;
  }

  if (hmacSign(code, secret) !== sig) {
    res.status(401).json({ error: 'Invalid sign-in code' });
    return;
  }

  const user = {
    id,
    username: body.username || '',
    first_name: body.first_name || '',
    last_name: body.last_name || ''
  };

  const appUrl = process.env.MTEPOP_APP_URL || 'https://mte-pop.vercel.app';
  const loginToken = mintLoginToken(user, secret);
  const loginUrl = `${appUrl.replace(/\/$/, '')}/?tg_auth=${encodeURIComponent(loginToken)}`;

  res.status(200).json({
    ok: true,
    loginUrl,
    message: '✅ MTE POP linked! Tap the button below to finish sign-in.',
    user
  });
}