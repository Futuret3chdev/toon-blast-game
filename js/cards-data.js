const CARD_SETS = {
  meadow: { name: 'Sunny Meadow', color: '#55efc4' },
  castle: { name: 'Royal Castle', color: '#a29bfe' },
  ocean:  { name: 'Ocean Cove', color: '#74b9ff' },
  volcano:{ name: 'Volcano Peak', color: '#ff7675' }
};

const NORMAL_CARDS = [
  { id: 'c_meadow_01', set: 'meadow', name: 'Sun Sprout', emoji: '🌱', rarity: 'common' },
  { id: 'c_meadow_02', set: 'meadow', name: 'Busy Bee', emoji: '🐝', rarity: 'common' },
  { id: 'c_meadow_03', set: 'meadow', name: 'Meadow Fox', emoji: '🦊', rarity: 'uncommon' },
  { id: 'c_meadow_04', set: 'meadow', name: 'Rainbow', emoji: '🌈', rarity: 'uncommon' },
  { id: 'c_meadow_05', set: 'meadow', name: 'Golden Sun', emoji: '☀️', rarity: 'rare' },
  { id: 'c_meadow_06', set: 'meadow', name: 'Butterfly', emoji: '🦋', rarity: 'common' },
  { id: 'c_castle_01', set: 'castle', name: 'Castle Gate', emoji: '🏰', rarity: 'common' },
  { id: 'c_castle_02', set: 'castle', name: 'Royal Crown', emoji: '👑', rarity: 'uncommon' },
  { id: 'c_castle_03', set: 'castle', name: 'Magic Wand', emoji: '🪄', rarity: 'uncommon' },
  { id: 'c_castle_04', set: 'castle', name: 'Crystal Ball', emoji: '🔮', rarity: 'rare' },
  { id: 'c_castle_05', set: 'castle', name: 'Knight Shield', emoji: '🛡️', rarity: 'common' },
  { id: 'c_castle_06', set: 'castle', name: 'Dragon Egg', emoji: '🥚', rarity: 'rare' },
  { id: 'c_ocean_01', set: 'ocean', name: 'Wave Rider', emoji: '🌊', rarity: 'common' },
  { id: 'c_ocean_02', set: 'ocean', name: 'Starfish', emoji: '⭐', rarity: 'common' },
  { id: 'c_ocean_03', set: 'ocean', name: 'Dolphin', emoji: '🐬', rarity: 'uncommon' },
  { id: 'c_ocean_04', set: 'ocean', name: 'Treasure Chest', emoji: '💎', rarity: 'rare' },
  { id: 'c_ocean_05', set: 'ocean', name: 'Anchor', emoji: '⚓', rarity: 'common' },
  { id: 'c_ocean_06', set: 'ocean', name: 'Pearl Shell', emoji: '🐚', rarity: 'uncommon' },
  { id: 'c_volcano_01', set: 'volcano', name: 'Lava Rock', emoji: '🪨', rarity: 'common' },
  { id: 'c_volcano_02', set: 'volcano', name: 'Fire Spirit', emoji: '🔥', rarity: 'uncommon' },
  { id: 'c_volcano_03', set: 'volcano', name: 'Phoenix', emoji: '🦅', rarity: 'rare' },
  { id: 'c_volcano_04', set: 'volcano', name: 'Magma Gem', emoji: '💥', rarity: 'uncommon' },
  { id: 'c_volcano_05', set: 'volcano', name: 'Volcano', emoji: '🌋', rarity: 'common' },
  { id: 'c_volcano_06', set: 'volcano', name: 'Meteor', emoji: '☄️', rarity: 'rare' }
];

const CODE_CARDS = [
  { id: 'code_sunny', name: 'Sunny Code', emoji: '🌞', code: 'MTE-SUNNY-7K2P', set: 'meadow' },
  { id: 'code_bloom', name: 'Bloom Code', emoji: '🌸', code: 'MTE-BLOOM-4R9X', set: 'meadow' },
  { id: 'code_royal', name: 'Royal Code', emoji: '👑', code: 'MTE-ROYAL-3M8Q', set: 'castle' },
  { id: 'code_magic', name: 'Magic Code', emoji: '✨', code: 'MTE-MAGIC-9L1W', set: 'castle' },
  { id: 'code_tide', name: 'Tide Code', emoji: '🌊', code: 'MTE-TIDE-6H5N', set: 'ocean' },
  { id: 'code_pearl', name: 'Pearl Code', emoji: '💠', code: 'MTE-PEARL-2J7V', set: 'ocean' },
  { id: 'code_blaze', name: 'Blaze Code', emoji: '🔥', code: 'MTE-BLAZE-8F3C', set: 'volcano' },
  { id: 'code_pop', name: 'POP Legend', emoji: '🎉', code: 'MTE-POP-LEGEND', set: 'volcano' }
];

const STICKER_SET_DEFS = {
  meadow: {
    names: ['Sun Sprout', 'Daisy', 'Busy Bee', 'Butterfly', 'Rainbow', 'Meadow Fox', 'Honey Pot', 'Ladybug', 'Tulip', 'Clover', 'Mushroom', 'Bird Nest', 'Watering Can', 'Garden Gnome', 'Wildflower', 'Sunbeam', 'Golden Bloom', 'Meadow Crown', 'Eternal Spring', 'Meadow Legend'],
    symbols: ['🌱', '🌼', '🐝', '🦋', '🌈', '🦊', '🍯', '🐞', '🌷', '☘️', '🍄', '🪺', '🚿', '🧙', '💐', '✨', '🌟', '👑', '🌞', '🏆']
  },
  castle: {
    names: ['Castle Gate', 'Royal Flag', 'Magic Wand', 'Crystal Ball', 'Knight Helm', 'Dragon Scale', 'Royal Crown', 'Treasure Key', 'Stone Tower', 'Drawbridge', 'Royal Feast', 'Enchanted Book', 'Silver Chalice', 'War Banner', 'Mystic Orb', 'Starlit Hall', 'Golden Throne', 'Royal Scepter', 'Ancient Seal', 'Castle Legend'],
    symbols: ['🏰', '🚩', '🪄', '🔮', '⛑️', '🐉', '👑', '🗝️', '🗼', '🌉', '🍽️', '📖', '🏆', '🎌', '🔯', '✨', '🌟', '⚜️', '💠', '🏅']
  },
  ocean: {
    names: ['Wave Rider', 'Starfish', 'Dolphin', 'Anchor', 'Pearl Shell', 'Coral Reef', 'Sea Turtle', 'Jellyfish', 'Compass', 'Sailboat', 'Treasure Map', 'Lighthouse', 'Seahorse', 'Message Bottle', 'Sand Castle', 'Moon Tide', 'Golden Pearl', 'Ocean Crown', 'Deep Treasure', 'Ocean Legend'],
    symbols: ['🌊', '⭐', '🐬', '⚓', '🐚', '🪸', '🐢', '🪼', '🧭', '⛵', '🗺️', '🗼', '🦄', '🍾', '🏖️', '🌙', '💎', '👑', '🏴‍☠️', '🏆']
  },
  volcano: {
    names: ['Lava Rock', 'Fire Spirit', 'Magma Gem', 'Volcano', 'Meteor', 'Ember Fox', 'Ash Cloud', 'Molten Core', 'Flame Torch', 'Obsidian', 'Fire Flower', 'Heat Wave', 'Spark Shower', 'Magma Flow', 'Cinder Trail', 'Blazing Peak', 'Golden Ember', 'Flame Crown', 'Phoenix Rise', 'Volcano Legend'],
    symbols: ['🪨', '🔥', '💥', '🌋', '☄️', '🦊', '☁️', '🔴', '🔦', '⬛', '🌺', '🌡️', '✨', '🌊', '💨', '⛰️', '🌟', '👑', '🦅', '🏆']
  }
};

function buildStickerSets() {
  const stickers = [];
  Object.entries(STICKER_SET_DEFS).forEach(([setKey, def]) => {
    def.names.forEach((name, i) => {
      const slot = i + 1;
      stickers.push({
        id: `st_${setKey}_${String(slot).padStart(2, '0')}`,
        set: setKey,
        name,
        symbol: def.symbols[i],
        slot,
        gold: slot >= 17
      });
    });
  });
  return stickers;
}

const STICKERS = buildStickerSets();
const STICKER_SETS = Object.fromEntries(
  Object.keys(STICKER_SET_DEFS).map((key) => [
    key,
    { ...CARD_SETS[key], stickers: STICKERS.filter((s) => s.set === key) }
  ])
);

const QUESTS = [
  {
    id: 'q_win_3',
    title: 'Triple Pop',
    desc: 'Win 3 levels',
    icon: '🏁',
    stat: 'levelsWon',
    target: 3,
    reward: { coins: 75, sticker: 'st_meadow_20' },
    codeChance: 0.15
  },
  {
    id: 'q_boxes_10',
    title: 'Box Buster',
    desc: 'Clear 10 boxes',
    icon: '📦',
    stat: 'boxesPopped',
    target: 10,
    reward: { coins: 50, sticker: 'st_volcano_02' },
    codeChance: 0.12
  },
  {
    id: 'q_combos_5',
    title: 'Combo Craze',
    desc: 'Land 5 combos',
    icon: '⚡',
    stat: 'combos',
    target: 5,
    reward: { coins: 60, sticker: 'st_volcano_14' },
    codeChance: 0.18
  },
  {
    id: 'q_power_3',
    title: 'Power Player',
    desc: 'Use 3 power-ups',
    icon: '💫',
    stat: 'powerUpsUsed',
    target: 3,
    reward: { coins: 80, sticker: 'st_castle_03' },
    codeChance: 0.2
  },
  {
    id: 'q_stars_6',
    title: 'Star Collector',
    desc: 'Earn 6 stars total',
    icon: '⭐',
    stat: 'totalStars',
    target: 6,
    reward: { coins: 100, sticker: 'st_ocean_02' },
    codeChance: 0.25
  },
  {
    id: 'q_cards_5',
    title: 'Card Curator',
    desc: 'Collect 5 unique cards',
    icon: '🃏',
    stat: 'uniqueCards',
    target: 5,
    reward: { coins: 90, sticker: 'st_castle_20' },
    codeChance: 0.3
  }
];

const CARD_BY_ID = Object.fromEntries([
  ...NORMAL_CARDS.map(c => [c.id, { ...c, type: 'normal' }]),
  ...CODE_CARDS.map(c => [c.id, { ...c, type: 'code', rarity: 'legendary' }])
]);

const STICKER_BY_ID = Object.fromEntries(STICKERS.map(s => [s.id, s]));
const QUEST_BY_ID = Object.fromEntries(QUESTS.map(q => [q.id, q]));