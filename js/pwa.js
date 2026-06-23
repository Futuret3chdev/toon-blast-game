const PWA = (() => {
  function init() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js?v=26').catch(() => {});
    }
  }

  return { init };
})();