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
  const keyToDate = (k) => new Date(k + 'T12:00:00');
  function daysBetween(a, b) { return Math.round((keyToDate(b) - keyToDate(a)) / 86400000); }
  function weekKey(k = todayKey()) {           // Monday of the week
    const d = keyToDate(k);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return todayKey(d);
  }
  function daysLeftInWeek(k = todayKey()) { return 7 - ((keyToDate(k).getDay() + 6) % 7); } // Mon=7 … Sun=1
  function niceRound(n) { return n >= 40 ? Math.round(n / 5) * 5 : Math.max(1, Math.round(n)); }
  function hashStr(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); }
  function shuffle(a) {
    const arr = a.slice();
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    return arr;
  }

  /* ---------- levels ---------- */
  function xpToNext(level) { return Math.round(100 * Math.pow(level, 1.5) + 50); }
  function levelInfo(totalXP) {
    let level = 1, into = Math.max(0, totalXP);
    while (into >= xpToNext(level)) { into -= xpToNext(level); level++; }
    return { level, into, need: xpToNext(level), pct: into / xpToNext(level) };
  }
  const level = () => levelInfo(state.hero.totalXP).level;
  function rankFor(lv) { let r = RANKS[0]; for (const x of RANKS) if (lv >= x.level) r = x; return r; }
  function nextRank(lv) { return RANKS.find(r => r.level > lv) || null; }
  function maxHP(lv) { return 100 + (lv - 1) * 5 + (state ? state.skills.tank * 10 + gearStats().hp : 0); }
  const heroMaxHP = () => maxHP(level());

  function requirements(lv, diffId) {
    const D = DIFFICULTIES[diffId];
    return {
      workouts: Math.min(D.maxW, D.baseW + Math.floor((lv - 1) / D.stepW)),
      tasks:    Math.min(D.maxT, D.baseT + Math.floor((lv - 1) / D.stepT)),
    };
  }
  function workoutAmount(w, lv, diffId, scale = 1) {
    const D = DIFFICULTIES[diffId];
    return niceRound(w.base * D.rep * (1 + (lv - 1) * D.repGrowth * (w.growth ?? 1)) * scale);
  }
  const levelXpScale = (lv) => 1 + (lv - 1) * 0.03;
  const workoutXP = (w, lv, d) => Math.round(w.xp * DIFFICULTIES[d].xp * levelXpScale(lv));
  const effortXP = (e, lv, d) => Math.round(EFFORTS[e].xp * DIFFICULTIES[d].xp * levelXpScale(lv));
  const goalBonusXP = (lv, d) => Math.round(60 * DIFFICULTIES[d].xp * levelXpScale(lv));

  /* ---------- skills ---------- */
  function skillPoints() {
    const total = Math.floor(level() / 5);
    const spent = Object.values(state.skills).reduce((a, b) => a + b, 0);
    return { total, spent, free: Math.max(0, total - spent) };
  }
  function spendSkill(id) {
    if (!SKILLS[id] || skillPoints().free < 1 || state.skills[id] >= SKILLS[id].max) return false;
    state.skills[id]++;
    save(); return true;
  }
  function resetSkills() {
    for (const k of Object.keys(state.skills)) state.skills[k] = 0;
    state.hero.hp = Math.min(state.hero.hp, heroMaxHP());
    save();
  }
  const critChance = () => 0.06 + state.skills.lucky * 0.03 + gearStats().crit / 100;

  /* ---------- gear ---------- */
  function equippedItem(slot) {
    const id = state.equipped[slot];
    return id ? state.inventory.find(i => i.id === id) || null : null;
  }
  function setInfo() {
    const counts = {};
    for (const slot of Object.keys(SLOTS)) { const it = equippedItem(slot); if (it) counts[it.tier] = (counts[it.tier] || 0) + 1; }
    let best = null, count = 0;
    for (const [t, c] of Object.entries(counts)) if (c > count) { count = c; best = +t; }
    const bonus = count >= 5 ? 12 : count >= 3 ? 4 : 0;
    return { material: best == null ? null : MATERIALS[best], count, bonus };
  }
  function gearBonus() {
    let total = 0;
    for (const slot of Object.keys(SLOTS)) { const it = equippedItem(slot); if (it) total += it.bonus; }
    return total + setInfo().bonus;
  }
  /* Sum of all effects on equipped gear. */
  function gearStats() {
    const out = { uniques: new Set() };
    for (const k of Object.keys(EFFECTS)) out[k] = 0;
    if (!state) return out;
    for (const slot of Object.keys(SLOTS)) {
      const it = equippedItem(slot);
      if (!it) continue;
      for (const e of it.effects || []) out[e.id] = (out[e.id] || 0) + e.value;
      if (it.unique) out.uniques.add(it.unique);
    }
    out.armor = Math.min(60, out.armor);
    return out;
  }
  function rollEffects(slot, rarity, tier) {
    const n = EFFECT_COUNT[rarity] || 0;
    const pool = SLOT_EFFECTS[slot].slice();
    const out = [];
    while (out.length < n && pool.length) {
      const id = pick(pool);
      for (let i = pool.length - 1; i >= 0; i--) if (pool[i] === id) pool.splice(i, 1);
      const E = EFFECTS[id];
      const bonus = rarity === 'legendary' ? 1.3 : rarity === 'epic' ? 1.15 : 1;
      out.push({ id, value: Math.max(1, Math.round((rand(E.min, E.max) + tier * E.perTier) * bonus)) });
    }
    return out;
  }
  function itemName(it) {
    const mat = MATERIALS[it.tier];
    if (it.unique) return `${UNIQUES[it.unique].name} ${mat} ${it.base}`;
    const suffix = it.effects && it.effects[0] ? ` ${EFFECTS[it.effects[0].id].suffix}` : '';
    return `${mat} ${it.base}${suffix}`;
  }
  function baseOf(it) {
    const words = it.name.split(' ');
    return SLOTS[it.slot].bases.find(b => words.includes(b)) || SLOTS[it.slot].bases[0];
  }

  function rollRarity(lv, diffId, min = 'common') {
    const luck = lv * 0.6 + DIFFICULTIES[diffId].lootLuck + state.skills.lucky * 4 + gearStats().luck;
    const w = {
      common: Math.max(15, RARITIES.common.weight - luck * 1.5),
      rare: RARITIES.rare.weight + luck * 0.6,
      epic: RARITIES.epic.weight + luck * 0.6,
      legendary: RARITIES.legendary.weight + luck * 0.3,
    };
    const allowed = RARITY_ORDER.slice(RARITY_ORDER.indexOf(min));
    const sum = allowed.reduce((a, k) => a + w[k], 0);
    let r = Math.random() * sum;
    for (const k of allowed) { r -= w[k]; if (r <= 0) return k; }
    return allowed[0];
  }
  function makeItem(lv, diffId, { slot, minRarity } = {}) {
    slot = slot || pick(Object.keys(SLOTS));
    const rarity = rollRarity(lv, diffId, minRarity);
    const tier = clamp(Math.floor((lv - 1) / 4) + rand(-1, 1) + RARITY_ORDER.indexOf(rarity) - 1, 0, MATERIALS.length - 1);
    const R = RARITIES[rarity];
    const it = { id: uid(), slot, rarity, bonus: rand(R.min, R.max) + Math.floor(tier / 2), base: pick(SLOTS[slot].bases), tier, found: todayKey() };
    it.effects = rollEffects(slot, rarity, tier);
    if (rarity === 'legendary') it.unique = pick(Object.keys(UNIQUES));
    it.name = itemName(it);
    return it;
  }
  function reforgePrice(it) { return 60 + it.tier * 15 + RARITY_ORDER.indexOf(it.rarity) * 40; }
  /* Re-roll an item's effects (and unique power) for gold. */
  function reforge(itemId) {
    const it = state.inventory.find(i => i.id === itemId);
    if (!it || it.rarity === 'common') return { ok: false };
    const price = reforgePrice(it);
    if (state.hero.gold < price) return { ok: false, reason: 'gold' };
    state.hero.gold -= price;
    it.effects = rollEffects(it.slot, it.rarity, it.tier);
    if (it.rarity === 'legendary') it.unique = pick(Object.keys(UNIQUES).filter(u => u !== it.unique));
    it.name = itemName(it);
    state.stats.reforges = (state.stats.reforges || 0) + 1;
    state.hero.hp = Math.min(state.hero.hp, heroMaxHP());
    save();
    return { ok: true, item: it, events: checkAchievements() };
  }
  function giveItem(item) {
    state.inventory.push(item);
    const autoEquip = !state.equipped[item.slot];
    if (autoEquip) state.equipped[item.slot] = item.id;
    return autoEquip;
  }
  function equip(itemId) { const it = state.inventory.find(i => i.id === itemId); if (it) { state.equipped[it.slot] = it.id; state.hero.hp = Math.min(state.hero.hp, heroMaxHP()); save(); } return checkAchievements(); }
  function discard(itemId) {
    const it = state.inventory.find(i => i.id === itemId);
    if (!it) return;
    if (state.equipped[it.slot] === it.id) state.equipped[it.slot] = null;
    state.inventory = state.inventory.filter(i => i.id !== itemId);
    addGold(sellPrice(it), false);
    save();
  }
  const sellPrice = (it) => 5 + RARITY_ORDER.indexOf(it.rarity) * 15 + it.tier * 3 + (it.effects || []).length * 5 + (it.unique ? 40 : 0);

  /* ---------- gold & shop ---------- */
  function addGold(n, earned = true) {
    state.hero.gold = Math.max(0, state.hero.gold + n);
    if (earned && n > 0) state.stats.goldEarned += n;
  }
  function shopPrice(id) { const s = SHOP.find(x => x.id === id); return s ? s.price(level()) : Infinity; }
  function buy(id) {
    const s = SHOP.find(x => x.id === id);
    if (!s) return { ok: false };
    const price = s.price(level());
    if (state.hero.gold < price) return { ok: false, reason: 'gold' };
    if (s.max && (state.consumables[id] || 0) >= s.max) return { ok: false, reason: 'max' };
    state.hero.gold -= price;
    const res = { ok: true, id };
    if (id === 'potion' || id === 'shield') state.consumables[id] = (state.consumables[id] || 0) + 1;
    else {
      res.item = makeItem(level(), state.hero.difficulty, { minRarity: id === 'epic' ? 'epic' : 'common' });
      res.autoEquip = giveItem(res.item);
    }
    save();
    res.events = checkAchievements();
    return res;
  }
  function usePotion() {
    const max = heroMaxHP();
    if (!state.consumables.potion || state.hero.hp >= max) return 0;
    state.consumables.potion--;
    const before = state.hero.hp;
    state.hero.hp = Math.min(max, state.hero.hp + Math.round(max * 0.4));
    state.stats.potions++;
    save();
    return state.hero.hp - before;
  }

  /* ---------- enemies & boss ---------- */
  function topTier(lv, diffId) { return clamp(Math.floor((lv - 1) / 3) + DIFFICULTIES[diffId].tierOffset, 0, ENEMIES.length - 1); }
  function makeEnemy(lv, diffId) {
    const top = topTier(lv, diffId);
    const tier = clamp(top - (Math.random() < 0.35 ? 1 : 0), 0, ENEMIES.length - 1);
    return {
      tier, name: `${pick(ENEMY_ADJECTIVES)} ${ENEMIES[tier].name}`,
      maxHp: 60 + lv * 20 + tier * 30,
      attack: Math.round((12 + tier * 5) * DIFFICULTIES[diffId].dmg),
    };
  }
  function makeBoss(key) {
    const lv = level(), diff = state.hero.difficulty;
    const req = requirements(lv, diff);
    const tier = clamp(topTier(lv, diff) + 1, 0, ENEMIES.length - 1);
    const hp = Math.max(4, Math.round(daysLeftInWeek(key) * (req.workouts + req.tasks))) * 100;
    return { week: weekKey(key), tier, name: `${ENEMIES[tier].name} ${pick(BOSS_TITLES)}`, maxHp: hp, hp, defeated: false, level: lv };
  }
  function ensureBoss(key, report) {
    if (state.boss && state.boss.week === weekKey(key)) return;
    if (report && state.boss && !state.boss.defeated) report.bossEscaped = state.boss.name;
    state.boss = makeBoss(key);
    if (report) report.newBoss = state.boss.name;
  }

  /* ---------- day ---------- */
  function newDay(key) {
    const lv = level(), diff = state.hero.difficulty;
    const rest = state.settings.restDay !== null && keyToDate(key).getDay() === state.settings.restDay;
    let req = requirements(lv, diff), pool;
    if (rest) {
      req = { workouts: 1, tasks: 0 };
      pool = WORKOUTS.filter(w => w.id === 'stretch' || w.id === 'walk').map(w => ({ w, scale: 0.6 }));
    } else {
      const customWorkouts = state.tasks.filter(t => t.kind === 'workout').length;
      const count = Math.max(1, req.workouts + 2 - Math.min(customWorkouts, 2));
      pool = shuffle(WORKOUTS).slice(0, count).map(w => ({ w, scale: 1 }));
    }
    const workouts = pool.map(({ w, scale }) => makeWorkout(w, lv, diff, scale));
    state.tasks = state.tasks.filter(t => t.repeat === 'daily' || t.day === key);
    const ch = CHALLENGES[hashStr(key + state.hero.name) % CHALLENGES.length];
    const enemy = makeEnemy(lv, diff);
    if (rest) { enemy.sleeping = true; enemy.attack = 0; }
    state.day = {
      key, level: lv, req, workouts, rest,
      done: {}, enemy,
      challenge: { ...ch, xp: Math.round(effortXP('hard', lv, diff) * 1.5), gold: 40 + lv * 3 },
      lootGiven: false, bonusXP: 0, streakCounted: false,
      combo: 0, lastAt: 0, swaps: 1, chest: 'closed', quick: [], quickDone: 0,
    };
  }
  function makeWorkout(w, lv, diff, scale = 1) {
    return { id: uid(), exId: w.id, name: w.name, icon: w.icon, unit: w.unit, attr: w.attr, amount: workoutAmount(w, lv, diff, scale), xp: Math.round(workoutXP(w, lv, diff) * (scale < 1 ? 0.7 : 1)) };
  }

  function timerSeconds(unit, amount) {
    if (unit === 'sec') return amount;
    if (unit === 'min') return amount * 60;
    return 0;
  }
  function quests() {
    const d = state.day, diff = state.hero.difficulty;
    const list = d.workouts.map(w => ({
      key: 'w:' + w.id, kind: 'workout', title: w.name, icon: w.icon, exId: w.exId, attr: w.attr, amount: w.amount,
      detail: `${w.amount} ${w.unit}`, xp: w.xp, generated: true, timer: timerSeconds(w.unit, w.amount),
    }));
    for (const t of state.tasks) {
      const ex = t.kind === 'workout' && t.exId ? exerciseInfo(t.exId) : null;
      const amt = ex && t.amount ? `${t.amount} ${ex.unit} · ` : '';
      list.push({
        key: 't:' + t.id, taskId: t.id, kind: t.kind, title: t.title,
        attr: ex ? ex.attr : t.kind === 'workout' ? 'end' : 'dis',
        exId: ex && t.amount ? ex.id : undefined, amount: ex && t.amount ? t.amount : undefined,
        icon: t.forfeit ? '⚖️' : t.kind === 'workout' ? (ex && WORKOUTS.some(w => w.id === ex.id) ? ex.icon : '🏋️') : '📜',
        detail: `${amt}${EFFORTS[t.effort].label}${t.repeat === 'once' ? ' · today only' : ''}`,
        xp: effortXP(t.effort, d.level, diff), generated: false,
        timer: ex && t.amount ? timerSeconds(ex.unit, t.amount) : 0,
      });
    }
    return list.map(q => ({ ...q, done: !!d.done[q.key], awarded: d.done[q.key]?.xp, crit: d.done[q.key]?.crit }));
  }
  function challengeQuest() {
    const c = state.day.challenge;
    return { key: 'c:daily', kind: c.kind, title: c.title, icon: c.icon, xp: c.xp, gold: c.gold, challenge: true, attr: c.kind === 'workout' ? 'end' : 'dis', done: !!state.day.done['c:daily'], awarded: state.day.done['c:daily']?.xp };
  }

  function progress(day = state.day) {
    let w = 0, t = 0;
    for (const v of Object.values(day.done)) { if (v.quick) continue; v.kind === 'workout' ? w++ : t++; }
    const need = day.req.workouts + day.req.tasks;
    const got = Math.min(w, day.req.workouts) + Math.min(t, day.req.tasks);
    return { workouts: w, tasks: t, pct: need ? got / need : 1, met: got >= need };
  }
  function comboWindow() {
    const gs = gearStats();
    return ((gs.uniques.has('timelord') ? 30 : 15) + gs.combo) * 60 * 1000;
  }
  function comboMult(c) { return 1 + Math.min(Math.max(c - 1, 0), gearStats().uniques.has('timelord') ? 8 : 5) * 0.1; }
  function comboActive() { return state.day.combo > 1 && Date.now() - state.day.lastAt < comboWindow(); }
  function comboLeftMs() { return Math.max(0, comboWindow() - (Date.now() - state.day.lastAt)); }

  /* ---------- quick quests ---------- */
  function quickFillAmount(def, lv, diff) {
    if (!def.base) return null;
    const D = DIFFICULTIES[diff];
    return niceRound(def.base * (def.unit === 'min' || def.unit === 'times' || def.unit === 'rounds' ? 1 + (D.rep - 1) * 0.4 : D.rep) * (1 + (lv - 1) * D.repGrowth * (def.growth ?? 1)));
  }
  /* Pick a random quick quest (not stored until accepted). */
  function rollQuick({ kind = 'any', time = 5 } = {}, exclude = []) {
    const lv = level(), diff = state.hero.difficulty;
    const active = new Set([...(state.day.quick || []).map(q => q.t), ...exclude]);
    let pool = QUICK_QUESTS.filter(q => q.time === +time && (kind === 'any' || q.kind === kind));
    const fresh = pool.filter(q => !active.has(q.t));
    if (fresh.length) pool = fresh;
    const def = pick(pool);
    const amount = quickFillAmount(def, lv, diff);
    const title = def.t.replace(/\{n\}/g, amount);
    const timer = def.fixedTimer || (def.unit === 'sec' ? amount : def.unit === 'min' ? amount * 60 : 0);
    const xp = Math.round(QUICK_TIMES[def.time].xp * DIFFICULTIES[diff].xp * levelXpScale(lv));
    const monster = Math.random() < 0.15 ? makeEnemy(lv, diff) : null;
    return { t: def.t, title, icon: def.icon, kind: def.kind, time: def.time, amount, exId: def.ex || null, timer, xp, gold: Math.max(3, Math.round(xp / 3)), monster };
  }
  function quickFullLeft() { return Math.max(0, QUICK_FULL_PER_DAY - (state.day.quickDone || 0)); }
  function acceptQuick(c) {
    state.day.quick = state.day.quick || [];
    const q = { ...c, id: uid(), acceptedAt: Date.now() };
    state.day.quick.unshift(q);
    save();
    return q;
  }
  function removeQuick(id) {
    if (state.day.done['q:' + id]) return;
    state.day.quick = (state.day.quick || []).filter(q => q.id !== id);
    save();
  }
  function payGold(n) { if (state.hero.gold < n) return false; state.hero.gold -= n; save(); return true; }
  function quickQuests() {
    const half = quickFullLeft() === 0;
    return (state.day.quick || []).map(q => {
      const done = state.day.done['q:' + q.id];
      return {
        key: 'q:' + q.id, quickId: q.id, kind: q.kind, title: q.title, icon: q.icon, exId: q.exId, amount: q.amount,
        attr: q.exId ? (WORKOUTS.find(w => w.id === q.exId) || {}).attr || 'end' : q.kind === 'workout' ? 'end' : 'dis',
        xp: done ? q.xp : Math.round(q.xp * (half ? 0.5 : 1)), gold: q.gold, timer: q.timer, quick: true, time: q.time,
        monster: q.monster, acceptedAt: q.acceptedAt, speedUntil: q.acceptedAt + q.time * 60 * 1000,
        done: !!done, awarded: done?.xp, crit: done?.crit,
      };
    });
  }

  /* ---------- actions ---------- */
  function complete(key, { viaTimer = false } = {}) {
    const q = key === 'c:daily' ? challengeQuest() : key.startsWith('q:') ? quickQuests().find(x => x.key === key) : quests().find(x => x.key === key);
    if (!q || q.done) return [];
    const d = state.day, events = [];
    const lvBefore = level();
    const now = Date.now();

    d.combo = now - d.lastAt < comboWindow() ? d.combo + 1 : 1;
    d.lastAt = now;
    state.stats.maxCombo = Math.max(state.stats.maxCombo, d.combo);
    const gs = gearStats();
    const first = Object.keys(d.done).length === 0 && gs.uniques.has('secondwind');
    const crit = Math.random() < critChance();
    const critMult = crit ? (gs.uniques.has('executioner') ? 3 : 2) : 1;
    const skill = q.kind === 'workout' ? state.skills.warrior : state.skills.scholar;
    const speed = q.quick && now <= q.speedUntil;
    const halfQuick = q.quick && quickFullLeft() === 0;
    const mult = (1 + gearBonus() / 100 + skill * 0.05) * comboMult(d.combo) * critMult * (first ? 1.5 : 1) * (speed ? 1.25 : 1);
    const xp = Math.round(q.xp * mult);
    const gold = Math.round((q.gold || Math.max(2, q.xp / 4)) * critMult * (1 + gs.gold / 100) * (halfQuick ? 0.5 : 1));
    const damage = Math.round(100 * (1 + gs.power / 100) * critMult * (first ? 2 : 1));
    const bossDmg = state.boss && !state.boss.defeated ? Math.min(state.boss.hp, damage) : 0;
    const hpBefore = state.hero.hp;
    state.hero.hp = Math.min(heroMaxHP(), state.hero.hp + gs.regen + (crit && gs.uniques.has('vampire') ? 15 : 0));
    const healed = state.hero.hp - hpBefore;

    d.done[key] = { xp, gold, kind: q.kind, at: now, crit, attr: q.attr, exId: q.exId, amount: q.amount, bossDmg, healed, timer: viaTimer, challenge: !!q.challenge, quick: !!q.quick };
    state.hero.totalXP += xp;
    addGold(gold);
    state.stats[q.kind === 'workout' ? 'workouts' : 'tasks']++;
    state.attrs[q.attr] = (state.attrs[q.attr] || 0) + 1;
    if (q.exId && q.amount) state.stats.reps[q.exId] = Math.round(((state.stats.reps[q.exId] || 0) + q.amount) * 10) / 10;
    if (crit) state.stats.crits++;
    if (viaTimer) state.stats.timers++;
    if (q.challenge) state.stats.challenges++;
    if (q.quick) { d.quickDone = (d.quickDone || 0) + 1; state.stats.quick = (state.stats.quick || 0) + 1; }
    events.push({ type: 'xp', amount: xp, gold, crit, critMult, combo: d.combo, kind: q.kind, damage, healed, secondWind: first, speed, halfQuick });
    // A wandering monster rides along with some quick quests.
    const qq = q.quick && (d.quick || []).find(x => 'q:' + x.id === key);
    if (qq && qq.monster && !qq.monsterBeaten) {
      qq.monsterBeaten = true;
      state.stats.monsters = (state.stats.monsters || 0) + 1;
      state.bestiary[qq.monster.tier] = (state.bestiary[qq.monster.tier] || 0) + 1;
      if (Math.random() < 0.5) {
        const item = makeItem(level(), state.hero.difficulty);
        events.push({ type: 'monster', monster: qq.monster, item, autoEquip: giveItem(item) });
      } else {
        const mg = Math.round((40 + level() * 4) * (1 + gs.gold / 100) * (gs.uniques.has('midas') ? 2 : 1));
        addGold(mg);
        events.push({ type: 'monster', monster: qq.monster, gold: mg });
      }
    }
    if (q.challenge) events.push({ type: 'challenge', gold });

    if (bossDmg) {
      state.boss.hp = Math.max(0, state.boss.hp - bossDmg);
      events.push({ type: 'bossHit', dmg: bossDmg });
      if (state.boss.hp === 0) {
        state.boss.defeated = true;
        state.stats.bosses++;
        const item = makeItem(level(), state.hero.difficulty, { minRarity: 'epic' });
        const autoEquip = giveItem(item);
        const g = Math.round((200 + level() * 15) * (1 + gs.gold / 100) * (gs.uniques.has('midas') ? 2 : 1));
        addGold(g);
        events.push({ type: 'bossDefeat', boss: state.boss, item, autoEquip, gold: g });
      }
    }

    const p = progress();
    if (p.met) {
      if (!d.bonusXP) {
        d.bonusXP = goalBonusXP(d.level, state.hero.difficulty);
        state.hero.totalXP += d.bonusXP;
        events.push({ type: 'bonus', amount: d.bonusXP });
      }
      if (!d.streakCounted) {
        d.streakCounted = true;
        state.hero.streak++;
        state.hero.bestStreak = Math.max(state.hero.bestStreak, state.hero.streak);
        if (new Date().getHours() < 12 && !d.rest) state.stats.earlyWins++;
        const m = state.motivation;
        if (m.streakReward.trim() && state.hero.streak % m.streakGoal === 0 && !d.streakRewardShown) {
          d.streakRewardShown = true;
          events.push({ type: 'streakReward', streak: state.hero.streak, reward: m.streakReward });
        }
      }
      if (!d.lootGiven) {
        d.lootGiven = true;
        if (d.rest) {
          addGold(30);
          events.push({ type: 'defeat', enemy: d.enemy, item: null, gold: 30, rest: true });
        } else {
          state.stats.enemies++;
          state.bestiary[d.enemy.tier] = (state.bestiary[d.enemy.tier] || 0) + 1;
          const item = makeItem(d.level, state.hero.difficulty);
          const autoEquip = giveItem(item);
          const g = Math.round((25 + d.level * 3) * (1 + gs.gold / 100) * (gs.uniques.has('midas') ? 2 : 1));
          addGold(g);
          events.push({ type: 'defeat', enemy: d.enemy, item, autoEquip, gold: g });
        }
      }
    }
    const lvAfter = level();
    if (lvAfter > lvBefore) {
      state.hero.hp = heroMaxHP();
      const sp = Math.floor(lvAfter / 5) > Math.floor(lvBefore / 5);
      events.push({ type: 'levelup', from: lvBefore, to: lvAfter, skillPoint: sp });
    }
    const perfect = quests().every(x => x.done);
    events.push(...checkAchievements({ perfect, hour: new Date().getHours() }));
    save();
    return events;
  }

  function undo(key) {
    const e = state.day.done[key];
    if (!e) return;
    delete state.day.done[key];
    state.hero.totalXP = Math.max(0, state.hero.totalXP - e.xp);
    state.hero.gold = Math.max(0, state.hero.gold - (e.gold || 0));
    state.stats.goldEarned = Math.max(0, state.stats.goldEarned - (e.gold || 0));
    const k = e.kind === 'workout' ? 'workouts' : 'tasks';
    state.stats[k] = Math.max(0, state.stats[k] - 1);
    if (e.attr) state.attrs[e.attr] = Math.max(0, (state.attrs[e.attr] || 0) - 1);
    if (e.exId) state.stats.reps[e.exId] = Math.max(0, Math.round(((state.stats.reps[e.exId] || 0) - (e.amount || 0)) * 10) / 10);
    if (e.crit) state.stats.crits = Math.max(0, state.stats.crits - 1);
    if (e.timer) state.stats.timers = Math.max(0, state.stats.timers - 1);
    if (e.challenge) state.stats.challenges = Math.max(0, state.stats.challenges - 1);
    if (e.quick) { state.day.quickDone = Math.max(0, (state.day.quickDone || 0) - 1); state.stats.quick = Math.max(0, (state.stats.quick || 0) - 1); }
    if (e.bossDmg && state.boss && !state.boss.defeated) state.boss.hp = Math.min(state.boss.maxHp, state.boss.hp + e.bossDmg);
    if (e.healed) state.hero.hp = Math.max(1, state.hero.hp - e.healed);
    if (!progress().met) {
      if (state.day.bonusXP) { state.hero.totalXP = Math.max(0, state.hero.totalXP - state.day.bonusXP); state.day.bonusXP = 0; }
      if (state.day.streakCounted) { state.day.streakCounted = false; state.hero.streak = Math.max(0, state.hero.streak - 1); }
    }
    state.day.combo = 0;
    state.hero.hp = Math.min(state.hero.hp, heroMaxHP());
    save();
  }

  function swapWorkout(key) {
    const d = state.day;
    if (d.swaps < 1 || d.done[key] || !key.startsWith('w:')) return null;
    const idx = d.workouts.findIndex(w => 'w:' + w.id === key);
    if (idx < 0) return null;
    const used = new Set(d.workouts.map(w => w.exId));
    const options = d.rest ? WORKOUTS.filter(w => ['stretch', 'walk', 'calves', 'bridges'].includes(w.id) && !used.has(w.id)) : WORKOUTS.filter(w => !used.has(w.id));
    if (!options.length) return null;
    d.workouts[idx] = makeWorkout(pick(options), d.level, state.hero.difficulty, d.rest ? 0.6 : 1);
    d.swaps--;
    state.stats.swaps++;
    save();
    return d.workouts[idx];
  }

  function openChest() {
    const d = state.day;
    if (d.chest !== 'closed') return null;
    d.chest = 'open';
    state.stats.chests++;
    const r = Math.random(), lv = level();
    let res;
    if (r < 0.12) { const item = makeItem(lv, state.hero.difficulty); res = { type: 'item', item, autoEquip: giveItem(item) }; }
    else if (r < 0.32) { state.consumables.potion++; res = { type: 'potion' }; }
    else if (r < 0.37) { state.consumables.shield = Math.min(3, state.consumables.shield + 1); res = { type: 'shield' }; }
    else { const gs = gearStats(); const g = Math.round((rand(15, 40) + lv * 2) * (1 + gs.gold / 100) * (gs.uniques.has('midas') ? 2 : 1)); addGold(g); res = { type: 'gold', gold: g }; }
    res.events = checkAchievements();
    save();
    return res;
  }

  /* ---------- exercises (built-in + user-made) ---------- */
  function exerciseInfo(exId) {
    const w = WORKOUTS.find(x => x.id === exId);
    if (w) return { id: w.id, name: w.name, unit: w.unit, attr: w.attr, icon: w.icon };
    const c = state.customExercises[exId];
    if (c) return { id: exId, name: c.name, unit: c.unit, attr: c.attr, icon: '🏋️' };
    return null;
  }
  function allExercises() {
    return [...WORKOUTS.map(w => exerciseInfo(w.id)), ...Object.keys(state.customExercises).map(exerciseInfo)];
  }
  /* Find or create a user-made exercise like "Pull-ups (reps)". */
  function customExercise(name, unit) {
    name = String(name || '').trim().slice(0, 40);
    if (!name) return null;
    unit = CUSTOM_UNITS.includes(unit) ? unit : 'reps';
    const found = Object.entries(state.customExercises).find(([, c]) => c.name.toLowerCase() === name.toLowerCase() && c.unit === unit);
    if (found) return found[0];
    const id = 'c_' + uid();
    state.customExercises[id] = { name, unit, attr: unit === 'reps' || unit === 'times' ? 'str' : 'end' };
    return id;
  }
  /* Guess exercise + amount from a title like "40 push-ups" or "Plank 60 sec". */
  function detectExercise(title) {
    const raw = String(title || '').toLowerCase();
    const flat = raw.replace(/[\s\-_]/g, '');
    let exId = null;
    for (const [id, words] of Object.entries(EXERCISE_ALIASES)) if (words.some(wd => flat.includes(wd))) { exId = id; break; }
    if (!exId) for (const [id, c] of Object.entries(state.customExercises)) if (flat.includes(c.name.toLowerCase().replace(/[\s\-_]/g, ''))) { exId = id; break; }
    const m = raw.match(/(\d+(?:[.,]\d+)?)/);
    const amount = m ? Math.round(parseFloat(m[1].replace(',', '.')) * 10) / 10 : null;
    // A distance ("5 km") doesn't fit an exercise counted in minutes: suggest a km exercise instead.
    if (/\d\s*km\b|\bkm\b/.test(raw) && (!exId || exerciseInfo(exId).unit !== 'km')) {
      const name = String(title).replace(/\d+(?:[.,]\d+)?/g, '').replace(/\bkm\b/gi, '').replace(/\s+/g, ' ').trim() || 'Running';
      const existing = Object.entries(state.customExercises).find(([, c]) => c.unit === 'km' && c.name.toLowerCase() === name.toLowerCase());
      return existing ? { exId: existing[0], amount } : { exId: 'other', amount, customName: name[0].toUpperCase() + name.slice(1), customUnit: 'km' };
    }
    return { exId, amount };
  }
  function cleanAmount(a) { const n = Math.round(parseFloat(String(a).replace(',', '.')) * 10) / 10; return n > 0 && n < 100000 ? n : null; }
  /* Resolve form fields into { exId, amount } (exId may be "other" → new custom exercise). */
  function resolveExercise({ exId, amount, customName, customUnit }) {
    if (!exId) return { exId: null, amount: null };
    if (exId === 'other') exId = customExercise(customName, customUnit);
    if (!exId || !exerciseInfo(exId)) return { exId: null, amount: null };
    return { exId, amount: cleanAmount(amount) };
  }

  function addTask({ title, effort, kind, repeat, exId, amount, customName, customUnit }) {
    title = String(title || '').trim().slice(0, 80);
    if (!title) return null;
    const t = { id: uid(), title, effort: EFFORTS[effort] ? effort : 'medium', kind: kind === 'workout' ? 'workout' : 'task', repeat: repeat === 'once' ? 'once' : 'daily', day: todayKey() };
    if (t.kind === 'workout') Object.assign(t, resolveExercise({ exId, amount, customName, customUnit }), { linkAsked: true });
    state.tasks.push(t);
    save();
    return t;
  }
  function updateTask(id, patch) {
    const t = state.tasks.find(x => x.id === id);
    if (!t) return null;
    if (patch.title != null && String(patch.title).trim()) t.title = String(patch.title).trim().slice(0, 80);
    if (patch.effort && EFFORTS[patch.effort]) t.effort = patch.effort;
    if (t.kind === 'workout' && 'exId' in patch) Object.assign(t, resolveExercise(patch));
    t.linkAsked = true;
    save();
    return t;
  }
  /* Custom workouts made before exercise tracking existed. */
  function unlinkedWorkouts() { return state.tasks.filter(t => t.kind === 'workout' && !t.exId && !t.linkAsked); }
  function dismissLinking() { for (const t of unlinkedWorkouts()) t.linkAsked = true; save(); }
  /* Manual correction for lifetime totals. */
  function addReps(exId, amount) {
    const info = exerciseInfo(exId), n = cleanAmount(amount);
    if (!info || !n) return false;
    state.stats.reps[exId] = Math.round(((state.stats.reps[exId] || 0) + n) * 10) / 10;
    save();
    return true;
  }
  function removeTask(id) {
    if (state.day.done['t:' + id]) return false;
    state.tasks = state.tasks.filter(t => t.id !== id);
    save();
    return true;
  }

  /* ---------- achievements ---------- */
  function checkAchievements(extra = {}) {
    const gs = gearStats();
    const ctx = { level: level(), hour: -1, perfect: false, setCount: setInfo().count, uniques: gs.uniques.size, power: gs.power, ...extra };
    const out = [];
    for (const a of ACHIEVEMENTS) {
      if (state.achievements[a.id]) continue;
      let ok = false;
      try { ok = a.test(state, ctx); } catch { ok = false; }
      if (ok) { state.achievements[a.id] = todayKey(); out.push({ type: 'achievement', ach: a }); }
    }
    if (out.length) save();
    return out;
  }
  function lookUnlocked(req) {
    if (!req) return true;
    if (req.level && level() < req.level) return false;
    if (req.ach && !state.achievements[req.ach]) return false;
    return true;
  }
  function setLook(patch) {
    const L = state.look;
    if ('hair' in patch) L.hair = clamp(+patch.hair, 0, LOOKS.hairStyles.length - 1);
    if ('hairColor' in patch) L.hairColor = clamp(+patch.hairColor, 0, LOOKS.hairColors.length - 1);
    if ('skin' in patch) L.skin = clamp(+patch.skin, 0, LOOKS.skins.length - 1);
    if ('cape' in patch) { const c = LOOKS.capes.find(x => x.id === patch.cape); L.cape = c && lookUnlocked(c.req) ? c.id : null; }
    if ('pet' in patch) { const p = LOOKS.pets.find(x => x.id === patch.pet); L.pet = p && lookUnlocked(p.req) ? p.id : null; }
    save();
  }

  /* ---------- day settlement ---------- */
  const armorReduce = (dmg) => Math.max(1, Math.round(dmg * (1 - gearStats().armor / 100)));
  function damageHero(amount, report) {
    amount = armorReduce(amount);
    state.hero.hp -= amount;
    report.damage += amount;
    if (state.hero.hp <= 0 && gearStats().uniques.has('phoenix') && state.phoenixWeek !== weekKey()) {
      state.phoenixWeek = weekKey();
      state.hero.hp = 1;
      report.phoenix = true;
      return amount;
    }
    if (state.hero.hp <= 0) {
      const info = levelInfo(state.hero.totalXP);
      const lost = Math.floor(info.into / 2);
      state.hero.totalXP -= lost;
      state.hero.hp = heroMaxHP();
      report.knockouts++;
      report.xpLost += lost;
      const worn = Object.keys(SLOTS).map(equippedItem).filter(Boolean);
      if (worn.length) {
        const it = pick(worn);
        state.equipped[it.slot] = null;
        state.inventory = state.inventory.filter(i => i.id !== it.id);
        report.stolen.push(it.name);
      }
    }
    return amount;
  }
  function loseStreak(report) {
    if (state.hero.streak > 0 && state.consumables.shield > 0) {
      state.consumables.shield--;
      report.shieldUsed++;
      return;
    }
    state.hero.streak = 0;
  }
  function settleDays(today) {
    const d = state.day;
    const report = { days: [], damage: 0, knockouts: 0, xpLost: 0, stolen: [], penalty: null, shieldUsed: 0 };
    const p = progress(d);
    state.history.push({ key: d.key, met: p.met, workouts: p.workouts, tasks: p.tasks, done: p.workouts + p.tasks, enemy: d.enemy.name, rest: !!d.rest });
    if (p.met) {
      const heal = d.rest ? Math.round(heroMaxHP() * 0.4) : Math.round(heroMaxHP() * 0.25);
      state.hero.hp = Math.min(heroMaxHP(), state.hero.hp + heal);
      report.days.push({ key: d.key, met: true, enemy: d.enemy.name, heal, rest: d.rest });
    } else if (d.rest) {
      loseStreak(report);
      report.days.push({ key: d.key, met: false, enemy: d.enemy.name, dmg: 0, rest: true });
    } else {
      loseStreak(report);
      const dmg = damageHero(Math.max(1, Math.round(d.enemy.attack * (1 - p.pct))), report);
      report.days.push({ key: d.key, met: false, enemy: d.enemy.name, dmg });
    }
    const missed = Math.min(3, daysBetween(d.key, today) - 1);
    for (let i = 0; i < missed; i++) {
      const e = makeEnemy(level(), state.hero.difficulty);
      loseStreak(report);
      const dmg = damageHero(e.attack, report);
      report.days.push({ key: 'skipped', met: false, enemy: e.name, dmg });
    }
    state.history = state.history.slice(-400);
    return report;
  }

  function ensureToday() {
    const key = todayKey();
    if (!state.day) { newDay(key); ensureBoss(key); save(); return null; }
    if (state.day.key === key) { ensureBoss(key); return null; }
    const report = settleDays(key);
    ensureBoss(key, report);
    newDay(key);
    const pen = state.motivation.penalty.trim();
    if (report.knockouts && pen) {
      const t = addTask({ title: `Forfeit: ${pen}`, effort: 'easy', kind: 'task', repeat: 'once' });
      if (t) t.forfeit = true;
      report.penalty = pen;
    }
    save();
    return report;
  }

  function stakes() {
    const p = progress();
    const info = levelInfo(state.hero.totalXP);
    const dmg = p.met || state.day.rest ? 0 : armorReduce(Math.max(1, Math.round(state.day.enemy.attack * (1 - p.pct))));
    const hpAfter = state.hero.hp - dmg;
    const phoenix = gearStats().uniques.has('phoenix') && state.phoenixWeek !== weekKey();
    return { dmg, hpAfter, phoenix, knockout: hpAfter <= 0 && !phoenix, xpLoss: Math.floor(info.into / 2), met: p.met, shield: state.consumables.shield > 0 };
  }

  /* ---------- motivation & settings ---------- */
  const DEFAULT_MOTIVATION = { why: '', dailyReward: '', streakReward: '', streakGoal: 7, penalty: '' };
  function setMotivation(m) {
    const clean = (v) => String(v || '').trim().slice(0, 120);
    state.motivation = {
      why: clean(m.why), dailyReward: clean(m.dailyReward), streakReward: clean(m.streakReward),
      streakGoal: [3, 5, 7, 14, 30].includes(+m.streakGoal) ? +m.streakGoal : 7, penalty: clean(m.penalty),
    };
    save();
  }
  function hasMotivation() { const m = state.motivation; return !!(m.why || m.dailyReward || m.streakReward || m.penalty); }
  function setSetting(k, v) { state.settings[k] = v; save(); }

  /* ---------- persistence ---------- */
  function migrate(s) {
    s.version = 2;
    s.hero.gold ??= 0;
    s.consumables = { potion: 0, shield: 0, ...(s.consumables || {}) };
    s.skills = { warrior: 0, scholar: 0, tank: 0, lucky: 0, ...(s.skills || {}) };
    s.attrs = { str: 0, end: 0, dis: 0, ...(s.attrs || {}) };
    s.stats = { workouts: 0, tasks: 0, enemies: 0, crits: 0, bosses: 0, chests: 0, potions: 0, challenges: 0, goldEarned: 0, maxCombo: 0, swaps: 0, timers: 0, earlyWins: 0, reps: {}, ...(s.stats || {}) };
    s.bestiary ??= {};
    s.customExercises ??= {};
    s.achievements ??= {};
    s.look = { hair: 0, hairColor: 0, skin: 0, cape: null, pet: null, ...(s.look || {}) };
    s.settings = { restDay: null, reminders: false, reminderTime: '18:00', lastReminded: null, taunts: 'normal', ...(s.settings || {}) };
    s.boss ??= null;
    if (s.boss && s.boss.hits != null) { s.boss.maxHp = s.boss.maxHits * 100; s.boss.hp = s.boss.hits * 100; delete s.boss.hits; delete s.boss.maxHits; }
    for (const it of s.inventory) {
      it.base ??= baseOf(it);
      if (!it.effects) {
        it.effects = rollEffects(it.slot, it.rarity, it.tier);
        if (it.rarity === 'legendary') it.unique = pick(Object.keys(UNIQUES));
        if (it.effects.length) it.name = itemName(it);
      }
    }
    s.motivation = { ...DEFAULT_MOTIVATION, ...(s.motivation || {}) };
    if (s.day) {
      const d = s.day;
      d.quick ??= []; d.quickDone ??= 0;
      d.combo ??= 0; d.lastAt ??= 0; d.swaps ??= 1; d.chest ??= 'closed'; d.rest ??= false;
      if (!d.challenge) {
        const ch = CHALLENGES[hashStr(d.key + s.hero.name) % CHALLENGES.length];
        d.challenge = { ...ch, xp: Math.round(EFFORTS.hard.xp * 1.5 * DIFFICULTIES[s.hero.difficulty].xp), gold: 40 };
      }
      for (const w of d.workouts) w.attr ??= (WORKOUTS.find(x => x.id === w.exId) || {}).attr || 'str';
    }
    return s;
  }
  function freshState(name, difficulty) {
    return migrate({
      hero: { name, difficulty, totalXP: 0, hp: 100, streak: 0, bestStreak: 0, created: todayKey(), gold: 0 },
      tasks: DEFAULT_TASKS.map(t => ({ ...t, id: uid(), repeat: 'daily', day: todayKey() })),
      inventory: [],
      equipped: { weapon: null, helmet: null, armor: null, shield: null, boots: null },
      day: null, history: [],
    });
  }
  function start(name, difficulty) {
    state = freshState(String(name || 'Hero').trim().slice(0, 20) || 'Hero', DIFFICULTIES[difficulty] ? difficulty : 'beginner');
    const sword = { id: uid(), slot: 'weapon', rarity: 'common', bonus: 2, name: 'Wooden Sword', base: 'Sword', tier: 0, effects: [], found: todayKey() };
    state.inventory.push(sword);
    state.equipped.weapon = sword.id;
    state.consumables.potion = 1;
    newDay(todayKey());
    ensureBoss(todayKey());
    save();
  }
  function validSave(s) { return s && s.hero && DIFFICULTIES[s.hero.difficulty] && Array.isArray(s.tasks) && Array.isArray(s.inventory); }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      if (!validSave(s)) return false;
      state = migrate(s);
      save();
      return true;
    } catch { return false; }
  }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ } }
  function reset() { try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ } state = null; }
  function exportData() { return JSON.stringify({ app: 'questfit', exported: new Date().toISOString(), save: state }); }
  function importData(text) {
    let obj;
    try { obj = JSON.parse(text); } catch { return false; }
    const s = obj && obj.app === 'questfit' ? obj.save : obj;
    if (!validSave(s)) return false;
    state = migrate(s);
    save();
    return true;
  }
  function setDifficulty(diffId) {
    if (!DIFFICULTIES[diffId]) return;
    state.hero.difficulty = diffId;
    const old = state.day;
    const keepDone = Object.fromEntries(Object.entries(old.done).filter(([k]) => !k.startsWith('w:')));
    newDay(todayKey());
    Object.assign(state.day, { done: keepDone, lootGiven: old.lootGiven, bonusXP: old.bonusXP, streakCounted: old.streakCounted, chest: old.chest, swaps: old.swaps, challenge: old.challenge });
    save();
  }
  function rename(name) { name = String(name || '').trim().slice(0, 20); if (name) { state.hero.name = name; save(); } }

  return {
    get state() { return state; },
    todayKey, keyToDate, weekKey, daysLeftInWeek, hashStr, levelInfo, xpToNext, rankFor, nextRank, maxHP, heroMaxHP, requirements,
    gearBonus, gearStats, reforge, reforgePrice, setInfo, equippedItem, sellPrice, critChance, comboMult, comboActive, comboLeftMs,
    quests, challengeQuest, quickQuests, rollQuick, acceptQuick, removeQuick, quickFullLeft, payGold, progress, complete, undo, swapWorkout, openChest, addTask, removeTask, equip, discard,
    buy, shopPrice, usePotion, skillPoints, spendSkill, resetSkills, lookUnlocked, setLook, checkAchievements,
    exerciseInfo, allExercises, resolveExercise, detectExercise, updateTask, unlinkedWorkouts, dismissLinking, addReps,
    stakes, setMotivation, hasMotivation, setSetting, ensureToday, start, load, reset, exportData, importData,
    setDifficulty, rename, workoutAmount,
  };
})();
