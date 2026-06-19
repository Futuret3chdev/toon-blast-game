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
      maxLevel: Math.max(1, Math.min(typeof LEVELS !== 'undefined' ? LEVELS.length : 10, saved.maxLevel || 1)),
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
    let saved = readRawProgress(progressKey());
    if (!saved && !isLoggedIn()) {
      saved = readRawProgress(LEGACY_KEY);
      if (saved) {
        localStorage.setItem(GUEST_KEY, JSON.stringify(saved));
        localStorage.removeItem(LEGACY_KEY);
      }
    }
    return normalizeProgress(saved);
  }

  function saveProgress(data) {
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
  }

  function signOut() {
    user = null;
    saveSession();
    dispatchAuthChange();
  }

  function dispatchAuthChange() {
    document.dispatchEvent(new CustomEvent('mtepop:authchange', {
      detail: { user: getUser(), profile: getProfile() }
    }));
  }

  function demoSignIn(provider) {
    const names = { google: 'Google Player', facebook: 'Facebook Player', x: 'X Player' };
    const id = `${provider}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    signIn({
      id,
      provider,
      name: names[provider] || 'Player',
      avatar: profile.avatar || 'P'
    });
    return true;
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
            name: payload.name || 'Google Player',
            email: payload.email,
            avatar: profile.avatar
          });
        } catch {
          demoSignIn('google');
        }
      }
    });
  }

  function renderGoogleButton(container) {
    const clientId = MTEPOP_CONFIG.googleClientId;
    if (clientId && window.google?.accounts?.id) {
      container.innerHTML = '';
      google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: 280,
        text: 'signin_with',
        shape: 'pill'
      });
    }
  }

  function initFacebook() {
    const appId = MTEPOP_CONFIG.facebookAppId;
    if (!appId || !window.FB) return;
    FB.init({ appId, cookie: true, xfbml: false, version: 'v19.0' });
  }

  function signInFacebook() {
    const appId = MTEPOP_CONFIG.facebookAppId;
    if (!appId || !window.FB) return demoSignIn('facebook');
    return new Promise((resolve) => {
      FB.login((res) => {
        if (res.authResponse) {
          FB.api('/me', { fields: 'name,picture' }, (me) => {
            signIn({
              id: `facebook_${res.authResponse.userID}`,
              provider: 'facebook',
              name: me?.name || 'Facebook Player',
              avatar: profile.avatar
            });
            resolve(true);
          });
        } else resolve(false);
      }, { scope: 'public_profile' });
    });
  }

  function signInX(handle) {
    const clientId = MTEPOP_CONFIG.xClientId;
    if (!clientId) {
      const name = (handle || profile.name || 'player').replace('@', '').trim();
      if (!name) return false;
      signIn({
        id: `x_${name}`,
        provider: 'x',
        name: name.startsWith('@') ? name : `@${name}`,
        avatar: profile.avatar
      });
      return true;
    }
    return demoSignIn('x');
  }

  function signInGoogle() {
    if (MTEPOP_CONFIG.googleClientId && window.google?.accounts?.id) {
      google.accounts.id.prompt();
      return true;
    }
    return demoSignIn('google');
  }

  async function inviteFriends() {
    const url = (window.location.origin && window.location.origin !== 'null')
      ? window.location.origin + window.location.pathname
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
    return progress.maxLevel || 1;
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
      script.onload = initGoogle;
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
    signInX,
    renderGoogleButton,
    inviteFriends,
    getPlayLevel,
    avatarColor,
    AVATARS,
    FRAMES,
    DEFAULT_PROGRESS
  };
})();