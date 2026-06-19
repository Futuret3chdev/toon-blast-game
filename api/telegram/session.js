import crypto from 'crypto';
import { hmacSign } from '../_crypto.js';

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

  const bot = (process.env.TELEGRAM_BOT_USERNAME || 'mod_futuret3ch_bot').replace('@', '');
  const code = crypto.randomBytes(12).toString('hex');
  const sig = hmacSign(code, secret);

  res.status(200).json({
    code,
    sig,
    deepLink: `https://t.me/${bot}?start=mtepop_${code}_${sig}`
  });
}