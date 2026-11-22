/* QuestFit — rendering & interaction */
'use strict';

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let currentTab = 'quests';
  let editingTasks = false;
  let addOpen = false;
  let justDone = null;

  /* ---------- top-level render ---------- */
  function renderAll() {
    const s = Game.state;
    const D = DIFFICULTIES[s.hero.difficulty];
    $('#diff-badge').textContent = `${D.icon} ${D.label}`;
    $('#diff-badge').className = `diff-badge diff-${D.id}`;
    $('#date-label').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    renderHero();
    renderBattle();
    renderQuests();
    renderGear();
    renderJourney();
  }

  function renderHero() {
    const s = Game.state;
    const info = Game.levelInfo(s.hero.totalXP);
    const rank = Game.rankFor(info.level);
    const hpMax = Game.maxHP(info.level);
    const hpPct = Math.max(0, Math.min(1, s.hero.hp / hpMax));
    $('#hero-card').innerHTML = `
      <div class="hero-art ${hpPct < 0.3 ? 'hurt' : ''}" id="hero-art">${Art.hero(s, info.level)}</div>
      <div class="hero-info">
        <div class="hero-name">${esc(s.hero.name)}</div>
        <div class="hero-rank">${esc(rank.title)}</div>
        <div class="level-badge" title="Your level"><small>LVL</small><b>${info.level}</b></div>
        <div class="bar-label"><span>XP</span><span>${info.into} / ${info.need}</span></div>
        <div class="bar xp-bar"><div class="fill" style="width:${(info.pct * 100).toFixed(1)}%"></div></div>
        <div class="bar-label"><span>HP</span><span>${Math.max(0, s.hero.hp)} / ${hpMax}</span></div>
        <div class="bar hp-bar ${hpPct < 0.3 ? 'low' : ''}"><div class="fill" style="width:${(hpPct * 100).toFixed(1)}%"></div></div>
        <div class="hero-chips">
          <span class="chip" title="Days in a row you beat the enemy">🔥 ${s.hero.streak} day streak</span>
          ${hpPct < 0.3 ? '<span class="chip chip-danger">🩸 Low HP — win today!</span>' : ''}
          <span class="chip" title="Bonus XP from equipped gear">✨ +${Game.gearBonus()}% XP</span>
        </div>
      </div>`;
  }

  function renderBattle() {
    const s = Game.state, d = s.day, p = Game.progress();
    const hp = Math.round(d.enemy.maxHp * (1 - p.pct));
    const defeated = p.met;
    const meter = (label, icon, got, need) => {
      const ok = got >= need;
      const pips = Array.from({ length: need }, (_, i) => `<i class="pip ${i < got ? 'on' : ''}"></i>`).join('');
      return `<div class="goal ${ok ? 'ok' : ''}"><span class="goal-label">${icon} ${label}</span><span class="pips">${pips}</span><span class="goal-num">${Math.min(got, need)}/${need}${ok ? ' ✓' : ''}</span></div>`;
    };
    $('#battle-card').innerHTML = `
      <div class="battle-head">
        <span class="eyebrow">Today's enemy</span>
        ${defeated ? '<span class="defeated-tag">DEFEATED</span>' : `<span class="enemy-atk" title="Damage you take tonight if the goal isn't met">⚔️ hits for ${d.enemy.attack}</span>`}
      </div>
      ${s.motivation.why ? `<div class="why-quote">💭 <span>“${esc(s.motivation.why)}”</span></div>` : ''}
      <div class="battle-row">
        <div class="enemy-art ${defeated ? 'is-defeated' : ''}" id="enemy-art">${Art.enemy(d.enemy.tier)}</div>
        <div class="enemy-info">
          <div class="enemy-name">${esc(d.enemy.name)}</div>
          <div class="bar-label"><span>Enemy HP</span><span>${hp} / ${d.enemy.maxHp}</span></div>
          <div class="bar enemy-bar"><div class="fill" style="width:${((1 - p.pct) * 100).toFixed(1)}%"></div></div>
          <div class="goals">
            ${meter('Workouts', '🏋️', p.workouts, d.req.workouts)}
            ${meter('Tasks', '📜', p.tasks, d.req.tasks)}
          </div>
        </div>
      </div>
      <div class="countdown ${defeated ? 'safe' : ''}" title="When today's quests reset">
        <span>${defeated ? '🌙 New day in' : '⏳ Enemy strikes in'}</span>
        <b id="day-countdown">${countdownText()}</b>
      </div>
      ${stakesBox()}
      <button class="btn ${Game.hasMotivation() ? 'btn-ghost' : 'btn-primary'} btn-block-sm" id="reasons-btn">${Game.hasMotivation() ? '✏️ My reasons & rewards' : '🎯 Set your reason, rewards & forfeit'}</button>`;
  }

  function stakesBox() {
    const s = Game.state, m = s.motivation, st = Game.stakes();
    const streakLine = () => {
      if (!m.streakReward) return '';
      const left = m.streakGoal - (s.hero.streak % m.streakGoal);
      if (st.met && left === m.streakGoal) return `<li>🏆 Streak reward earned: <b>${esc(m.streakReward)}</b></li>`;
      return `<li>🏆 ${left} more win${left > 1 ? 's' : ''} in a row for: <b>${esc(m.streakReward)}</b></li>`;
    };
    if (st.met) {
      return `<div class="stakes win-box">
        <div class="stakes-title">🏆 Victory! Daily goal complete</div>
        <ul>
          ${m.dailyReward ? `<li>🎁 You earned: <b>${esc(m.dailyReward)}</b>. Go enjoy it!</li>` : ''}
          <li>🔥 Streak is safe at ${s.hero.streak} day${s.hero.streak === 1 ? '' : 's'}</li>
          ${streakLine()}
          <li>➕ Extra quests still give XP</li>
        </ul></div>`;
    }
    const hpMax = Game.maxHP(Game.levelInfo(s.hero.totalXP).level);
    return `<div class="stakes">
      <div class="stakes-col win">
        <div class="stakes-title">If you win today</div>
        <ul>
          ${m.dailyReward ? `<li>🎁 <b>${esc(m.dailyReward)}</b></li>` : ''}
          <li>🎒 New gear</li>
          <li>🔥 Streak → ${s.hero.streak + 1}</li>
          ${streakLine()}
        </ul>
      </div>
      <div class="stakes-col lose ${st.knockout ? 'danger' : ''}">
        <div class="stakes-title">If you lose tonight</div>
        <ul>
          <li>💔 −${st.dmg} HP <small>(${Math.max(0, s.hero.hp)} → ${Math.max(0, st.hpAfter)})</small></li>
          ${s.hero.streak ? `<li>🔥 Lose your ${s.hero.streak}-day streak</li>` : ''}
          ${st.knockout ? `<li class="ko">💀 <b>KNOCKOUT!</b> ${st.xpLoss ? `−${st.xpLoss} XP and ` : ''}the enemy steals a piece of your gear</li>
            ${m.penalty ? `<li class="ko">⚖️ You owe: <b>${esc(m.penalty)}</b></li>` : ''}` : ''}
        </ul>
      </div>
      ${st.knockout ? '' : `<p class="ko-rule">At 0 HP you get knocked out: you lose XP and a piece of gear${m.penalty ? `, and you owe your forfeit (<b>${esc(m.penalty)}</b>)` : ''}. HP now: ${Math.max(0, s.hero.hp)}/${hpMax}.</p>`}
    </div>`;
  }

  function reasonsModal(intro = false) {
    const m = Game.state.motivation;
    const md = modal(`
      <div class="modal-burst">🎯</div>
      <h2>Why are you fighting?</h2>
      <p class="muted">Connect the game to your real life. Your reason shows up next to the enemy every day, rewards are things you allow yourself when you win, and the forfeit is what you owe if you get knocked out.</p>
      <form id="reasons-form" autocomplete="off">
        <label class="field"><span>💭 My reason</span>
          <input name="why" maxlength="120" value="${esc(m.why)}" placeholder="e.g. Have energy to play with my kids"></label>
        <label class="field"><span>🎁 Daily reward (when I beat the enemy)</span>
          <input name="dailyReward" maxlength="120" value="${esc(m.dailyReward)}" placeholder="e.g. One episode of my show"></label>
        <div class="field-row">
          <label class="field"><span>🏆 Big reward for a streak</span>
            <input name="streakReward" maxlength="120" value="${esc(m.streakReward)}" placeholder="e.g. New running shoes"></label>
          <label class="field field-narrow"><span>Wins in a row</span>
            <select name="streakGoal">${[3, 5, 7, 14, 30].map(n => `<option value="${n}" ${n === m.streakGoal ? 'selected' : ''}>${n} days</option>`).join('')}</select></label>
        </div>
        <label class="field"><span>⚖️ Forfeit (if I get knocked out)</span>
          <input name="penalty" maxlength="120" value="${esc(m.penalty)}" placeholder="e.g. No sweets tomorrow, or 50 extra push-ups"></label>
        <p class="muted small">A knockout adds the forfeit to your quest list for the next day.</p>
        <div class="modal-actions">
          ${intro ? '<button type="button" class="btn btn-ghost" data-close>Skip for now</button>' : '<button type="button" class="btn btn-ghost" data-close>Cancel</button>'}
          <button class="btn btn-primary" type="submit">Save</button>
        </div>
      </form>`, { onClose: renderAll });
    md.root.querySelector('#reasons-form').addEventListener('submit', (e) => {
      e.preventDefault();
      Game.setMotivation(Object.fromEntries(new FormData(e.target)));
      Sound.play('loot');
      md.close();
      toast('🎯 Your reasons are saved');
    });
  }

  /* Time left until local midnight, when the day rolls over. */
  function countdownText() {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const secs = Math.max(0, Math.floor((midnight - now) / 1000));
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }

  /* ---------- quests ---------- */
  function questRow(q) {
    const kindLabel = q.kind === 'workout' ? 'Workout' : 'Task';
    if (q.done) {
      return `<li class="quest done ${q.key === justDone ? 'just-done' : ''}" data-key="${q.key}">
        <span class="check" aria-hidden="true">✓</span>
        <div class="q-body"><div class="q-title">${q.icon} ${esc(q.title)}</div><div class="q-detail">${esc(q.detail)} · ${kindLabel}</div></div>
        <span class="xp-chip earned">+${q.awarded} XP</span>
        <button class="undo-btn" data-undo="${q.key}" aria-label="Undo ${esc(q.title)}">Undo</button>
      </li>`;
    }
    const del = editingTasks && !q.generated ? `<button class="del-btn" data-del="${q.taskId}" aria-label="Delete ${esc(q.title)}">🗑️</button>` : '';
    return `<li class="quest ${editingTasks && !q.generated ? 'editing' : ''}" data-key="${q.key}">
      <button class="quest-btn" data-complete="${q.key}" aria-label="Complete ${esc(q.title)}">
        <span class="check" aria-hidden="true"></span>
        <span class="q-body"><span class="q-title">${q.icon} ${esc(q.title)}</span><span class="q-detail">${esc(q.detail)} · ${kindLabel}</span></span>
        <span class="xp-chip">+${q.xp} XP</span>
      </button>${del}
    </li>`;
  }

  function renderQuests() {
    const s = Game.state, d = s.day, p = Game.progress();
    const qs = Game.quests();
    const todoW = qs.filter(q => !q.done && q.kind === 'workout');
    const todoT = qs.filter(q => !q.done && q.kind === 'task');
    const done = qs.filter(q => q.done).sort((a, b) => (d.done[b.key].at - d.done[a.key].at));
    const total = qs.length;
    $('#tab-count').textContent = `${done.length}/${total}`;

    const taskShortfall = Math.max(0, d.req.tasks - qs.filter(q => q.kind === 'task').length);
    const group = (title, need, got, items, emptyMsg) => `
      <div class="group">
        <div class="group-head"><h3>${title}</h3><span class="req ${got >= need ? 'ok' : ''}">${got >= need ? '✓ goal met' : `${need - got} more needed`}</span></div>
        ${items.length ? `<ul class="quest-list">${items.map(questRow).join('')}</ul>` : `<p class="empty">${emptyMsg}</p>`}
      </div>`;

    $('#tab-quests').innerHTML = `
      <div class="quests-summary">
        <div class="summary-ring" style="--p:${total ? done.length / total : 0}"><span>${done.length}<small>/${total}</small></span></div>
        <div>
          <div class="summary-title">${p.met ? 'Daily goal complete! 🎉' : 'Today\'s quests'}</div>
          <div class="summary-sub">Tap a quest when you've done it. Need <b>${d.req.workouts} workouts</b> and <b>${d.req.tasks} tasks</b> to beat the enemy.</div>
        </div>
      </div>
      ${group('🏋️ Workouts', d.req.workouts, p.workouts, todoW, 'All workouts done — nice work! 💪')}
      ${group('📜 Tasks', d.req.tasks, p.tasks, todoT, 'No tasks left. Add one below!')}
      ${taskShortfall ? `<p class="warn">⚠️ You need ${taskShortfall} more task${taskShortfall > 1 ? 's' : ''} on your list to be able to beat today's enemy.</p>` : ''}
      <div class="quest-tools">
        <button class="btn btn-primary" id="add-toggle">${addOpen ? '✕ Close' : '＋ Add quest'}</button>
        <button class="btn btn-ghost" id="edit-toggle">${editingTasks ? '✓ Done editing' : '✏️ Edit my quests'}</button>
      </div>
      ${addOpen ? addForm() : ''}
      ${done.length ? `<div class="group done-group">
        <div class="group-head"><h3>✅ Completed today</h3><span class="req ok">${done.length} done</span></div>
        <ul class="quest-list">${done.map(questRow).join('')}</ul>
      </div>` : ''}`;
  }

  function addForm() {
    return `<form class="add-form card" id="add-form" autocomplete="off">
      <label class="field"><span>What do you want to do?</span>
        <input name="title" maxlength="80" placeholder="e.g. Meditate 10 minutes" required></label>
      <div class="field-row">
        <label class="field"><span>Type</span>
          <select name="kind"><option value="task">📜 Task</option><option value="workout">🏋️ Workout</option></select></label>
        <label class="field"><span>Effort</span>
          <select name="effort">${Object.entries(EFFORTS).map(([k, e]) => `<option value="${k}" ${k === 'medium' ? 'selected' : ''}>${e.label} (${e.xp} base XP)</option>`).join('')}</select></label>
        <label class="field"><span>Repeat</span>
          <select name="repeat"><option value="daily">Every day</option><option value="once">Today only</option></select></label>
      </div>
      <button class="btn btn-primary" type="submit">Add quest</button>
    </form>`;
  }

  /* ---------- gear ---------- */
  function itemCard(it, equipped) {
    const R = RARITIES[it.rarity];
    return `<div class="item rarity-${it.rarity} ${equipped ? 'equipped' : ''}">
      <div class="item-icon">${SLOTS[it.slot].icon}</div>
      <div class="item-body">
        <div class="item-name" style="color:${R.color}">${esc(it.name)}</div>
        <div class="item-meta">${R.label} ${SLOTS[it.slot].label} · <b>+${it.bonus}% XP</b></div>
      </div>
      <div class="item-actions">
        ${equipped ? `<span class="equipped-tag">Equipped</span>` : `<button class="btn btn-small btn-primary" data-equip="${it.id}">Equip</button>
        <button class="btn btn-small btn-ghost" data-discard="${it.id}" aria-label="Discard ${esc(it.name)}">🗑️</button>`}
      </div>
    </div>`;
  }

  function renderGear() {
    const s = Game.state;
    const slots = Object.keys(SLOTS).map(slot => {
      const it = Game.equippedItem(slot);
      return `<div class="slot ${it ? 'rarity-' + it.rarity : 'empty'}">
        <div class="slot-icon">${SLOTS[slot].icon}</div>
        <div class="slot-label">${SLOTS[slot].label}</div>
        <div class="slot-item">${it ? esc(it.name) : 'Empty'}</div>
        ${it ? `<div class="slot-bonus">+${it.bonus}%</div>` : ''}
      </div>`;
    }).join('');
    const inv = s.inventory.slice().sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || b.bonus - a.bonus);
    $('#tab-gear').innerHTML = `
      <div class="card">
        <div class="section-head"><h2>Equipped</h2><span class="chip">✨ +${Game.gearBonus()}% XP from gear</span></div>
        <div class="slots">${slots}</div>
        <p class="muted">Gear boosts the XP you earn from every quest. Defeat the daily enemy to get a new piece of loot — higher levels and harder modes drop rarer gear.</p>
      </div>
      <div class="card">
        <div class="section-head"><h2>Backpack</h2><span class="muted">${inv.length} item${inv.length === 1 ? '' : 's'}</span></div>
        <div class="items">${inv.map(it => itemCard(it, s.equipped[it.slot] === it.id)).join('') || '<p class="empty">Nothing yet. Beat an enemy to earn loot!</p>'}</div>
      </div>`;
  }

  /* ---------- journey ---------- */
  function renderJourney() {
    const s = Game.state, diff = s.hero.difficulty;
    const info = Game.levelInfo(s.hero.totalXP);
    const from = Math.max(1, info.level - 2), to = info.level + 10;
    let prev = null, rows = '';
    for (let L = from; L <= to; L++) {
      const req = Game.requirements(L, diff);
      const rank = RANKS.find(r => r.level === L);
      const harder = prev && (req.workouts > prev.workouts || req.tasks > prev.tasks);
      const state = L < info.level ? 'past' : L === info.level ? 'current' : 'future';
      rows += `<li class="lvl ${state}">
        <span class="lvl-num">${L}</span>
        <span class="lvl-body">
          <b>${state === 'current' ? 'You are here' : state === 'past' ? 'Cleared' : `${Game.xpToNext(L - 1)} XP to reach`}</b>
          ${rank ? `<span class="rank-tag">🏅 ${rank.title}</span>` : ''}
          ${harder ? '<span class="harder-tag">⬆ harder</span>' : ''}
          <small>Daily: ${req.workouts} workouts · ${req.tasks} tasks · push-ups ×${Game.workoutAmount(WORKOUTS[0], L, diff)}</small>
        </span>
      </li>`;
      prev = req;
    }
    const nr = Game.nextRank(info.level);
    const hist = s.history.slice(-14);
    const histDots = hist.length ? hist.map(h => `<span class="hist-dot ${h.met ? 'win' : 'loss'}" title="${h.key}: ${h.met ? 'Beat' : 'Lost to'} ${esc(h.enemy)}">${h.met ? '🏆' : '💀'}</span>`).join('') : '<span class="muted">Your battle history will appear here after your first day.</span>';

    $('#tab-journey').innerHTML = `
      <div class="card">
        <div class="section-head"><h2>Level road</h2>${nr ? `<span class="chip">Next rank: ${nr.title} at Lv ${nr.level}</span>` : ''}</div>
        <p class="muted">The higher your level, the more quests you need each day and the bigger your workouts get. Enemies get tougher too.</p>
        <ol class="level-road">${rows}</ol>
      </div>
      <div class="card">
        <h2>Stats</h2>
        <div class="stats">
          <div class="stat"><b>${s.stats.workouts}</b><span>Workouts</span></div>
          <div class="stat"><b>${s.stats.tasks}</b><span>Tasks</span></div>
          <div class="stat"><b>${s.stats.enemies}</b><span>Enemies beaten</span></div>
          <div class="stat"><b>${s.hero.bestStreak}</b><span>Best streak</span></div>
        </div>
        <h3 class="mt">Last 14 days</h3>
        <div class="history">${histDots}</div>
      </div>
      <div class="card">
        <h2>Settings</h2>
        <form id="rename-form" class="inline-form">
          <label class="field"><span>Hero name</span><input name="name" maxlength="20" value="${esc(s.hero.name)}"></label>
          <button class="btn btn-ghost" type="submit">Save</button>
        </form>
        <div class="field"><span>Difficulty</span>
          <div class="diff-switch">${Object.values(DIFFICULTIES).map(D => `<button class="btn ${D.id === diff ? 'btn-primary' : 'btn-ghost'}" data-diff="${D.id}">${D.icon} ${D.label}</button>`).join('')}</div>
        </div>
        <div class="field"><span>Real-life motivation</span><div><button class="btn btn-ghost" id="reasons-btn2">🎯 Edit reason, rewards & forfeit</button></div></div>
        <button class="btn btn-danger mt" id="reset-btn">Start over</button>
      </div>`;
  }

  /* ---------- modals & effects ---------- */
  function modal(html, { onClose, dismissable = true } = {}) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
    const close = () => { root.innerHTML = ''; onClose && onClose(); };
    if (dismissable) root.querySelector('.modal-backdrop').addEventListener('click', (e) => { if (e.target.classList.contains('modal-backdrop')) close(); });
    root.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    return { root, close };
  }
  const queue = [];
  let showing = false;
  function enqueueModal(fn) { queue.push(fn); if (!showing) nextModal(); }
  function nextModal() {
    const fn = queue.shift();
    if (!fn) { showing = false; return; }
    showing = true;
    fn(() => nextModal());
  }

  function toast(text, cls = '') {
    const el = document.createElement('div');
    el.className = `toast ${cls}`;
    el.textContent = text;
    $('#toast-root').appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
  function floatText(anchor, text, cls) {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = `float-text ${cls || ''}`;
    el.textContent = text;
    el.style.left = `${r.left + r.width / 2}px`;
    el.style.top = `${r.top + window.scrollY}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }
  function animate(el, cls) {
    if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  }

  function handleEvents(events, anchor) {
    for (const ev of events) {
      if (ev.type === 'xp') {
        floatText(anchor, `+${ev.amount} XP`, 'xp');
        animate($('#hero-art'), 'attack');
        animate($('#enemy-art'), 'hit');
        Sound.play('complete');
      } else if (ev.type === 'bonus') {
        setTimeout(() => Sound.play('bonus'), 250);
        toast(`🎯 Daily goal bonus: +${ev.amount} XP`, 'gold');
      } else if (ev.type === 'defeat') {
        enqueueModal((done) => {
          const it = ev.item, R = RARITIES[it.rarity];
          const cur = Game.equippedItem(it.slot);
          const better = cur && cur.id !== it.id && it.bonus > cur.bonus;
          Sound.play('victory');
          const m = modal(`
            <div class="modal-burst">🏆</div>
            <h2>Enemy defeated!</h2>
            ${Game.state.motivation.dailyReward ? `<div class="real-reward">🎁 Real-life reward unlocked:<b>${esc(Game.state.motivation.dailyReward)}</b></div>` : ''}
            <p>You beat the <b>${esc(ev.enemy.name)}</b>. It dropped:</p>
            <div class="loot rarity-${it.rarity}">
              <div class="loot-icon">${SLOTS[it.slot].icon}</div>
              <div class="loot-name" style="color:${R.color}">${esc(it.name)}</div>
              <div class="loot-meta">${R.label} ${SLOTS[it.slot].label} · +${it.bonus}% XP</div>
            </div>
            ${ev.autoEquip ? '<p class="muted">Equipped automatically — check out your new look!</p>' : cur && cur.id !== it.id ? `<p class="muted">Currently wearing: ${esc(cur.name)} (+${cur.bonus}%)</p>` : ''}
            <div class="modal-actions">
              ${!ev.autoEquip && cur?.id !== it.id ? `<button class="btn ${better ? 'btn-primary' : 'btn-ghost'}" id="loot-equip">Equip${better ? ' (better!)' : ''}</button>` : ''}
              <button class="btn ${ev.autoEquip || !better ? 'btn-primary' : 'btn-ghost'}" data-close>Awesome</button>
            </div>`, { onClose: () => { renderAll(); done(); } });
          const eqBtn = m.root.querySelector('#loot-equip');
          if (eqBtn) eqBtn.addEventListener('click', () => { Sound.play('loot'); Game.equip(it.id); m.close(); });
        });
      } else if (ev.type === 'streakReward') {
        enqueueModal((done) => {
          Sound.play('levelup');
          modal(`
            <div class="modal-burst levelup">🏆</div>
            <h2 class="pixel">${ev.streak}-DAY STREAK!</h2>
            <p>You beat the enemy ${ev.streak} days in a row. You've earned your big reward:</p>
            <div class="real-reward big"><b>${esc(ev.reward)}</b></div>
            <p class="muted">Go claim it. You earned it.</p>
            <div class="modal-actions"><button class="btn btn-primary" data-close>Claimed! 🎉</button></div>`,
            { onClose: () => { renderAll(); done(); } });
        });
      } else if (ev.type === 'levelup') {
        enqueueModal((done) => {
          const diff = Game.state.hero.difficulty;
          const a = Game.requirements(ev.from, diff), b = Game.requirements(ev.to, diff);
          const rank = RANKS.find(r => r.level > ev.from && r.level <= ev.to);
          const changes = [];
          Sound.play('levelup');
          if (b.workouts > a.workouts) changes.push(`Daily workouts: ${a.workouts} → <b>${b.workouts}</b>`);
          if (b.tasks > a.tasks) changes.push(`Daily tasks: ${a.tasks} → <b>${b.tasks}</b>`);
          changes.push(`Workouts get tougher (push-ups ${Game.workoutAmount(WORKOUTS[0], ev.from, diff)} → <b>${Game.workoutAmount(WORKOUTS[0], ev.to, diff)}</b>)`);
          changes.push(`HP fully restored (max ${Game.maxHP(ev.to)})`);
          modal(`
            <div class="modal-burst levelup">⬆️</div>
            <h2 class="pixel">LEVEL UP!</h2>
            <div class="big-level">${ev.to}</div>
            ${rank ? `<p class="rank-up">🏅 New rank: <b>${rank.title}</b></p>` : ''}
            <ul class="changes">${changes.map(c => `<li>${c}</li>`).join('')}</ul>
            <p class="muted">New requirements start tomorrow.</p>
            <div class="modal-actions"><button class="btn btn-primary" data-close>Let's go!</button></div>`,
            { onClose: () => { renderAll(); done(); } });
        });
      }
    }
  }

  function showReport(report) {
    if (!report) return;
    enqueueModal((done) => {
      if (report.days.some(d => !d.met)) Sound.play('hurt');
      const lines = report.days.map(d => d.met
        ? `<li class="win">🏆 You beat the ${esc(d.enemy)} and recovered ${d.heal} HP</li>`
        : `<li class="loss">💀 ${d.key === 'skipped' ? 'Skipped day — the' : 'The'} ${esc(d.enemy)} hit you for <b>${d.dmg}</b> damage</li>`).join('');
      modal(`
        <div class="modal-burst">🌅</div>
        <h2>A new day begins</h2>
        <ul class="report">${lines}</ul>
        ${report.knockouts ? `<div class="ko-box">
          <b>💀 You were knocked out!</b>
          <ul>
            ${report.xpLost ? `<li>Lost ${report.xpLost} XP</li>` : ''}
            ${report.stolen.map(n => `<li>The enemy stole your <b>${esc(n)}</b></li>`).join('')}
            ${report.penalty ? `<li>⚖️ Forfeit added to today's quests: <b>${esc(report.penalty)}</b></li>` : ''}
          </ul>
          <span>HP restored. Get back up, hero!</span>
        </div>` : ''}
        ${Game.state.motivation.why ? `<p class="why-quote">💭 <span>“${esc(Game.state.motivation.why)}”</span></p>` : ''}
        <p>Fresh quests and a new enemy await.</p>
        <div class="modal-actions"><button class="btn btn-primary" data-close>To battle!</button></div>`,
        { onClose: () => { renderAll(); done(); } });
    });
  }

  /* ---------- onboarding ---------- */
  function onboarding() {
    let chosen = 'beginner';
    const cards = Object.values(DIFFICULTIES).map(D => {
      const r = Game.requirements(1, D.id);
      return `<button type="button" class="diff-card ${D.id === chosen ? 'selected' : ''}" data-pick="${D.id}">
        <span class="diff-icon">${D.icon}</span>
        <b>${D.label}</b>
        <span>${D.blurb}</span>
        <small>Starts at ${r.workouts} workouts + ${r.tasks} tasks a day · push-ups ×${Game.workoutAmount(WORKOUTS[0], 1, D.id)}</small>
      </button>`;
    }).join('');
    const m = modal(`
      <div class="modal-burst">⚔️</div>
      <h2 class="pixel">QuestFit</h2>
      <p>Turn workouts and daily tasks into an adventure. Finish quests to earn XP, level up your hero, defeat enemies and collect gear.</p>
      <form id="start-form">
        <label class="field"><span>Name your hero</span><input name="name" maxlength="20" placeholder="Hero" autofocus></label>
        <div class="field"><span>Choose your difficulty</span><div class="diff-cards">${cards}</div></div>
        <button class="btn btn-primary btn-block" type="submit">Begin adventure</button>
      </form>`, { dismissable: false });
    m.root.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
      chosen = b.dataset.pick;
      m.root.querySelectorAll('[data-pick]').forEach(x => x.classList.toggle('selected', x === b));
    }));
    m.root.querySelector('#start-form').addEventListener('submit', (e) => {
      e.preventDefault();
      Game.start(new FormData(e.target).get('name'), chosen);
      m.close();
      boot();
      reasonsModal(true);
    });
  }

  /* ---------- events ---------- */
  function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.querySelectorAll('.tab-panel').forEach(p => { p.hidden = p.id !== `tab-${tab}`; });
  }

  function renderSoundToggle() {
    const b = $('#sound-toggle');
    b.textContent = Sound.muted ? '🔇' : '🔊';
    b.title = Sound.muted ? 'Sound off — tap to turn on' : 'Sound on — tap to mute';
    b.setAttribute('aria-pressed', String(!Sound.muted));
  }

  function wire() {
    renderSoundToggle();
    $('#sound-toggle').addEventListener('click', () => {
      Sound.setMuted(!Sound.muted);
      renderSoundToggle();
      Sound.play('click');
    });
    document.querySelector('.tabs').addEventListener('click', (e) => {
      const b = e.target.closest('.tab');
      if (b) switchTab(b.dataset.tab);
    });

    $('#battle-card').addEventListener('click', (e) => {
      if (e.target.closest('#reasons-btn')) reasonsModal();
    });
    $('#tab-quests').addEventListener('click', (e) => {
      const c = e.target.closest('[data-complete]');
      if (c) {
        const key = c.dataset.complete;
        const li = c.closest('.quest');
        li.classList.add('completing');
        const anchor = li.querySelector('.xp-chip');
        const rect = anchor.getBoundingClientRect();
        const ghost = { getBoundingClientRect: () => rect };
        const events = Game.complete(key);
        justDone = key;
        setTimeout(() => { renderAll(); justDone = null; handleEvents(events, ghost); }, 280);
        return;
      }
      const u = e.target.closest('[data-undo]');
      if (u) { Sound.play('undo'); Game.undo(u.dataset.undo); renderAll(); toast('↩️ Quest marked as not done'); return; }
      const d = e.target.closest('[data-del]');
      if (d) {
        const t = Game.state.tasks.find(x => x.id === d.dataset.del);
        if (t && confirm(`Delete "${t.title}"?`)) { Game.removeTask(t.id); renderAll(); }
        return;
      }
      if (e.target.closest('#add-toggle')) { addOpen = !addOpen; renderQuests(); if (addOpen) $('#add-form input').focus(); return; }
      if (e.target.closest('#edit-toggle')) { editingTasks = !editingTasks; renderQuests(); }
    });
    $('#tab-quests').addEventListener('submit', (e) => {
      if (e.target.id !== 'add-form') return;
      e.preventDefault();
      const f = new FormData(e.target);
      const t = Game.addTask({ title: f.get('title'), effort: f.get('effort'), kind: f.get('kind'), repeat: f.get('repeat') });
      if (t) { toast(`📜 New quest: ${t.title}`); addOpen = false; renderAll(); }
    });

    $('#tab-gear').addEventListener('click', (e) => {
      const eq = e.target.closest('[data-equip]');
      if (eq) { Sound.play('loot'); Game.equip(eq.dataset.equip); renderAll(); toast('🛡️ Equipped!'); return; }
      const ds = e.target.closest('[data-discard]');
      if (ds && confirm('Discard this item?')) { Game.discard(ds.dataset.discard); renderAll(); }
    });

    $('#tab-journey').addEventListener('click', (e) => {
      const db = e.target.closest('[data-diff]');
      if (db && db.dataset.diff !== Game.state.hero.difficulty) {
        const D = DIFFICULTIES[db.dataset.diff];
        if (confirm(`Switch to ${D.label}? Today's workouts will be regenerated for the new mode. Your level and gear stay.`)) {
          Game.setDifficulty(D.id); renderAll(); toast(`${D.icon} ${D.label} mode`);
        }
        return;
      }
      if (e.target.closest('#reasons-btn2')) { reasonsModal(); return; }
      if (e.target.closest('#reset-btn') && confirm('Start over? This deletes your hero, level and gear.')) {
        Game.reset(); $('#app').hidden = true; onboarding();
      }
    });
    $('#tab-journey').addEventListener('submit', (e) => {
      if (e.target.id !== 'rename-form') return;
      e.preventDefault();
      Game.rename(new FormData(e.target).get('name'));
      renderAll(); toast('Name saved');
    });

    // Midnight rollover while the app is open
    const tick = () => { if (Game.state) { const rep = Game.ensureToday(); if (rep) { renderAll(); showReport(rep); } } };
    setInterval(tick, 60 * 1000);
    // Countdown updates every second; roll the day over right at midnight.
    let lastKey = Game.todayKey();
    setInterval(() => {
      const el = document.getElementById('day-countdown');
      if (el) el.textContent = countdownText();
      const key = Game.todayKey();
      if (key !== lastKey) { lastKey = key; tick(); }
    }, 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  }

  function boot() {
    const report = Game.ensureToday();
    $('#app').hidden = false;
    renderAll();
    switchTab(currentTab);
    showReport(report);
  }

  wire();
  if (Game.load()) boot(); else onboarding();
})();
