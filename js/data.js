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
  { id: 'pushups',   name: 'Push-ups',          base: 8,  unit: 'reps',        xp: 25, icon: '💪' },
  { id: 'squats',    name: 'Squats',            base: 12, unit: 'reps',        xp: 25, icon: '🦵' },
  { id: 'situps',    name: 'Sit-ups',           base: 12, unit: 'reps',        xp: 20, icon: '🔄' },
  { id: 'plank',     name: 'Plank',             base: 30, unit: 'sec',         xp: 20, icon: '🧱' },
  { id: 'lunges',    name: 'Lunges',            base: 8,  unit: 'reps / leg',  xp: 25, icon: '🚶' },
  { id: 'jacks',     name: 'Jumping jacks',     base: 25, unit: 'reps',        xp: 20, icon: '⭐' },
  { id: 'burpees',   name: 'Burpees',           base: 6,  unit: 'reps',        xp: 35, icon: '💥' },
  { id: 'climbers',  name: 'Mountain climbers', base: 20, unit: 'reps',        xp: 25, icon: '⛰️' },
  { id: 'bridges',   name: 'Glute bridges',     base: 12, unit: 'reps',        xp: 20, icon: '🌉' },
  { id: 'wallsit',   name: 'Wall sit',          base: 30, unit: 'sec',         xp: 25, icon: '🪑' },
  { id: 'walk',      name: 'Walk or run',       base: 15, unit: 'min',         xp: 35, icon: '👟', growth: 0.5 },
  { id: 'stretch',   name: 'Stretching',        base: 5,  unit: 'min',         xp: 15, icon: '🧘', growth: 0.5 },
  { id: 'superman',  name: 'Superman hold',     base: 20, unit: 'sec',         xp: 20, icon: '🦸' },
  { id: 'calves',    name: 'Calf raises',       base: 15, unit: 'reps',        xp: 15, icon: '🦶' },
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
