/** Inline SVG icons for UI chrome */
const MTEIcons = {
  profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>',
  musicOn: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>',
  musicOff: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55A4 4 0 0 0 10 17v-4H6V3h6zm-1 14.05A4 4 0 0 0 8 17V7H4V3h2l10 10.05zM4.27 3L3 4.27 19.73 21 21 19.73 4.27 3z"/></svg>',
  soundOn: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.06A4.494 4.494 0 0 0 16.5 12zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>',
  soundOff: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12A4.494 4.494 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  map: '<svg viewBox="0 0 32 32" fill="none"><rect x="4" y="6" width="24" height="20" rx="4" fill="#74b9ff" stroke="#0984e3" stroke-width="2"/><path d="M8 22V12l6 4 4-6 6 8v4H8z" fill="#55efc4"/><circle cx="22" cy="11" r="2" fill="#fdcb6e"/></svg>',
  quests: '<svg viewBox="0 0 32 32" fill="none"><path d="M8 4h16l2 4v18a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8l2-4z" fill="#ffeaa7" stroke="#e17055" stroke-width="1.5"/><path d="M11 12h10M11 17h10M11 22h6" stroke="#6c5ce7" stroke-width="2" stroke-linecap="round"/><circle cx="24" cy="8" r="4" fill="#ff4757"/></svg>',
  shop: '<svg viewBox="0 0 32 32" fill="none"><path d="M6 10 4 6h24l-2 4" stroke="#a29bfe" stroke-width="2"/><path d="M6 10h20v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V10z" fill="#6c5ce7"/><path d="M12 14a4 4 0 0 0 8 0" stroke="#ffeaa7" stroke-width="2" stroke-linecap="round"/></svg>',
  cards: '<svg viewBox="0 0 32 32" fill="none"><rect x="6" y="8" width="14" height="18" rx="2" fill="#fd79a8" stroke="#e84393" stroke-width="1.5" transform="rotate(-8 13 17)"/><rect x="12" y="6" width="14" height="18" rx="2" fill="#74b9ff" stroke="#0984e3" stroke-width="1.5"/><circle cx="19" cy="14" r="3" fill="#ffeaa7"/></svg>',
  stickers: '<svg viewBox="0 0 32 32" fill="none"><path d="M16 3l3 6 6 .9-4.5 4.2 1 6.1L16 17.5 10.5 20.2l1-6.1L7 9.9l6-.9 3-6z" fill="#fdcb6e" stroke="#e17055" stroke-width="1.2"/><circle cx="24" cy="8" r="4" fill="#a29bfe" opacity=".85"/><circle cx="8" cy="24" r="3" fill="#55efc4" opacity=".85"/></svg>',
  ranks: '<svg viewBox="0 0 32 32" fill="none"><path d="M8 24V14l4 2V24H8zM14 24V10l4 2v12h-4zM20 24V6l4 2v16h-4z" fill="#fdcb6e" stroke="#e17055" stroke-width="1"/><rect x="6" y="24" width="20" height="3" rx="1" fill="#6c5ce7"/></svg>',
  club: '<svg viewBox="0 0 32 32" fill="none"><circle cx="11" cy="12" r="4" fill="#74b9ff"/><circle cx="21" cy="12" r="4" fill="#55efc4"/><circle cx="16" cy="9" r="4" fill="#a29bfe"/><path d="M6 26c0-4 3-6 5-6h10c2 0 5 2 5 6" fill="#6c5ce7"/></svg>',
  hearts: '<svg viewBox="0 0 32 32" fill="none"><path d="M16 27s-10-6.5-10-14a5.5 5.5 0 0 1 10-3 5.5 5.5 0 0 1 10 3c0 7.5-10 14-10 14z" fill="#ff4757" stroke="#c0392b" stroke-width="1.5"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M5 4H3v2a3 3 0 0 0 3 3M19 4h2v2a3 3 0 0 1-3 3"/></svg>',
  coin: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" opacity=".35"/><path d="M12 6v12M9 9h4.5a2.5 2.5 0 0 1 0 5H9m0-5h6m-6 5h5a2.5 2.5 0 0 0 0-5H9"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 18l-6-6 6-6"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  shopBomb: '<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="18" r="9" fill="#2d3436"/><path d="M16 9V5M19 7l2-2M13 7l-2-2" stroke="#636e72" stroke-width="2" stroke-linecap="round"/><circle cx="16" cy="18" r="5" fill="#ff4757" opacity=".6"/></svg>',
  shopRocket: '<svg viewBox="0 0 32 32" fill="none"><path d="M16 4c-3 6-3 12 0 18 2-1 5-4 6-8-1-4-3-7-6-10z" fill="#74b9ff" stroke="#0984e3" stroke-width="1.5"/><circle cx="16" cy="14" r="2" fill="#dfe6e9"/><path d="M12 24l-1 4 5-1M20 24l1 4-5-1" stroke="#fdcb6e" stroke-width="2" stroke-linecap="round"/></svg>',
  shopDisco: '<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="11" fill="url(#discoGrad)"/><circle cx="16" cy="16" r="4" fill="rgba(255,255,255,.6)"/><defs><radialGradient id="discoGrad"><stop offset="0%" stop-color="#ffeaa7"/><stop offset="50%" stop-color="#a29bfe"/><stop offset="100%" stop-color="#6c5ce7"/></radialGradient></defs></svg>',
  shopMoves: '<svg viewBox="0 0 32 32" fill="none"><path d="M18 5L8 16l10 11" stroke="#fdcb6e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 16h14" stroke="#55efc4" stroke-width="3" stroke-linecap="round"/></svg>',
  shopHearts: '<svg viewBox="0 0 32 32" fill="none"><path d="M16 26s-9-5.5-9-12a4.5 4.5 0 0 1 8-2.5 4.5 4.5 0 0 1 8 2.5c0 6.5-9 12-9 12z" fill="#ff4757"/><text x="16" y="18" text-anchor="middle" fill="#fff" font-size="10" font-weight="700" font-family="Fredoka,sans-serif">+5</text></svg>'
};

function injectHubIcons() {
  document.querySelectorAll('[data-hub-icon]').forEach((el) => {
    const key = el.dataset.hubIcon;
    if (MTEIcons[key]) el.innerHTML = MTEIcons[key];
  });
}