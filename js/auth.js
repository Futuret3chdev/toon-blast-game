const AuthManager = (() => {
  const SESSION_KEY = 'mtepop_session';
  const PROFILE_KEY = 'mtepop_profile';

  const DEFAULT_PROGRESS = {
    maxLevel: 1,
    stars: {},
    totalStars: 0,
    coins: 500,
    inventory: { bomb: 0, rocket_h: 0, disco: 0, extra_moves: 0 }
  };

  const DEFAULT_PROFILE = {
    name: 'Player',
    avatar: '😎',
    frame: '#6c5ce7',
    bio: ''
  };

  const AVATARS = ['😎', '🤩', '🥳', '😺', '🦊', '🐸', '🦄', '👾', '🤖', '👻', '🎮', '💎', '🔥', '⭐', '🌟'];
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
      return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_PROFILE };
    }
  }

  function saveProfile() {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }

  function progressKey() {
    return user ? `mtepop_save_${user.id}` : null;
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
      return { ...DEFAULT_PROGRESS, maxLevel: 1 };
    }

    try {
      const raw = localStorage.getItem(progressKey());
      const saved = raw ? JSON.parse(raw) : {};
      return {
        ...DEFAULT_PROGRESS,
        ...saved,
        stars: { ...DEFAULT_PROGRESS.stars, ...(saved.stars || {}) },
        inventory: { ...DEFAULT_PROGRESS.inventory, ...(saved.inventory || {}) },
        maxLevel: Math.max(1, saved.maxLevel || 1),
        coins: typeof saved.coins === 'number' ? saved.coins : DEFAULT_PROGRESS.coins,
        totalStars: saved.totalStars || 0
      };
    } catch {
      return { ...DEFAULT_PROGRESS };
    }
  }

  function saveProgress(data) {
    if (!isLoggedIn()) return;
    localStorage.setItem(progressKey(), JSON.stringify(data));
  }

  function setProfile(updates) {
    profile = { ...profile, ...updates };
    saveProfile();
    if (user) {
      user.name = profile.name;
      user.avatar = profile.avatar;
      saveSession();
    }
    dispatchAuthChange();
  }

  function signIn(account) {
    user = {
      id: account.id,
      provider: account.provider,
      name: account.name || profile.name,
      avatar: account.avatar || profile.avatar,
      email: account.email || null
    };
    profile.name = user.name;
    profile.avatar = user.avatar;
    saveSession();
    saveProfile();
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
    const avatars = { google: '🎮', facebook: '👤', x: '🐦' };
    const id = `${provider}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    signIn({
      id,
      provider,
      name: names[provider] || 'Player',
      avatar: avatars[provider] || '😎'
    });
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
    if (!appId || !window.FB) {
      demoSignIn('facebook');
      return;
    }
    FB.login((res) => {
      if (res.authResponse) {
        FB.api('/me', { fields: 'name,picture' }, (me) => {
          signIn({
            id: `facebook_${res.authResponse.userID}`,
            provider: 'facebook',
            name: me?.name || 'Facebook Player',
            avatar: profile.avatar
          });
        });
      }
    }, { scope: 'public_profile' });
  }

  function signInX() {
    const clientId = MTEPOP_CONFIG.xClientId;
    if (!clientId) {
      const handle = prompt('Enter your X @username to link (demo mode):', 'player');
      if (handle) {
        signIn({
          id: `x_${handle.replace('@', '')}`,
          provider: 'x',
          name: handle.startsWith('@') ? handle : `@${handle}`,
          avatar: profile.avatar
        });
      }
      return;
    }
    demoSignIn('x');
  }

  function signInGoogle() {
    if (MTEPOP_CONFIG.googleClientId && window.google?.accounts?.id) {
      google.accounts.id.prompt();
      return;
    }
    demoSignIn('google');
  }

  function inviteFriends() {
    const url = MTEPOP_CONFIG.appUrl;
    const text = `${MTEPOP_CONFIG.inviteMessage}\n${url}`;
    const title = MTEPOP_CONFIG.appName;

    if (navigator.share) {
      return navigator.share({ title, text, url }).catch(() => copyInvite(url, text));
    }
    return copyInvite(url, text);
  }

  async function copyInvite(url, text) {
    const full = `${text}`;
    try {
      await navigator.clipboard.writeText(full);
      return { copied: true, message: 'Invite link copied!' };
    } catch {
      return { copied: false, message: url };
    }
  }

  function getPlayLevel(progress) {
    return isLoggedIn() ? progress.maxLevel : 1;
  }

  function init() {
    profile = loadProfile();
    user = loadSession();
    if (user) {
      profile.name = user.name || profile.name;
      profile.avatar = user.avatar || profile.avatar;
    }

    window.handleGoogleCredential = (response) => {
      try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
        signIn({
          id: `google_${payload.sub}`,
          provider: 'google',
          name: payload.name,
          email: payload.email,
          avatar: profile.avatar
        });
      } catch {
        demoSignIn('google');
      }
    };

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
    AVATARS,
    FRAMES,
    DEFAULT_PROGRESS
  };
})();