/**
 * Add this to your MemeTorrent / mod_futuret3ch_bot /start handler.
 * When a user opens t.me/mod_futuret3ch_bot?start=mtepop_<code>_<sig>
 * this calls MTE POP and replies with a finish-login link.
 *
 * Env vars on your bot server:
 *   MTEPOP_WEBHOOK_SECRET  — same value as TELEGRAM_WEBHOOK_SECRET on Vercel
 */

async function handleMtePopStart(ctx, startPayload) {
  const parsed = /^mtepop_([a-f0-9]+)_([a-f0-9]+)$/i.exec(startPayload || '');
  if (!parsed) return false;

  const [, code, sig] = parsed;
  const from = ctx.from || ctx.message?.from;
  if (!from?.id) return false;

  const secret = process.env.MTEPOP_WEBHOOK_SECRET;
  if (!secret) {
    await ctx.reply('MTE POP sign-in is not configured on the bot yet.');
    return true;
  }

  try {
    const res = await fetch('https://mte-pop.vercel.app/api/telegram/complete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-secret': secret
      },
      body: JSON.stringify({
        code,
        sig,
        id: from.id,
        username: from.username || '',
        first_name: from.first_name || '',
        last_name: from.last_name || ''
      })
    });

    const data = await res.json();
    if (!res.ok || !data.loginUrl) {
      await ctx.reply('Could not link MTE POP. Try again from the game.');
      return true;
    }

    await ctx.reply(data.message || 'MTE POP linked!', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Finish MTE POP sign-in', url: data.loginUrl }]]
      }
    });
  } catch (err) {
    console.error('MTE POP link failed:', err);
    await ctx.reply('Could not reach MTE POP. Try again in a moment.');
  }

  return true;
}

// In your existing /start handler, BEFORE the generic welcome:
// if (await handleMtePopStart(ctx, ctx.startPayload)) return;

module.exports = { handleMtePopStart };