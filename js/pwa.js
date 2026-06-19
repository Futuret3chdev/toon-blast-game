const PWA = (() => {
  const $ = id => document.getElementById(id);
  let deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }

  function show(el) {
    el?.classList.remove('hidden');
  }

  function hide(el) {
    el?.classList.add('hidden');
  }

  async function install() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      hide($('install-banner'));
      return outcome === 'accepted';
    }
    if (isIOS()) {
      show($('ios-install-hint'));
      return false;
    }
    return false;
  }

  function init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (!isStandalone()) show($('install-banner'));
    });

    $('install-btn')?.addEventListener('click', () => install());
    $('install-dismiss')?.addEventListener('click', () => hide($('install-banner')));
    $('ios-hint-close')?.addEventListener('click', () => hide($('ios-install-hint')));

    if (isStandalone()) {
      hide($('install-banner'));
      hide($('ios-install-hint'));
    } else if (isIOS()) {
      setTimeout(() => show($('ios-install-hint')), 2000);
    }

    window.addEventListener('appinstalled', () => {
      hide($('install-banner'));
      deferredPrompt = null;
    });
  }

  return { init, isStandalone, isIOS, isAndroid, install };
})();