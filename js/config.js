const MTEPOP_CONFIG = {
  appUrl: 'https://mte-pop.vercel.app',
  appName: 'MTE POP',
  inviteMessage: 'Join me on MTE POP — tap matching blocks to pop!',

  // OAuth — add your app credentials from each provider's developer console.
  // Redirect URI for Discord/X: https://mte-pop.vercel.app/auth/callback.html
  googleClientId: '',
  facebookAppId: '',
  xClientId: '',
  xClientSecret: '',
  discordClientId: '',
  // Public bot username only (no @). Safe to commit.
  telegramBotUsername: 'mod_futuret3ch_bot',
  // 'deeplink' = shared multi-game bot. 'widget' = Login Widget (needs exclusive /setdomain).
  telegramAuthMode: 'deeplink',
  // Token NEVER goes in this file. Set in Vercel → Project → Settings → Environment Variables:
  //   TELEGRAM_BOT_TOKEN       — from @BotFather
  //   TELEGRAM_WEBHOOK_SECRET  — any random string you invent; your bot sends it as x-telegram-secret
  // When your bot receives /start mtepop_<code>, POST to /api/telegram/complete with that header + { code, id, username, first_name }.

  // Demo sign-in fallback when IDs are empty (localhost only)
  demoAuth: false
};
