/* QuestFit — game rules & state. No DOM access in this file. */
'use strict';

const Game = (() => {
  const STORAGE_KEY = 'questfit.save.v1';
  let state = null;

  /* ---------- helpers ---------- */
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function todayKey(d = new Date()) {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  }
  function niceRound(n) {
    if (n >= 40) return Math.round(n / 5) * 5;
    return Math.max(1, Math.round(n));
  }

  /* ---------- levels ---------- */
  function xpToNext(level) { return Math.round(100 * Math.pow(level, 1.5) + 50); }
  function levelInfo(totalXP) {
    let level = 1, into = Math.max(0, totalXP);
    while (into >= xpToNext(level)) { into -= xpToNext(level); level++; }
    return { level, into, need: xpToNext(level), pct: into / xpToNext(level) };
  }
  function rankFor(level) {
    let r = RANKS[0];
    for (const rank of RANKS) if (level >= rank.level) r = rank;
    return r;
  }
  function nextRank(level) { return RANKS.find(r => r.level > level) || null; }
  function maxHP(level) { return 100 + (level - 1) * 5; }

  /* Daily requirements grow with level — the core difficulty curve. */
  function requirements(level, diffId) {
    const D = DIFFICULTIES[diffId];
    return {
      workouts: Math.min(D.maxW, D.baseW + Math.floor((level - 1) / D.stepW)),
      tasks:    Math.min(D.maxT, D.baseT + Math.floor((level - 1) / D.stepT)),
    };
  }
  function workoutAmount(w, level, diffId) {
    const D = DIFFICULTIES[diffId];
    const growth = D.repGrowth * (w.growth ?? 1);
    return niceRound(w.base * D.rep * (1 + (level - 1) * growth));
  }
  function levelXpScale(level) { return 1 + (level - 1) * 0.03; }
  function workoutXP(w, level, diffId) {
    return Math.round(w.xp * DIFFICULTIES[diffId].xp * levelXpScale(level));
  }
  function effortXP(effort, level, diffId) {
    return Math.round(EFFORTS[effort].xp * DIFFICULTIES[diffId].xp * levelXpScale(level));
  }
  function goalBonusXP(level, diffId) {
    return Math.round(60 * DIFFICULTIES[diffId].xp * levelXpScale(level));
  }

  /* ---------- gear ---------- */
  function gearBonus() {
    let total = 0;
    for (const slot of Object.keys(SLOTS)) {
      const it = equippedItem(slot);
      if (it) total += it.bonus;
    }
    return total; // percent
  }
  function equippedItem(slot) {
    const id = state.equipped[slot];
    return id ? state.inventory.find(i => i.id === id) || null : null;
  }
  function rollRarity(level, diffId) {
    const luck = level * 0.6 + DIFFICULTIES[diffId].lootLuck;
    const w = {
      common: Math.max(15, RARITIES.common.weight - luck * 1.5),
      rare: RARITIES.rare.weight + luck * 0.6,
      epic: RARITIES.epic.weight + luck * 0.6,
      legendary: RARITIES.legendary.weight + luck * 0.3,
    };
    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    for (const k of RARITY_ORDER) { r -= w[k]; if (r <= 0) return k; }
    return 'common';
  }
  function makeItem(level, diffId, forceSlot) {
    const slot = forceSlot || pick(Object.keys(SLOTS));
    const rarity = rollRarity(level, diffId);
    const tier = clamp(Math.floor((level - 1) / 4) + rand(-1, 1) + RARITY_ORDER.indexOf(rarity) - 1, 0, MATERIALS.length - 1);
    const R = RARITIES[rarity];
    const bonus = rand(R.min, R.max) + Math.floor(tier / 2);
    return {
      id: uid(), slot, rarity, bonus,
      name: `${MATERIALS[tier]} ${pick(SLOTS[slot].bases)}`,
      tier, found: todayKey(),
    };
  }
  function equip(itemId) {
    const it = state.inventory.find(i => i.id === itemId);
    if (!it) return;
    state.equipped[it.slot] = it.id;
    save();
  }
  function unequip(slot) { state.equipped[slot] = null; save(); }
  function discard(itemId) {
    const it = state.inventory.find(i => i.id === itemId);
    if (!it) return;
    if (state.equipped[it.slot] === it.id) state.equipped[it.slot] = null;
    state.inventory = state.inventory.filter(i => i.id !== itemId);
    save();
  }

  /* ---------- enemies ---------- */
  function makeEnemy(level, diffId) {
    const D = DIFFICULTIES[diffId];
    const top = clamp(Math.floor((level - 1) / 3) + D.tierOffset, 0, ENEMIES.length - 1);
    const tier = clamp(top - (Math.random() < 0.35 ? 1 : 0), 0, ENEMIES.length - 1);
    const base = ENEMIES[tier];
    return {
      tier,
      name: `${pick(ENEMY_ADJECTIVES)} ${base.name}`,
      maxHp: 60 + level * 20 + tier * 30,
      attack: Math.round((12 + tier * 5) * D.dmg),
    };
  }

  /* ---------- day ---------- */
  function shuffle(a) {
    const arr = a.slice();
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }
  function newDay(key) {
    const { level } = levelInfo(state.hero.totalXP);
    const diff = state.hero.difficulty;
    const req = requirements(level, diff);
    const customWorkouts = state.tasks.filter(t => t.kind === 'workout').length;
    const count = Math.max(1, req.workouts + 2 - Math.min(customWorkouts, 2));
    const workouts = shuffle(WORKOUTS).slice(0, count).map(w => ({
      id: uid(), exId: w.id, name: w.name, icon: w.icon, unit: w.unit,
      amount: workoutAmount(w, level, diff),
      xp: workoutXP(w, level, diff),
    }));
    // one-off tasks from earlier days are dropped
    state.tasks = state.tasks.filter(t => t.repeat === 'daily' || t.day === key);
    state.day = {
      key, level, req, workouts,
      done: {},           // questKey -> { xp, kind, at }
      enemy: makeEnemy(level, diff),
      lootGiven: false, bonusXP: 0, streakCounted: false,
    };
  }

  function quests() {
    const d = state.day, diff = state.hero.difficulty;
    const list = d.workouts.map(w => ({
      key: 'w:' + w.id, kind: 'workout', title: w.name, icon: w.icon,
      detail: `${w.amount} ${w.unit}`, xp: w.xp, generated: true,
    }));
    for (const t of state.tasks) {
      list.push({
        key: 't:' + t.id, taskId: t.id, kind: t.kind, title: t.title,
        icon: t.forfeit ? '⚖️' : t.kind === 'workout' ? '🏋️' : '📜',
        detail: `${EFFORTS[t.effort].label}${t.repeat === 'once' ? ' · today only' : ''}`,
        xp: effortXP(t.effort, d.level, diff), generated: false,
      });
    }
    return list.map(q => ({ ...q, done: !!d.done[q.key], awarded: d.done[q.key]?.xp }));
  }

  function progress(day = state.day) {
    let w = 0, t = 0;
    for (const v of Object.values(day.done)) v.kind === 'workout' ? w++ : t++;
    const need = day.req.workouts + day.req.tasks;
    const got = Math.min(w, day.req.workouts) + Math.min(t, day.req.tasks);
    return { workouts: w, tasks: t, pct: need ? got / need : 1, met: got >= need };
  }

  /* ---------- actions ---------- */
  function complete(key) {
    const q = quests().find(x => x.key === key);
    if (!q || q.done) return [];
    const events = [];
    const before = levelInfo(state.hero.totalXP).level;
    const xp = Math.round(q.xp * (1 + gearBonus() / 100));
    state.day.done[key] = { xp, kind: q.kind, at: Date.now() };
    state.hero.totalXP += xp;
    state.stats[q.kind === 'workout' ? 'workouts' : 'tasks']++;
    events.push({ type: 'xp', amount: xp, kind: q.kind });

    const p = progress();
    if (p.met) {
      if (!state.day.bonusXP) {
        const bonus = goalBonusXP(state.day.level, state.hero.difficulty);
        state.day.bonusXP = bonus;
        state.hero.totalXP += bonus;
        events.push({ type: 'bonus', amount: bonus });
      }
      if (!state.day.streakCounted) {
        state.day.streakCounted = true;
        state.hero.streak++;
        state.hero.bestStreak = Math.max(state.hero.bestStreak, state.hero.streak);
        const m = state.motivation;
        if (m.streakReward.trim() && state.hero.streak % m.streakGoal === 0 && !state.day.streakRewardShown) {
          state.day.streakRewardShown = true;
          events.push({ type: 'streakReward', streak: state.hero.streak, reward: m.streakReward });
        }
      }
      if (!state.day.lootGiven) {
        state.day.lootGiven = true;
        state.stats.enemies++;
        const item = makeItem(state.day.level, state.hero.difficulty);
        state.inventory.push(item);
        const autoEquip = !state.equipped[item.slot];
        if (autoEquip) state.equipped[item.slot] = item.id;
        events.push({ type: 'defeat', enemy: state.day.enemy, item, autoEquip });
      }
    }
    const after = levelInfo(state.hero.totalXP).level;
    if (after > before) {
      state.hero.hp = maxHP(after);
      events.push({ type: 'levelup', from: before, to: after });
    }
    save();
    return events;
  }

  function undo(key) {
    const entry = state.day.done[key];
    if (!entry) return;
    delete state.day.done[key];
    state.hero.totalXP = Math.max(0, state.hero.totalXP - entry.xp);
    const k = entry.kind === 'workout' ? 'workouts' : 'tasks';
    state.stats[k] = Math.max(0, state.stats[k] - 1);
    if (!progress().met) {
      if (state.day.bonusXP) { state.hero.totalXP = Math.max(0, state.hero.totalXP - state.day.bonusXP); state.day.bonusXP = 0; }
      if (state.day.streakCounted) { state.day.streakCounted = false; state.hero.streak = Math.max(0, state.hero.streak - 1); }
    }
    state.hero.hp = Math.min(state.hero.hp, maxHP(levelInfo(state.hero.totalXP).level));
    save();
  }

  function addTask({ title, effort, kind, repeat }) {
    title = String(title || '').trim().slice(0, 80);
    if (!title) return null;
    const t = { id: uid(), title, effort: EFFORTS[effort] ? effort : 'medium', kind: kind === 'workout' ? 'workout' : 'task', repeat: repeat === 'once' ? 'once' : 'daily', day: todayKey() };
    state.tasks.push(t);
    save();
    return t;
  }
  function removeTask(id) {
    if (state.day.done['t:' + id]) return false;
    state.tasks = state.tasks.filter(t => t.id !== id);
    save();
    return true;
  }

  /* Enemy hits back for each day the goal was not met. */
  function damageHero(amount, report) {
    state.hero.hp -= amount;
    report.damage += amount;
    if (state.hero.hp <= 0) {
      const info = levelInfo(state.hero.totalXP);
      const lost = Math.floor(info.into / 2);
      state.hero.totalXP -= lost;
      state.hero.hp = maxHP(info.level);
      report.knockouts++;
      report.xpLost += lost;
      // The enemy steals one piece of equipped gear.
      const worn = Object.keys(SLOTS).map(equippedItem).filter(Boolean);
      if (worn.length) {
        const it = worn[Math.floor(Math.random() * worn.length)];
        state.equipped[it.slot] = null;
        state.inventory = state.inventory.filter(i => i.id !== it.id);
        report.stolen.push(it.name);
      }
    }
  }

  function settleDays(today) {
    const d = state.day;
    const report = { days: [], damage: 0, knockouts: 0, xpLost: 0, stolen: [], penalty: null };
    const p = progress(d);
    state.history.push({ key: d.key, met: p.met, done: p.workouts + p.tasks, enemy: d.enemy.name });
    if (p.met) {
      const heal = Math.round(maxHP(levelInfo(state.hero.totalXP).level) * 0.25);
      state.hero.hp = Math.min(maxHP(levelInfo(state.hero.totalXP).level), state.hero.hp + heal);
      report.days.push({ key: d.key, met: true, enemy: d.enemy.name, heal });
    } else {
      state.hero.streak = 0;
      const dmg = Math.max(1, Math.round(d.enemy.attack * (1 - p.pct)));
      damageHero(dmg, report);
      report.days.push({ key: d.key, met: false, enemy: d.enemy.name, dmg });
    }
    // Fully skipped days (app not opened) — capped so a vacation isn't a wipe-out.
    const missed = Math.min(3, daysBetween(d.key, today) - 1);
    for (let i = 0; i < missed; i++) {
      const lvl = levelInfo(state.hero.totalXP).level;
      const e = makeEnemy(lvl, state.hero.difficulty);
      state.hero.streak = 0;
      damageHero(e.attack, report);
      report.days.push({ key: 'skipped', met: false, enemy: e.name, dmg: e.attack });
    }
    state.history = state.history.slice(-60);
    return report;
  }

  /* Call on load and periodically; returns an overnight report if the day rolled over. */
  function ensureToday() {
    const key = todayKey();
    if (!state.day) { newDay(key); save(); return null; }
    if (state.day.key === key) return null;
    const report = settleDays(key);
    newDay(key);
    // Real-life forfeit: a knockout adds the user's chosen penalty as a quest for today.
    const pen = state.motivation.penalty.trim();
    if (report.knockouts && pen) {
      const t = addTask({ title: `Forfeit: ${pen}`, effort: 'easy', kind: 'task', repeat: 'once' });
      if (t) { t.forfeit = true; save(); }
      report.penalty = pen;
    }
    save();
    return report;
  }

  /* What happens tonight if the enemy isn't beaten. */
  function stakes() {
    const p = progress();
    const info = levelInfo(state.hero.totalXP);
    const dmg = p.met ? 0 : Math.max(1, Math.round(state.day.enemy.attack * (1 - p.pct)));
    const hpAfter = state.hero.hp - dmg;
    return { dmg, hpAfter, knockout: hpAfter <= 0, xpLoss: Math.floor(info.into / 2), met: p.met };
  }

  const DEFAULT_MOTIVATION = { why: '', dailyReward: '', streakReward: '', streakGoal: 7, penalty: '' };
  function setMotivation(m) {
    const clean = (v) => String(v || '').trim().slice(0, 120);
    state.motivation = {
      why: clean(m.why), dailyReward: clean(m.dailyReward), streakReward: clean(m.streakReward),
      streakGoal: [3, 5, 7, 14, 30].includes(+m.streakGoal) ? +m.streakGoal : 7, penalty: clean(m.penalty),
    };
    save();
  }
  function hasMotivation() {
    const m = state.motivation;
    return !!(m.why || m.dailyReward || m.streakReward || m.penalty);
  }

  /* ---------- persistence ---------- */
  function freshState(name, difficulty) {
    return {
      version: 1,
      hero: { name, difficulty, totalXP: 0, hp: maxHP(1), streak: 0, bestStreak: 0, created: todayKey() },
      tasks: DEFAULT_TASKS.map(t => ({ ...t, id: uid(), repeat: 'daily', day: todayKey() })),
      inventory: [],
      equipped: { weapon: null, helmet: null, armor: null, shield: null, boots: null },
      day: null,
      history: [],
      stats: { workouts: 0, tasks: 0, enemies: 0 },
      motivation: { ...DEFAULT_MOTIVATION },
    };
  }
  function start(name, difficulty) {
    state = freshState(String(name || 'Hero').trim().slice(0, 20) || 'Hero', DIFFICULTIES[difficulty] ? difficulty : 'beginner');
    // starter gear so the hero isn't empty-handed
    const sword = { id: uid(), slot: 'weapon', rarity: 'common', bonus: 2, name: 'Wooden Sword', tier: 0, found: todayKey() };
    state.inventory.push(sword);
    state.equipped.weapon = sword.id;
    newDay(todayKey());
    save();
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (!s || !s.hero || !DIFFICULTIES[s.hero.difficulty]) return false;
      s.motivation = { ...DEFAULT_MOTIVATION, ...(s.motivation || {}) };
      state = s;
      return true;
    } catch { return false; }
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }
  function reset() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    state = null;
  }
  function setDifficulty(diffId) {
    if (!DIFFICULTIES[diffId]) return;
    state.hero.difficulty = diffId;
    // Today's quests are rebuilt for the new mode, keeping completed custom tasks.
    const keepDone = Object.fromEntries(Object.entries(state.day.done).filter(([k]) => k.startsWith('t:')));
    const { lootGiven, bonusXP, streakCounted } = state.day;
    newDay(todayKey());
    Object.assign(state.day, { done: keepDone, lootGiven, bonusXP, streakCounted });
    save();
  }
  function rename(name) {
    name = String(name || '').trim().slice(0, 20);
    if (name) { state.hero.name = name; save(); }
  }

  return {
    get state() { return state; },
    todayKey, levelInfo, xpToNext, rankFor, nextRank, maxHP, requirements, gearBonus, equippedItem,
    quests, progress, complete, undo, addTask, removeTask, equip, unequip, discard,
    stakes, setMotivation, hasMotivation, ensureToday, start, load, reset, setDifficulty, rename, workoutAmount,
  };
})();
