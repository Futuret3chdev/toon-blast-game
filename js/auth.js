const AuthManager = (() => {
  const SESSION_KEY = 'mtepop_session';
  const PROFILE_KEY = 'mtepop_profile';
  const GUEST_KEY = 'mtepop_progress';
  const LEGACY_KEY = 'toonblast_progress';

  const DEFAULT_PROGRESS = {
    maxLevel: 1,
    stars: {},
    totalStars: 0,
    coins: 500,
    inventory: { bomb: 0, rocket_h: 0, disco: 0, extra_moves: 0 }
  };

  const DEFAULT_PROFILE = {
    name: 'Player',
    avatar: 'P',
    frame: '#6c5ce7',
    bio: ''
  };

  const AVATARS = ['P', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N'];
  const AVATAR_COLORS = ['#6c5ce7', '#00b894', '#0984e3', '#d63031', '#fdcb6e', '#fd79a8', '#a29bfe', '#2d3436'];
  const FRAMES = ['#6c5ce7', '#00b894', '#d63031', '#0984e3', '#fdcb6e', '#fd79a8', '#2d3436', '#a29bfe'];

  let user = null;
  let profile = { ...DEFAULT_PROFILE };

  function loadSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSession() {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  }

  function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_KEY);
      if (!raw) return { ...DEFAULT_PROFILE };
      const parsed = { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
      if (parsed.avatar && parsed.avatar.length > 2) parsed.avatar = parsed.avatar.charAt(0).toUpperCase();
      return parsed;
    } catch {
      return { ...DEFAULT_PROFILE };
    }
  }

  function saveProfile() {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  function progressKey() {
    return user ? `mtepop_save_${user.id}` : GUEST_KEY;
  }

  function readRawProgress(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function normalizeProgress(saved) {
    if (!saved) return { ...DEFAULT_PROGRESS };
    return {
      ...DEFAULT_PROGRESS,
      ...saved,
      stars: { ...DEFAULT_PROGRESS.stars, ...(saved.stars || {}) },
      inventory: { ...DEFAULT_PROGRESS.inventory, ...(saved.inventory || {}) },
      maxLevel: Math.max(1, Math.min(typeof LEVELS !== 'undefined' ? LEVELS.length : 50, saved.maxLevel || 1)),
      coins: typeof saved.coins === 'number' ? saved.coins : DEFAULT_PROGRESS.coins,
      totalStars: saved.totalStars || 0
    };
  }

  function mergeProgress(a, b) {
    const merged = normalizeProgress(a);
    const other = normalizeProgress(b);
    merged.maxLevel = Math.max(merged.maxLevel, other.maxLevel);
    merged.coins = Math.max(merged.coins, other.coins);
    merged.totalStars = Math.max(merged.totalStars, other.totalStars);
    Object.keys(other.stars).forEach((lvl) => {
      const n = Number(lvl);
      merged.stars[n] = Math.max(merged.stars[n] || 0, other.stars[n] || 0);
    });
    Object.keys(other.inventory).forEach((k) => {
      merged.inventory[k] = Math.max(merged.inventory[k] || 0, other.inventory[k] || 0);
    });
    return merged;
  }

  function isLoggedIn() {
    return !!user;
  }

  function getUser() {
    return user ? { ...user } : null;
  }

  function getProfile() {
    return { ...profile };
  }

  function loadProgress() {
    if (!isLoggedIn()) {
      return { ...DEFAULT_PROGRESS };
    }
    let saved = readRawProgress(progressKey());
    if (!saved) {
      const legacy = readRawProgress(LEGACY_KEY) || readRawProgress(GUEST_KEY);
      if (legacy) {
        saved = legacy;
        saveProgress(normalizeProgress(legacy));
        localStorage.removeItem(LEGACY_KEY);
        localStorage.removeItem(GUEST_KEY);
      }
    }
    return normalizeProgress(saved);
  }

  function saveProgress(data) {
    if (!isLoggedIn()) return;
    localStorage.setItem(progressKey(), JSON.stringify(data));
  }

  function setProfile(updates) {
    profile = { ...profile, ...updates };
    if (profile.avatar) profile.avatar = profile.avatar.charAt(0).toUpperCase();
    saveProfile();
    if (user) {
      user.name = profile.name;
      user.avatar = profile.avatar;
      saveSession();
    }
    dispatchAuthChange();
  }

  function signIn(account) {
    const guestProgress = readRawProgress(GUEST_KEY);
    user = {
      id: account.id,
      provider: account.provider,
      name: account.name || profile.name,
      avatar: (account.avatar || profile.avatar).charAt(0).toUpperCase(),
      email: account.email || null
    };
    profile.name = user.name;
    profile.avatar = user.avatar;
    saveSession();
    saveProfile();

    const existing = readRawProgress(progressKey());
    const merged = mergeProgress(existing, guestProgress);
    saveProgress(merged);
    dispatchAuthChange();
    return true;
  }

  function signOut() {
    user = null;
    saveSession();
    localStorage.removeItem(GUEST_KEY);
    dispatchAuthChange();
  }

  function dispatchAuthChange() {
    document.dispatchEvent(new CustomEvent('mtepop:authchange', {
      detail: { user: getUser(), profile: getProfile() }
    }));
  }

  function allowDemo() {
    if (MTEPOP_CONFIG.demoAuth) return true;
    const host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  function demoSignIn(provider) {
    if (!allowDemo()) return { ok: false, error: `${provider} sign-in is not configured yet` };
    const names = {
      google: 'Google Player',
      facebook: 'Facebook Player',
      x: 'X Player',
      discord: 'Discord Player',
      telegram: 'Telegram Player'
    };
    const id = `${provider}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    signIn({
      id,
      provider,
      name: names[provider] || 'Player',
      avatar: profile.avatar || 'P'
    });
    return { ok: true };
  }

  function initGoogle() {
    const clientId = MTEPOP_CONFIG.googleClientId;
    if (!clientId || !window.google?.accounts?.id) return;

    google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        try {
          const payload = JSON.parse(atob(response.credential.split('.')[1]));
          signIn({
            id: `google_${payload.sub}`,
            provider: 'google',
            name: payload.name || payload.given_name || 'Google Player',
            email: payload.email,
            avatar: (payload.given_name || payload.name || 'G').charAt(0).toUpperCase()
          });
        } catch {
          console.warn('Google credential parse failed');
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true
    });
  }

  function renderGoogleButton(container) {
    if (!container) return;
    const clientId = MTEPOP_CONFIG.googleClientId;
    const customBtn = document.getElementById('login-google');

    if (clientId && window.google?.accounts?.id) {
      if (customBtn) customBtn.classList.add('hidden');
      container.innerHTML = '';
      google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: Math.min(320, container.clientWidth || 320),
        text: 'signup_with',
        shape: 'pill',
        logo_alignment: 'left'
      });
    } else {
      container.innerHTML = '';
      if (customBtn) customBtn.classList.remove('hidden');
    }
  }

  function initFacebook() {
    const appId = MTEPOP_CONFIG.facebookAppId;
    if (!appId || !window.FB) return;
    FB.init({ appId, cookie: true, xfbml: false, version: 'v19.0' });
  }

  async function signInFacebook() {
    const appId = MTEPOP_CONFIG.facebookAppId;
    if (!appId || !window.FB) return demoSignIn('facebook');

    return new Promise((resolve) => {
      FB.login((res) => {
        if (!res.authResponse) {
          resolve({ ok: false, error: 'Facebook sign-in cancelled' });
          return;
        }
        FB.api('/me', { fields: 'name,picture' }, (me) => {
          if (!me?.id) {
            resolve({ ok: false, error: 'Could not load Facebook profile' });
            return;
          }
          signIn({
            id: `facebook_${me.id}`,
            provider: 'facebook',
            name: me.name || 'Facebook Player',
            avatar: (me.name || 'F').charAt(0).toUpperCase()
          });
          resolve({ ok: true });
        });
      }, { scope: 'public_profile,email' });
    });
  }

  async function signInGoogle() {
    const clientId = MTEPOP_CONFIG.googleClientId;
    if (clientId && window.google?.accounts?.id) {
      google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          const container = document.getElementById('google-btn-container');
          if (container && !container.children.length) renderGoogleButton(container);
        }
      });
      return { ok: true, pending: true };
    }
    return demoSignIn('google');
  }

  async function signInXOAuth() {
    const clientId = MTEPOP_CONFIG.xClientId;
    if (!clientId) return { ok: false, needsHandle: true };

    try {
      const { verifier, challenge } = await OAuthHelper.createPkce();
      const state = OAuthHelper.randomString(16);
      sessionStorage.setItem('mtepop_oauth_provider', 'x');
      sessionStorage.setItem(`mtepop_pkce_${state}`, verifier);

      const redirect = encodeURIComponent(OAuthHelper.redirectUri());
      const scope = encodeURIComponent('users.read tweet.read offline.access');
      const url = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${redirect}&scope=${scope}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;

      const result = await OAuthHelper.openPopup(url, state);
      const verifierStored = sessionStorage.getItem(`mtepop_pkce_${state}`);
      sessionStorage.removeItem(`mtepop_pkce_${state}`);

      const token = await OAuthHelper.exchangeXCode(result.code, verifierStored);
      const meRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const meData = await meRes.json();
      const me = meData.data;
      if (!me?.id) throw new Error('Could not load X profile');

      signIn({
        id: `x_${me.id}`,
        provider: 'x',
        name: me.name || `@${me.username}`,
        avatar: (me.name || me.username || 'X').charAt(0).toUpperCase()
      });
      return { ok: true };
    } catch (err) {
      if (err.message === 'Sign-in cancelled') return { ok: false, error: 'Cancelled' };
      return { ok: false, error: err.message || 'X sign-in failed' };
    }
  }

  function signInXHandle(handle) {
    const name = (handle || '').replace('@', '').trim();
    if (!name) return { ok: false, error: 'Enter a username' };

    if (MTEPOP_CONFIG.xClientId) {
      return { ok: false, error: 'Use Continue with X for official sign-in' };
    }

    if (!allowDemo()) {
      return { ok: false, error: 'X sign-in is not configured yet' };
    }

    signIn({
      id: `x_${name.toLowerCase()}`,
      provider: 'x',
      name: name.startsWith('@') ? name : `@${name}`,
      avatar: name.charAt(0).toUpperCase()
    });
    return { ok: true };
  }

  async function signInDiscord() {
    const clientId = MTEPOP_CONFIG.discordClientId;
    if (!clientId) return demoSignIn('discord');

    try {
      const { verifier, challenge } = await OAuthHelper.createPkce();
      const state = OAuthHelper.randomString(16);
      sessionStorage.setItem('mtepop_oauth_provider', 'discord');
      sessionStorage.setItem(`mtepop_pkce_${state}`, verifier);

      const redirect = encodeURIComponent(OAuthHelper.redirectUri());
      const url = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${redirect}&response_type=code&scope=identify&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;

      const result = await OAuthHelper.openPopup(url, state);
      const verifierStored = sessionStorage.getItem(`mtepop_pkce_${state}`);
      sessionStorage.removeItem(`mtepop_pkce_${state}`);

      const token = await OAuthHelper.exchangeDiscordCode(result.code, verifierStored);
      const meRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const me = await meRes.json();
      if (!me?.id) throw new Error('Could not load Discord profile');

      signIn({
        id: `discord_${me.id}`,
        provider: 'discord',
        name: me.global_name || me.username || 'Discord Player',
        avatar: (me.global_name || me.username || 'D').charAt(0).toUpperCase()
      });
      return { ok: true };
    } catch (err) {
      if (err.message === 'Sign-in cancelled') return { ok: false, error: 'Cancelled' };
      return { ok: false, error: err.message || 'Discord sign-in failed' };
    }
  }

  function signInTelegramUser(tgUser) {
    if (!tgUser?.id) return { ok: false, error: 'Invalid Telegram user' };
    const name = [tgUser.first_name, tgUser.last_name].filter(Boolean).join(' ') || tgUser.username || 'Telegram Player';
    signIn({
      id: `telegram_${tgUser.id}`,
      provider: 'telegram',
      name: tgUser.username ? `@${tgUser.username}` : name,
      avatar: (tgUser.username || name).replace('@', '').charAt(0).toUpperCase()
    });
    document.dispatchEvent(new CustomEvent('mtepop:telegramauth', { detail: { ok: true } }));
    return { ok: true };
  }

  function onTelegramAuth(tgUser) {
    signInTelegramUser(tgUser);
  }

  async function tryTelegramWebAppAuth() {
    const initData = window.Telegram?.WebApp?.initData;
    if (!initData) return { ok: false, error: 'Not in Telegram' };

    try {
      const res = await fetch('/api/telegram/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData })
      });
      if (!res.ok) return { ok: false, error: 'Telegram verify failed' };
      const user = await res.json();
      return signInTelegramUser(user);
    } catch {
      return { ok: false, error: 'Telegram verify failed' };
    }
  }

  async function startTelegramDeepLink() {
    const bot = MTEPOP_CONFIG.telegramBotUsername?.replace('@', '');
    if (!bot) return { ok: false, error: 'Telegram bot not configured' };

    try {
      const res = await fetch('/api/telegram/session', { method: 'POST' });
      if (!res.ok) return { ok: false, error: 'Could not start Telegram sign-in' };
      const data = await res.json();
      return {
        ok: true,
        code: data.code,
        deepLink: data.deepLink || `https://t.me/${bot}?start=mtepop_${data.code}`
      };
    } catch {
      return { ok: false, error: 'Could not start Telegram sign-in' };
    }
  }

  async function exchangeTelegramLoginToken(token) {
    if (!token) return { ok: false, error: 'Missing login token' };
    try {
      const res = await fetch(`/api/telegram/exchange?token=${encodeURIComponent(token)}`);
      if (!res.ok) return { ok: false, error: 'Login link expired — try again from the game' };
      const user = await res.json();
      return signInTelegramUser(user);
    } catch {
      return { ok: false, error: 'Could not finish Telegram sign-in' };
    }
  }

  function renderTelegramWidget(container) {
    if (!container) return;
    container.innerHTML = '';

    const bot = MTEPOP_CONFIG.telegramBotUsername;
    const mode = MTEPOP_CONFIG.telegramAuthMode || 'deeplink';
    if (!bot || mode !== 'widget') {
      container.classList.add('hidden');
      return;
    }

    container.classList.remove('hidden');
    window.onTelegramAuth = onTelegramAuth;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', bot.replace('@', ''));
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    container.appendChild(script);
  }

  function isProviderConfigured(provider) {
    const cfg = MTEPOP_CONFIG;
    switch (provider) {
      case 'google': return !!cfg.googleClientId;
      case 'facebook': return !!cfg.facebookAppId;
      case 'x': return !!cfg.xClientId || allowDemo();
      case 'discord': return !!cfg.discordClientId || allowDemo();
      case 'telegram': return !!cfg.telegramBotUsername;
      default: return false;
    }
  }

  async function inviteFriends() {
    const url = (window.location.origin && window.location.origin !== 'null' && !window.location.origin.startsWith('file'))
      ? window.location.origin + (window.location.pathname || '/')
      : (MTEPOP_CONFIG.appUrl || window.location.href);
    const text = `${MTEPOP_CONFIG.inviteMessage}\n${url}`;
    const title = MTEPOP_CONFIG.appName;

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return { copied: false, message: 'Invite shared!' };
      } catch (err) {
        if (err?.name === 'AbortError') {
          return { copied: false, message: 'Share cancelled' };
        }
      }
    }
    return copyInvite(url, text);
  }

  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* noop */ }
    document.body.removeChild(ta);
    return ok;
  }

  async function copyInvite(url, text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return { copied: true, message: 'Invite link copied!' };
      }
    } catch { /* fallback below */ }
    if (legacyCopy(text)) {
      return { copied: true, message: 'Invite link copied!' };
    }
    return { copied: false, message: `Share this link: ${url}` };
  }

  function getPlayLevel(progress) {
    if (!isLoggedIn()) return 1;
    return progress.maxLevel || 1;
  }

  function signInTelegramHandle(handle) {
    const name = (handle || '').replace('@', '').trim();
    if (!name) return { ok: false, error: 'Enter your Telegram username' };

    signIn({
      id: `telegram_${name.toLowerCase()}`,
      provider: 'telegram',
      name: `@${name}`,
      avatar: name.charAt(0).toUpperCase()
    });
    return { ok: true };
  }

  function avatarColor(letter) {
    const code = (letter || 'P').charCodeAt(0);
    return AVATAR_COLORS[code % AVATAR_COLORS.length];
  }

  function init() {
    profile = loadProfile();
    user = loadSession();
    if (user) {
      profile.name = user.name || profile.name;
      profile.avatar = (user.avatar || profile.avatar).charAt(0).toUpperCase();
    }

    if (MTEPOP_CONFIG.googleClientId) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initGoogle();
        renderGoogleButton(document.getElementById('google-btn-container'));
      };
      document.head.appendChild(script);
    }

    if (MTEPOP_CONFIG.facebookAppId) {
      window.fbAsyncInit = initFacebook;
      const script = document.createElement('script');
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    renderTelegramWidget(document.getElementById('telegram-login-container'));
    dispatchAuthChange();
  }

  return {
    init,
    isLoggedIn,
    getUser,
    getProfile,
    loadProgress,
    saveProgress,
    setProfile,
    signIn,
    signOut,
    signInGoogle,
    signInFacebook,
    signInXOAuth,
    signInXHandle,
    signInTelegramHandle,
    signInTelegramUser,
    tryTelegramWebAppAuth,
    startTelegramDeepLink,
    exchangeTelegramLoginToken,
    signInDiscord,
    renderGoogleButton,
    renderTelegramWidget,
    isProviderConfigured,
    inviteFriends,
    getPlayLevel,
    avatarColor,
    AVATARS,
    FRAMES,
    DEFAULT_PROGRESS
  };
})();