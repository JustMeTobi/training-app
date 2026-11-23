/* QuestFit — static game data */
'use strict';

const DIFFICULTIES = {
  beginner: {
    id: 'beginner', label: 'Beginner', icon: '🌱',
    blurb: 'Gentle start. Light reps, soft-hitting enemies.',
    baseW: 2, stepW: 5, maxW: 5,      // workouts required per day
    baseT: 2, stepT: 6, maxT: 5,      // tasks required per day
    rep: 1.0, repGrowth: 0.04,        // workout amount multiplier & per-level growth
    xp: 1.0, dmg: 0.6, tierOffset: 0, lootLuck: 0,
  },
  intermediate: {
    id: 'intermediate', label: 'Intermediate', icon: '⚔️',
    blurb: 'Steady challenge. More quests, tougher enemies, better XP.',
    baseW: 3, stepW: 4, maxW: 6,
    baseT: 3, stepT: 5, maxT: 6,
    rep: 1.5, repGrowth: 0.05,
    xp: 1.25, dmg: 1.0, tierOffset: 1, lootLuck: 4,
  },
  hard: {
    id: 'hard', label: 'Hard', icon: '🔥',
    blurb: 'For veterans. Heavy reps, brutal enemies, best rewards.',
    baseW: 4, stepW: 3, maxW: 8,
    baseT: 3, stepT: 4, maxT: 7,
    rep: 2.2, repGrowth: 0.06,
    xp: 1.6, dmg: 1.5, tierOffset: 2, lootLuck: 8,
  },
};

/* Workout pool. base = amount at level 1 on Beginner. */
const WORKOUTS = [
  { id: 'pushups', attr: 'str',   name: 'Push-ups',          base: 8,  unit: 'reps',        xp: 25, icon: '💪' },
  { id: 'squats', attr: 'str',    name: 'Squats',            base: 12, unit: 'reps',        xp: 25, icon: '🦵' },
  { id: 'situps', attr: 'str',    name: 'Sit-ups',           base: 12, unit: 'reps',        xp: 20, icon: '🔄' },
  { id: 'plank', attr: 'end',     name: 'Plank',             base: 30, unit: 'sec',         xp: 20, icon: '🧱' },
  { id: 'lunges', attr: 'str',    name: 'Lunges',            base: 8,  unit: 'reps / leg',  xp: 25, icon: '🚶' },
  { id: 'jacks', attr: 'end',     name: 'Jumping jacks',     base: 25, unit: 'reps',        xp: 20, icon: '⭐' },
  { id: 'burpees', attr: 'end',   name: 'Burpees',           base: 6,  unit: 'reps',        xp: 35, icon: '💥' },
  { id: 'climbers', attr: 'end',  name: 'Mountain climbers', base: 20, unit: 'reps',        xp: 25, icon: '⛰️' },
  { id: 'bridges', attr: 'str',   name: 'Glute bridges',     base: 12, unit: 'reps',        xp: 20, icon: '🌉' },
  { id: 'wallsit', attr: 'end',   name: 'Wall sit',          base: 30, unit: 'sec',         xp: 25, icon: '🪑' },
  { id: 'walk', attr: 'end',      name: 'Walk or run',       base: 15, unit: 'min',         xp: 35, icon: '👟', growth: 0.5 },
  { id: 'stretch', attr: 'end',   name: 'Stretching',        base: 5,  unit: 'min',         xp: 15, icon: '🧘', growth: 0.5 },
  { id: 'superman', attr: 'str',  name: 'Superman hold',     base: 20, unit: 'sec',         xp: 20, icon: '🦸' },
  { id: 'calves', attr: 'str',    name: 'Calf raises',       base: 15, unit: 'reps',        xp: 15, icon: '🦶' },
];

const EFFORTS = {
  easy:   { label: 'Easy',   xp: 15 },
  medium: { label: 'Medium', xp: 25 },
  hard:   { label: 'Hard',   xp: 40 },
};

const DEFAULT_TASKS = [
  { title: 'Drink 2 liters of water', effort: 'easy',   kind: 'task' },
  { title: 'Make your bed',           effort: 'easy',   kind: 'task' },
  { title: 'Read for 15 minutes',     effort: 'medium', kind: 'task' },
  { title: 'Tidy up for 10 minutes',  effort: 'easy',   kind: 'task' },
  { title: 'No phone 30 min before bed', effort: 'medium', kind: 'task' },
];

/* Enemies, ordered by tier. Drawn by art.js from these traits. */
const ENEMIES = [
  { name: 'Slime',        color: '#4ade80', eyes: 2 },
  { name: 'Bog Goblin',   color: '#a3b83a', eyes: 2, ears: true, teeth: true },
  { name: 'Bone Rattler', color: '#e7e5e4', eyes: 2, dark: true, teeth: true },
  { name: 'Shadow Wolf',  color: '#56637a', eyes: 2, ears: true, glow: '#facc15', teeth: true },
  { name: 'Cave Orc',     color: '#3f8f4f', eyes: 2, horns: true, teeth: true },
  { name: 'Stone Troll',  color: '#8a817c', eyes: 1, horns: true, teeth: true, spikes: true },
  { name: 'Frost Wraith', color: '#93c5fd', eyes: 2, glow: '#e0f2fe', ghost: true },
  { name: 'Iron Golem',   color: '#64748b', eyes: 1, glow: '#f97316', spikes: true },
  { name: 'Ember Drake',  color: '#ef4444', eyes: 2, horns: true, wings: true, glow: '#fde047', teeth: true },
  { name: 'Void Lich',    color: '#7c3aed', eyes: 2, glow: '#22d3ee', crown: true, ghost: true },
  { name: 'Elder Dragon', color: '#b91c1c', eyes: 3, horns: true, wings: true, crown: true, glow: '#fde047', teeth: true, spikes: true },
];
const ENEMY_ADJECTIVES = ['Grumpy', 'Lazy', 'Sneaky', 'Furious', 'Ancient', 'Hungry', 'Sleepy', 'Wicked', 'Mighty', 'Cursed'];

/* Gear */
const SLOTS = {
  weapon: { label: 'Weapon', icon: '🗡️', bases: ['Sword', 'Axe', 'Blade', 'Hammer'] },
  helmet: { label: 'Helmet', icon: '⛑️', bases: ['Helm', 'Hood', 'Visor', 'Crown'] },
  armor:  { label: 'Armor',  icon: '🛡️', bases: ['Chestplate', 'Tunic', 'Mail', 'Cuirass'] },
  shield: { label: 'Shield', icon: '🔰', bases: ['Shield', 'Buckler', 'Aegis', 'Bulwark'] },
  boots:  { label: 'Boots',  icon: '🥾', bases: ['Boots', 'Greaves', 'Treads', 'Sabatons'] },
};
const MATERIALS = ['Wooden', 'Leather', 'Bronze', 'Iron', 'Steel', 'Silver', 'Mythril', 'Obsidian', 'Dragonbone', 'Celestial'];
const RARITIES = {
  common:    { label: 'Common',    color: '#9ca3af', min: 2,  max: 3,  weight: 60 },
  rare:      { label: 'Rare',      color: '#3b82f6', min: 4,  max: 6,  weight: 28 },
  epic:      { label: 'Epic',      color: '#a855f7', min: 7,  max: 10, weight: 10 },
  legendary: { label: 'Legendary', color: '#f59e0b', min: 12, max: 15, weight: 2 },
};
const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

/* Rank titles by level */
const RANKS = [
  { level: 1,  title: 'Novice' },
  { level: 3,  title: 'Squire' },
  { level: 6,  title: 'Adventurer' },
  { level: 10, title: 'Knight' },
  { level: 15, title: 'Champion' },
  { level: 20, title: 'Hero' },
  { level: 30, title: 'Legend' },
  { level: 40, title: 'Mythic' },
];

/* ---------- v2: engagement features ---------- */

const ATTRS = {
  str: { label: 'Strength',   icon: '💪', color: '#ef4444', blurb: 'Grows from strength workouts' },
  end: { label: 'Endurance',  icon: '🫀', color: '#22c55e', blurb: 'Grows from cardio and holds' },
  dis: { label: 'Discipline', icon: '🧠', color: '#60a5fa', blurb: 'Grows from daily tasks' },
};

const SKILLS = {
  warrior: { label: 'Warrior', icon: '⚔️', max: 5, desc: '+5% XP from workouts per point' },
  scholar: { label: 'Scholar', icon: '📚', max: 5, desc: '+5% XP from tasks per point' },
  tank:    { label: 'Tank',    icon: '🛡️', max: 5, desc: '+10 max HP per point' },
  lucky:   { label: 'Lucky',   icon: '🍀', max: 5, desc: '+3% crit chance and better loot per point' },
};

const SHOP = [
  { id: 'potion', name: 'Health potion', icon: '🧪', desc: 'Restores 40% of your HP.', price: () => 50 },
  { id: 'shield', name: 'Streak shield', icon: '🛡️', desc: 'Saves your streak once if you lose a day. Used automatically. Max 3.', price: () => 150, max: 3 },
  { id: 'crate',  name: 'Gear crate',    icon: '📦', desc: 'A random piece of gear for your level.', price: (lvl) => 120 + lvl * 10 },
  { id: 'epic',   name: 'Epic crate',    icon: '💎', desc: 'Guaranteed Epic or Legendary gear.', price: (lvl) => 450 + lvl * 20 },
];

const CHALLENGES = [
  { title: 'Plank for 2 minutes (breaks allowed)', kind: 'workout', icon: '🧱' },
  { title: 'Walk 10,000 steps', kind: 'workout', icon: '👣' },
  { title: '100 push-ups spread over the day', kind: 'workout', icon: '💪' },
  { title: '50 squats in a row', kind: 'workout', icon: '🦵' },
  { title: 'Take the stairs all day', kind: 'workout', icon: '🪜' },
  { title: 'Stretch for 15 minutes', kind: 'workout', icon: '🧘' },
  { title: '5 minutes of jumping rope or jacks', kind: 'workout', icon: '⭐' },
  { title: 'Take a cold shower', kind: 'task', icon: '🚿' },
  { title: 'No sugar today', kind: 'task', icon: '🍬' },
  { title: 'Only drink water today', kind: 'task', icon: '💧' },
  { title: 'Meditate for 10 minutes', kind: 'task', icon: '🧘' },
  { title: 'No social media until 18:00', kind: 'task', icon: '📵' },
  { title: 'Cook a healthy meal', kind: 'task', icon: '🥗' },
  { title: 'Go to bed before 23:00', kind: 'task', icon: '🛌' },
  { title: 'Write down 3 things you are grateful for', kind: 'task', icon: '📝' },
  { title: 'Spend 20 minutes outside', kind: 'task', icon: '🌳' },
];

const BOSS_TITLES = ['Warlord', 'Overlord', 'Tyrant', 'Dread King', 'Destroyer', 'Ancient One'];

const TAUNTS = {
  fresh:    ["You'll never finish those squats…", 'Back to bed, little hero.', "I've already won. You're still in pajamas.", 'Workouts? Ha! Not today.', "Go on, scroll your phone. I'll wait."],
  hurt:     ['Lucky hit! That won\'t happen again.', 'Is that all you\'ve got?', "Okay, that one stung. Barely.", 'Hmph. Keep dreaming.'],
  almost:   ['N-no, not the plank!', 'Wait, wait! Let\'s talk about this!', "I'm feeling a bit… wobbly.", 'Please, no more push-ups!'],
  beaten:   ['You win this time…', 'I\'ll be back tomorrow. Stronger!', 'Ugh… so many reps…', '*faints dramatically*'],
  sleeping: ['Zzz… rest day… zzz…', '*snores loudly*', 'Zzz… do a little stretch… zzz…'],
};

const LOOKS = {
  hairStyles: ['Short', 'Spiky', 'Long', 'Mohawk', 'Ponytail', 'Bald'],
  hairColors: ['#5b3a1e', '#1f1f1f', '#e8c15a', '#b4441e', '#e5e7eb', '#3b82f6', '#ec4899', '#22c55e'],
  skins: ['#f2c29b', '#e0a87a', '#c68642', '#8d5524', '#5c3a1e'],
  capes: [
    { id: 'red',     name: 'Red Cape',     color: '#dc2626', req: { level: 5 } },
    { id: 'emerald', name: 'Emerald Cape', color: '#059669', req: { ach: 'streak_7' } },
    { id: 'royal',   name: 'Royal Cape',   color: '#2563eb', req: { level: 10 } },
    { id: 'shadow',  name: 'Shadow Cape',  color: '#4c1d95', req: { ach: 'boss_1' } },
    { id: 'gold',    name: 'Golden Cape',  color: '#d97706', req: { level: 20 } },
  ],
  pets: [
    { id: 'dog',    name: 'Puppy',       req: { level: 3 } },
    { id: 'slime',  name: 'Pet Slime',   req: { ach: 'enemies_10' } },
    { id: 'cat',    name: 'Cat',         req: { ach: 'streak_7' } },
    { id: 'owl',    name: 'Owl',         req: { ach: 'tasks_100' } },
    { id: 'dragon', name: 'Baby Dragon', req: { level: 25 } },
  ],
};

/* Achievements. test(s, ctx) runs against the save; ctx = { hour, perfect, combo } */
const ACHIEVEMENTS = [
  { id: 'first_quest', icon: '👣', name: 'First Step',       desc: 'Complete your first quest',          test: s => s.stats.workouts + s.stats.tasks >= 1 },
  { id: 'first_blood', icon: '🗡️', name: 'First Blood',      desc: 'Defeat your first enemy',            test: s => s.stats.enemies >= 1 },
  { id: 'enemies_10',  icon: '🏹', name: 'Monster Hunter',   desc: 'Defeat 10 enemies',                  test: s => s.stats.enemies >= 10 },
  { id: 'enemies_50',  icon: '☠️', name: 'Slayer',           desc: 'Defeat 50 enemies',                  test: s => s.stats.enemies >= 50 },
  { id: 'boss_1',      icon: '👑', name: 'Boss Slayer',      desc: 'Defeat a weekly boss',               test: s => s.stats.bosses >= 1 },
  { id: 'boss_5',      icon: '🐲', name: "Overlord's Bane",  desc: 'Defeat 5 weekly bosses',             test: s => s.stats.bosses >= 5 },
  { id: 'streak_3',    icon: '🔥', name: 'On a Roll',        desc: 'Reach a 3-day streak',               test: s => s.hero.bestStreak >= 3 },
  { id: 'streak_7',    icon: '⛓️', name: 'Iron Will',        desc: 'Reach a 7-day streak',               test: s => s.hero.bestStreak >= 7 },
  { id: 'streak_30',   icon: '🌋', name: 'Unstoppable',      desc: 'Reach a 30-day streak',              test: s => s.hero.bestStreak >= 30 },
  { id: 'workouts_10', icon: '🏋️', name: 'Getting Started',  desc: 'Complete 10 workouts',               test: s => s.stats.workouts >= 10 },
  { id: 'workouts_100',icon: '💯', name: 'Centurion',        desc: 'Complete 100 workouts',              test: s => s.stats.workouts >= 100 },
  { id: 'workouts_500',icon: '🗿', name: 'Titan',            desc: 'Complete 500 workouts',              test: s => s.stats.workouts >= 500 },
  { id: 'tasks_10',    icon: '📋', name: 'Organized',        desc: 'Complete 10 tasks',                  test: s => s.stats.tasks >= 10 },
  { id: 'tasks_100',   icon: '🦉', name: 'Taskmaster',       desc: 'Complete 100 tasks',                 test: s => s.stats.tasks >= 100 },
  { id: 'level_5',     icon: '⭐', name: 'Adventurer',       desc: 'Reach level 5',                      test: (s, c) => c.level >= 5 },
  { id: 'level_10',    icon: '🌟', name: 'Knighted',         desc: 'Reach level 10',                     test: (s, c) => c.level >= 10 },
  { id: 'level_20',    icon: '💫', name: 'Hero of Legend',   desc: 'Reach level 20',                     test: (s, c) => c.level >= 20 },
  { id: 'level_30',    icon: '🌠', name: 'Mythic',           desc: 'Reach level 30',                     test: (s, c) => c.level >= 30 },
  { id: 'crit_1',      icon: '💥', name: 'Critical!',        desc: 'Land a critical hit',                test: s => s.stats.crits >= 1 },
  { id: 'crit_25',     icon: '🎯', name: 'Sharp Eye',        desc: 'Land 25 critical hits',              test: s => s.stats.crits >= 25 },
  { id: 'combo_3',     icon: '⚡', name: 'Combo Starter',    desc: 'Reach a ×3 combo',                   test: s => s.stats.maxCombo >= 3 },
  { id: 'combo_6',     icon: '🌩️', name: 'Combo King',       desc: 'Reach a ×6 combo',                   test: s => s.stats.maxCombo >= 6 },
  { id: 'early_bird',  icon: '🐦', name: 'Early Bird',       desc: 'Beat the enemy before noon',         test: s => s.stats.earlyWins >= 1 },
  { id: 'night_owl',   icon: '🌙', name: 'Night Owl',        desc: 'Complete a quest after 22:00',       test: (s, c) => c.hour >= 22 },
  { id: 'perfect',     icon: '✨', name: 'Perfectionist',    desc: 'Complete every quest in a day',      test: (s, c) => c.perfect },
  { id: 'legendary',   icon: '🏆', name: 'Legendary!',       desc: 'Own a Legendary item',               test: s => s.inventory.some(i => i.rarity === 'legendary') },
  { id: 'full_set',    icon: '🧥', name: 'Fashionista',      desc: 'Wear a full 5-piece gear set',       test: (s, c) => c.setCount >= 5 },
  { id: 'gold_1000',   icon: '💰', name: 'Moneybags',        desc: 'Earn 1,000 gold in total',           test: s => s.stats.goldEarned >= 1000 },
  { id: 'chests_10',   icon: '🗝️', name: 'Treasure Hunter',  desc: 'Open 10 daily chests',               test: s => s.stats.chests >= 10 },
  { id: 'challenge_1', icon: '🎖️', name: 'Challenger',       desc: 'Complete a daily challenge',         test: s => s.stats.challenges >= 1 },
  { id: 'challenge_10',icon: '🥇', name: 'Daredevil',        desc: 'Complete 10 daily challenges',       test: s => s.stats.challenges >= 10 },
  { id: 'timer_10',    icon: '⏱️', name: 'Timekeeper',       desc: 'Finish 10 workouts with the timer',  test: s => s.stats.timers >= 10 },
  { id: 'bestiary_5',  icon: '📖', name: 'Monster Expert',   desc: 'Defeat 5 different monster types',   test: s => Object.keys(s.bestiary).length >= 5 },
  { id: 'pushups_1000',icon: '🦾', name: 'Push-up Pro',      desc: 'Do 1,000 push-ups in total',         test: s => (s.stats.reps.pushups || 0) >= 1000 },
  { id: 'potion_1',    icon: '🧪', name: 'Quick Fix',        desc: 'Drink a health potion',              test: s => s.stats.potions >= 1 },
  { id: 'reforge_1',   icon: '🔨', name: 'Blacksmith',       desc: 'Reforge a piece of gear',            test: s => (s.stats.reforges || 0) >= 1 },
  { id: 'unique_1',    icon: '🌟', name: 'One of a Kind',    desc: 'Equip gear with a unique power',     test: (s, c) => c.uniques >= 1 },
  { id: 'power_50',    icon: '🔥', name: 'Heavy Hitter',     desc: 'Reach +50% Power from gear',         test: (s, c) => c.power >= 50 },
];

/* ---------- v3: gear effects ---------- */
/* Random bonus effects on rare+ gear. min/max scale up with the item's material tier. */
const EFFECTS = {
  power:  { label: 'Power',      icon: '⚔️', unit: '%',   min: 6, max: 14, perTier: 2,   color: '#ef4444', suffix: 'of Fury',     desc: v => `+${v}% damage to bosses` },
  crit:   { label: 'Precision',  icon: '💥', unit: '%',   min: 2, max: 5,  perTier: 0.5, color: '#facc15', suffix: 'of Precision', desc: v => `+${v}% critical hit chance` },
  gold:   { label: 'Fortune',    icon: '🪙', unit: '%',   min: 8, max: 18, perTier: 2,   color: '#f59e0b', suffix: 'of Greed',     desc: v => `+${v}% gold from everything` },
  hp:     { label: 'Vitality',   icon: '❤️', unit: '',    min: 6, max: 14, perTier: 2,   color: '#f43f5e', suffix: 'of the Bear',  desc: v => `+${v} max HP` },
  armor:  { label: 'Armor',      icon: '🛡️', unit: '%',   min: 4, max: 8,  perTier: 1,   color: '#94a3b8', suffix: 'of the Wall',  desc: v => `−${v}% damage taken at night` },
  luck:   { label: 'Luck',       icon: '🍀', unit: '',    min: 3, max: 7,  perTier: 1,   color: '#22c55e', suffix: 'of Clovers',   desc: v => `+${v} luck (rarer loot)` },
  regen:  { label: 'Regen',      icon: '💚', unit: '',    min: 1, max: 3,  perTier: 0.3, color: '#4ade80', suffix: 'of Mending',   desc: v => `Heal ${v} HP per quest` },
  combo:  { label: 'Swiftness',  icon: '⚡', unit: ' min', min: 2, max: 5,  perTier: 0.5, color: '#a855f7', suffix: 'of the Wind',  desc: v => `Combo window +${v} min` },
};
/* Which effects each slot tends to roll (more entries = more likely). */
const SLOT_EFFECTS = {
  weapon: ['power', 'power', 'power', 'crit', 'crit', 'gold', 'regen'],
  helmet: ['crit', 'luck', 'luck', 'hp', 'gold', 'armor'],
  armor:  ['hp', 'hp', 'armor', 'armor', 'regen', 'gold'],
  shield: ['armor', 'armor', 'armor', 'hp', 'hp', 'power'],
  boots:  ['combo', 'combo', 'combo', 'regen', 'luck', 'gold'],
};
const EFFECT_COUNT = { common: 0, rare: 1, epic: 2, legendary: 2 };

/* One unique power on every Legendary item. */
const UNIQUES = {
  executioner: { name: 'Executioner', icon: '🪓', color: '#dc2626', desc: 'Critical hits deal ×3 instead of ×2' },
  phoenix:     { name: 'Phoenix',     icon: '🔥', color: '#fb923c', desc: 'Once per week, survive a knockout with 1 HP' },
  midas:       { name: 'Midas',       icon: '👑', color: '#fbbf24', desc: 'Double gold from enemies and chests' },
  secondwind:  { name: 'Second Wind', icon: '🌬️', color: '#38bdf8', desc: 'Your first quest each day gives ×1.5 XP and double boss damage' },
  timelord:    { name: 'Time Lord',   icon: '⏳', color: '#c084fc', desc: 'Combo window 30 min and combo bonus up to +80%' },
  vampire:     { name: 'Vampiric',    icon: '🦇', color: '#be123c', desc: 'Critical hits heal 15 HP' },
};
