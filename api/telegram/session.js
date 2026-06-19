import crypto from 'crypto';
import { createSession } from '../_store.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const bot = (process.env.TELEGRAM_BOT_USERNAME || 'mod_futuret3ch_bot').replace('@', '');
  const code = crypto.randomBytes(12).toString('hex');
  createSession(code);

  res.status(200).json({
    code,
    deepLink: `https://t.me/${bot.replace('@', '')}?start=mtepop_${code}`
  });
}