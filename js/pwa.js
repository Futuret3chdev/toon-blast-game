const PWA = (() => {
  function init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js?v=44').catch(() => {});
    }
  }

  return { init };
})();