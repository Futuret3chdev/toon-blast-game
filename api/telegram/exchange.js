import { verifyLoginToken } from '../_crypto.js';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) {
    res.status(503).json({ error: 'TELEGRAM_WEBHOOK_SECRET not configured on Vercel' });
    return;
  }

  const token = String(req.query?.token || '').trim();
  const user = verifyLoginToken(token, secret);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired login link' });
    return;
  }

  res.status(200).json({
    id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name
  });
}