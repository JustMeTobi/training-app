/* QuestFit — rendering & interaction */
'use strict';

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Number(n).toLocaleString();
  let currentTab = 'quests';
  let editingTasks = false;
  let addOpen = false;
  let justDone = null;
  let calOffset = 0;            // months back from the current month
  let installPrompt = null;     // beforeinstallprompt event

  /* ================= top-level render ================= */
  function renderAll() {
    const s = Game.state;
    const D = DIFFICULTIES[s.hero.difficulty];
    $('#diff-badge').textContent = `${D.icon} ${D.label}`;
    $('#diff-badge').className = `diff-badge diff-${D.id}`;
    $('#date-label').textContent = new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    $('#gold-label').textContent = `🪙 ${fmt(s.hero.gold)}`;
    renderHero();
    renderBattle();
    renderBoss();
    renderQuests();
    renderGear();
    renderShop();
    renderHeroTab();
    renderJourney();
    const sp = Game.skillPoints().free;
    $('#hero-dot').hidden = !sp;
  }

  /* ================= side column ================= */
  function renderHero() {
    const s = Game.state;
    const info = Game.levelInfo(s.hero.totalXP);
    const rank = Game.rankFor(info.level);
    const hpMax = Game.heroMaxHP();
    const hpPct = Math.max(0, Math.min(1, s.hero.hp / hpMax));
    const canPotion = s.consumables.potion > 0 && s.hero.hp < hpMax;
    $('#hero-card').innerHTML = `
      <div class="hero-art ${hpPct < 0.3 ? 'hurt' : ''}" id="hero-art">${Art.hero(s, info.level)}</div>
      <div class="hero-info">
        <div class="hero-name">${esc(s.hero.name)}</div>
        <div class="hero-rank">${esc(rank.title)}</div>
        <div class="level-badge" title="Your level"><small>LVL</small><b>${info.level}</b></div>
        <div class="bar-label"><span>XP</span><span>${fmt(info.into)} / ${fmt(info.need)}</span></div>
        <div class="bar xp-bar"><div class="fill" style="width:${(info.pct * 100).toFixed(1)}%"></div></div>
        <div class="bar-label"><span>HP</span><span>${Math.max(0, s.hero.hp)} / ${hpMax}</span></div>
        <div class="bar hp-bar ${hpPct < 0.3 ? 'low' : ''}"><div class="fill" style="width:${(hpPct * 100).toFixed(1)}%"></div></div>
        <div class="hero-chips">
          <span class="chip" title="Days in a row you beat the enemy">🔥 ${s.hero.streak} day streak</span>
          ${hpPct < 0.3 ? '<span class="chip chip-danger">🩸 Low HP — win today!</span>' : ''}
          <span class="chip" title="Bonus XP from gear and set bonus">✨ +${Game.gearBonus()}% XP</span>
          ${Game.gearStats().power ? `<span class="chip" title="Extra damage to bosses from gear">⚔️ +${Game.gearStats().power}% dmg</span>` : ''}
          ${[...Game.gearStats().uniques].map(u => `<span class="chip chip-unique" style="--c:${UNIQUES[u].color}" title="${esc(UNIQUES[u].desc)}">${UNIQUES[u].icon} ${UNIQUES[u].name}</span>`).join('')}
          ${s.consumables.shield ? `<span class="chip" title="Streak shields: saves your streak once each">🛡️ ×${s.consumables.shield}</span>` : ''}
          ${s.consumables.potion ? `<button class="chip chip-btn" id="potion-btn" ${canPotion ? '' : 'disabled'} title="${canPotion ? 'Drink a potion: restores 40% HP' : 'HP is full'}">🧪 ×${s.consumables.potion}${canPotion ? ' Drink' : ''}</button>` : ''}
        </div>
      </div>`;
  }

  /* ---------- jump to the battle when a quest is done ---------- */
  /* If the arena is off-screen, scroll it into view, play the attack, then return to where you were. */
  function withArenaInView(run) {
    const arena = document.getElementById('arena');
    const enabled = Game.state.settings.jumpToBattle !== false && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!arena || !enabled) { run(); return; }
    const header = document.querySelector('.topbar').offsetHeight;
    const r = arena.getBoundingClientRect();
    const visible = r.top >= header - 10 && r.bottom <= window.innerHeight + 10;
    if (visible) { run(); return; }
    const back = window.scrollY;
    const target = Math.max(0, window.scrollY + r.top - header - 12);
    window.scrollTo({ top: target, behavior: 'smooth' });
    setTimeout(() => {
      run();
      Arena.whenIdle().then(() => setTimeout(() => {
        // Only scroll back if you haven't scrolled somewhere else yourself, and no popup is open.
        if (Math.abs(window.scrollY - target) < 80 && !$('#modal-root').children.length) window.scrollTo({ top: back, behavior: 'smooth' });
      }, 900));
    }, 420);
  }

  /* ---------- enemy voice ---------- */
  let lastTauntAt = 0, lastActivity = Date.now();
  function tauntCtx() {
    const s = Game.state, m = s.motivation, d = s.day, p = Game.progress();
    const weakest = Object.entries(s.attrs).sort((a, b) => a[1] - b[1])[0];
    const pet = s.look.pet ? (LOOKS.pets.find(x => x.id === s.look.pet) || {}).name : '';
    const left = Math.max(0, d.req.workouts - p.workouts) + Math.max(0, d.req.tasks - p.tasks);
    return {
      tier: d.enemy.tier, mode: s.settings.taunts || 'normal', name: s.hero.name,
      forfeit: m.penalty || null, reward: m.dailyReward || null, why: m.why || null,
      streak: s.hero.streak >= 2 ? s.hero.streak : null,
      stat: weakest && weakest[1] < 20 ? ATTRS[weakest[0]].label : null, statLv: weakest ? Math.floor(weakest[1] / 10) + 1 : 1,
      left: left || null, pet: pet ? pet.toLowerCase() : null,
    };
  }
  function speak(situation) {
    const line = Taunts.line(situation, tauntCtx());
    lastTauntAt = Date.now();
    if (line) Arena.say(line); else Arena.hideBubble();
  }
  function greet() {
    const d = Game.state.day, p = Game.progress(), st = Game.stakes();
    speak(d.rest ? 'sleeping' : p.met ? 'beaten' : st.knockout ? 'cocky' : p.pct >= 0.66 ? 'nervous' : Taunts.greetSituation(new Date().getHours()));
  }
  function tauntText() { return Taunts.line('idle', { ...tauntCtx(), mode: 'normal' }) || 'Your quests are waiting!'; }

  function comboText() {
    if (!Game.comboActive()) return '';
    const d = Game.state.day, ms = Game.comboLeftMs();
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    return `⚡ Combo ×${d.combo} · next quest +${Math.round((Game.comboMult(d.combo + 1) - 1) * 100)}% XP · ${m}:${String(s).padStart(2, '0')} left`;
  }

  let lastEnemyPct = null;
  function renderBattle() {
    const s = Game.state, d = s.day, p = Game.progress();
    const card = $('#battle-card');
    if (!card.querySelector('#arena-slot')) {
      card.innerHTML = '<div id="battle-top"></div><div id="arena-slot"></div><div id="battle-info"></div>';
      card.querySelector('#arena-slot').appendChild(Arena.mount());
    }
    Arena.update(s);
    const hp = Math.round(d.enemy.maxHp * (1 - p.pct));
    const defeated = p.met;
    const pct = (1 - p.pct) * 100;
    const startPct = lastEnemyPct == null ? pct : lastEnemyPct;
    lastEnemyPct = pct;
    const meter = (label, icon, got, need) => {
      if (!need) return '';
      const ok = got >= need;
      const pips = Array.from({ length: need }, (_, i) => `<i class="pip ${i < got ? 'on' : ''}"></i>`).join('');
      return `<div class="goal ${ok ? 'ok' : ''}"><span class="goal-label">${icon} ${label}</span><span class="pips">${pips}</span><span class="goal-num">${Math.min(got, need)}/${need}${ok ? ' ✓' : ''}</span></div>`;
    };
    const head = d.rest
      ? '<span class="rest-tag">😴 REST DAY</span>'
      : defeated ? '<span class="defeated-tag">DEFEATED</span>' : `<span class="enemy-atk" title="Damage you take tonight if the goal isn't met">⚔️ hits for ${d.enemy.attack}</span>`;
    card.querySelector('#battle-top').innerHTML = `
      <div class="battle-head"><span class="eyebrow">Today's enemy</span>${head}</div>
      ${s.motivation.why ? `<div class="why-quote">💭 <span>“${esc(s.motivation.why)}”</span></div>` : ''}`;
    card.querySelector('#battle-info').innerHTML = `
      <div class="enemy-info arena-info">
        <div class="enemy-name">${esc(d.enemy.name)}</div>
        <div class="bar-label"><span>Enemy HP</span><span>${hp} / ${d.enemy.maxHp}</span></div>
        <div class="bar enemy-bar"><div class="fill" id="enemy-fill" style="width:${startPct.toFixed(1)}%"></div></div>
        <div class="goals">
          ${meter('Workouts', '🏋️', p.workouts, d.req.workouts)}
          ${meter('Tasks', '📜', p.tasks, d.req.tasks)}
        </div>
      </div>
      <div class="combo-meter" id="combo-meter" ${comboText() ? '' : 'hidden'}>${comboText()}</div>
      <div class="countdown ${defeated || d.rest ? 'safe' : ''}" title="When today's quests reset">
        <span>${defeated || d.rest ? '🌙 New day in' : '⏳ Enemy strikes in'}</span>
        <b id="day-countdown">${countdownText()}</b>
      </div>
      ${stakesWrap(d.rest ? restBox(p) : stakesBox(), d, p)}
      <button class="btn ${Game.hasMotivation() ? 'btn-ghost' : 'btn-primary'} btn-block-sm" id="reasons-btn">${Game.hasMotivation() ? '✏️ My reasons & rewards' : '🎯 Set your reason, rewards & forfeit'}</button>`;
    if (startPct !== pct) {
      // Drain the bar smoothly once the attack lands.
      const delay = Arena.isBusy() ? 450 : 30;
      setTimeout(() => { const f = document.getElementById('enemy-fill'); if (f) f.style.width = pct.toFixed(1) + '%'; }, delay);
    }
  }

  let stakesOpen = window.innerWidth >= 900;
  function stakesWrap(inner, d, p) {
    const st = Game.stakes();
    let summary;
    if (d.rest) summary = p.met ? '😴 Rest day done · streak continues' : '😴 Rest day · 1 light activity keeps your streak';
    else if (p.met) summary = '🏆 Goal complete · rewards earned';
    else summary = `<span class="sum-win">Win: 🎒 gear · 🪙 · 🔥→${Game.state.hero.streak + 1}</span><span class="sum-lose ${st.knockout ? 'ko' : ''}">Lose: ${st.knockout ? '💀 KNOCKOUT' : `💔 −${st.dmg} HP`}</span>`;
    return `<details class="stakes-wrap" id="stakes-wrap" ${stakesOpen ? 'open' : ''}><summary>${summary}</summary>${inner}</details>`;
  }
  function restBox(p) {
    return `<div class="stakes win-box rest-box">
      <div class="stakes-title">😴 Rest day</div>
      <ul>
        <li>The enemy is asleep: no damage tonight.</li>
        <li>${p.met ? '✅ Light activity done. Your streak continues!' : 'Do <b>one light activity</b> below to keep your streak going.'}</li>
        <li>💚 Resting heals extra HP tomorrow.</li>
      </ul></div>`;
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
          <li>➕ Extra quests still give XP, gold and boss damage</li>
        </ul></div>`;
    }
    return `<div class="stakes">
      <div class="stakes-col win">
        <div class="stakes-title">If you win today</div>
        <ul>
          ${m.dailyReward ? `<li>🎁 <b>${esc(m.dailyReward)}</b></li>` : ''}
          <li>🎒 New gear + 🪙 gold</li>
          <li>🔥 Streak → ${s.hero.streak + 1}</li>
          ${streakLine()}
        </ul>
      </div>
      <div class="stakes-col lose ${st.knockout ? 'danger' : ''}">
        <div class="stakes-title">If you lose tonight</div>
        <ul>
          <li>💔 −${st.dmg} HP <small>(${Math.max(0, s.hero.hp)} → ${Math.max(0, st.hpAfter)})</small></li>
          ${s.hero.streak ? (st.shield ? `<li>🛡️ A streak shield will save your ${s.hero.streak}-day streak</li>` : `<li>🔥 Lose your ${s.hero.streak}-day streak</li>`) : ''}
          ${st.phoenix && st.hpAfter <= 0 ? '<li>🔥 Phoenix will save you from the knockout (1 HP left)</li>' : ''}
          ${Game.gearStats().armor ? `<li>🛡️ Armor blocks ${Game.gearStats().armor}% of the damage</li>` : ''}
          ${st.knockout ? `<li class="ko">💀 <b>KNOCKOUT!</b> ${st.xpLoss ? `−${st.xpLoss} XP and ` : ''}the enemy steals a piece of your gear</li>
            ${m.penalty ? `<li class="ko">⚖️ You owe: <b>${esc(m.penalty)}</b></li>` : ''}` : ''}
        </ul>
      </div>
      ${st.knockout ? '' : `<p class="ko-rule">At 0 HP you get knocked out: you lose XP and a piece of gear${m.penalty ? `, and you owe your forfeit (<b>${esc(m.penalty)}</b>)` : ''}. Potions in the shop restore HP.</p>`}
    </div>`;
  }

  function renderBoss() {
    const b = Game.state.boss;
    if (!b) { $('#boss-card').hidden = true; return; }
    $('#boss-card').hidden = false;
    const left = Game.daysLeftInWeek();
    const pct = b.hp / b.maxHp;
    $('#boss-card').innerHTML = `
      <div class="battle-head"><span class="eyebrow">👑 Weekly boss</span>
        ${b.defeated ? '<span class="defeated-tag">DEFEATED</span>' : `<span class="boss-time">${left === 1 ? 'Last day!' : `${left} days left`}</span>`}</div>
      <div class="battle-row boss-row">
        <div class="enemy-art boss-art ${b.defeated ? 'is-defeated' : ''}" id="boss-art">${Art.enemy(b.tier, { boss: true })}</div>
        <div class="enemy-info">
          <div class="enemy-name">${esc(b.name)}</div>
          <div class="bar-label"><span>Boss HP</span><span>${fmt(b.hp)} / ${fmt(b.maxHp)}</span></div>
          <div class="bar boss-bar"><div class="fill" style="width:${(pct * 100).toFixed(1)}%"></div></div>
          <p class="muted tiny">${b.defeated ? 'Beaten! A new boss arrives on Monday.' : `Each quest deals ${Math.round(100 * (1 + Game.gearStats().power / 100))} damage (crits more). Power gear hits harder. Beat it by Sunday midnight for Epic+ gear and gold.`}</p>
        </div>
      </div>`;
  }

  function countdownText() {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const secs = Math.max(0, Math.floor((midnight - now) / 1000));
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  }

  /* ================= quests tab ================= */
  const noteOf = (key) => (Game.state.day.done[key] || {}).note || '';
  function speedText(until) {
    const ms = until - Date.now();
    if (ms <= 0) return 'no speed bonus';
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    return `⚡ ${m}:${String(s).padStart(2, '0')} for +25% XP`;
  }
  function fmtSecs(t) { return t >= 60 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : `${t}s`; }

  function questRow(q) {
    const kindLabel = q.challenge ? 'Daily challenge' : q.kind === 'workout' ? 'Workout' : 'Task';
    let detail = q.challenge ? `${kindLabel} · +${q.gold} gold` : `${esc(q.detail)} · ${kindLabel}`;
    if (q.habit && q.taskId) {
      const h = Game.habitInfo(q.taskId);
      if (h.streak >= 2) detail += ` · <span class="habit-streak" title="Habit streak">🔥${h.streak}</span>`;
      if (h.level.n > 0) detail += ` <span class="habit-lv" title="${h.level.name} habit (${h.total} times)">${h.level.icon}</span>`;
    }
    if (q.quick) detail = `🎲 Quick ${kindLabel.toLowerCase()} · ${QUICK_TIMES[q.time].label}${q.monster && !q.done ? ` · 👾 ${esc(q.monster.name)}` : ''}${q.done ? '' : ` · <span class="speed" data-speed="${q.speedUntil}">${speedText(q.speedUntil)}</span>`}`;
    if (q.done) {
      return `<li class="quest done ${q.challenge ? 'challenge' : ''} ${q.quick ? 'quick' : ''} ${q.key === justDone ? 'just-done' : ''}" data-key="${q.key}">
        <span class="check" aria-hidden="true">✓</span>
        <div class="q-body"><div class="q-title">${q.icon} ${esc(q.title)}</div><div class="q-detail">${detail}${q.crit ? ' · <b class="crit-tag">💥 CRIT</b>' : ''}</div>${noteOf(q.key) ? `<div class="q-note">📝 ${esc(noteOf(q.key))}</div>` : ''}</div>
        <span class="xp-chip earned">+${q.awarded} XP</span>
        <span class="done-actions"><button class="note-btn" data-note="${q.key}" aria-label="Add a note to ${esc(q.title)}" title="Add a note">📝</button><button class="undo-btn" data-undo="${q.key}" aria-label="Undo ${esc(q.title)}">Undo</button></span>
      </li>`;
    }
    const d = Game.state.day;
    const actions = [];
    if (q.timer) actions.push(`<button class="q-action" data-timer="${q.key}" title="Start a ${fmtSecs(q.timer)} timer" aria-label="Start timer for ${esc(q.title)}">⏱️</button>`);
    if (q.generated && d.swaps > 0) actions.push(`<button class="q-action" data-swap="${q.key}" title="Swap for a different workout (1 per day)" aria-label="Swap ${esc(q.title)}">🔄</button>`);
    if (q.quick) actions.push(`<button class="q-action del" data-unquick="${q.quickId}" title="Remove this Quick Quest" aria-label="Remove ${esc(q.title)}">✖</button>`);
    if (editingTasks && !q.generated && !q.challenge && !q.quick) actions.push(`<button class="q-action" data-edit="${q.taskId}" aria-label="Edit ${esc(q.title)}">✏️</button>`);
    if (editingTasks && !q.generated && !q.challenge && !q.quick) actions.push(`<button class="q-action del" data-del="${q.taskId}" aria-label="Delete ${esc(q.title)}">🗑️</button>`);
    return `<li class="quest ${q.challenge ? 'challenge' : ''} ${q.quick ? 'quick' : ''}" data-key="${q.key}">
      <button class="quest-btn" data-complete="${q.key}" aria-label="Complete ${esc(q.title)}">
        <span class="check" aria-hidden="true"></span>
        <span class="q-body"><span class="q-title">${q.icon} ${esc(q.title)}</span><span class="q-detail">${detail}</span></span>
        <span class="xp-chip">+${q.xp} XP</span>
      </button>${actions.length ? `<div class="q-actions">${actions.join('')}</div>` : ''}
    </li>`;
  }

  function renderQuests() {
    const s = Game.state, d = s.day, p = Game.progress();
    const qs = Game.quests();
    const ch = Game.challengeQuest();
    const quick = Game.quickQuests();
    const quickTodo = quick.filter(q => !q.done);
    const todoW = qs.filter(q => !q.done && q.kind === 'workout');
    const todoT = qs.filter(q => !q.done && q.kind === 'task');
    const done = [...qs, ch, ...quick].filter(q => q.done).sort((a, b) => (d.done[b.key].at - d.done[a.key].at));
    const total = qs.length;
    const doneCount = qs.filter(q => q.done).length;
    $('#tab-count').textContent = `${doneCount}/${total}`;

    const taskShortfall = Math.max(0, d.req.tasks - qs.filter(q => q.kind === 'task').length);
    const group = (title, need, got, items, emptyMsg) => `
      <div class="group">
        <div class="group-head"><h3>${title}</h3>${need ? `<span class="req ${got >= need ? 'ok' : ''}">${got >= need ? '✓ goal met' : `${need - got} more needed`}</span>` : '<span class="req ok">optional today</span>'}</div>
        ${items.length ? `<ul class="quest-list">${items.map(questRow).join('')}</ul>` : `<p class="empty">${emptyMsg}</p>`}
      </div>`;

    $('#tab-quests').innerHTML = `
      <div class="action-row ${d.chest === 'closed' ? 'has-chest' : ''}">
        ${d.chest === 'closed' ? `<button class="chest-banner" id="chest-btn" title="Open your daily chest"><span class="chest-icon">🎁</span><span><b>Daily chest</b><small>Tap to open</small></span></button>` : ''}
        <button class="quick-btn" id="quick-btn">
          <span class="quick-dice">🎲</span>
          <span><b>Quick Quest</b><small>Got a few minutes? ${Game.quickFullLeft()}/${QUICK_FULL_PER_DAY} full rewards left</small></span>
        </button>
      </div>
      ${overloadCard()}
      ${quickTodo.length ? `<div class="group"><div class="group-head"><h3>🎲 Quick Quests</h3><span class="req ok">bonus · not part of the daily goal</span></div><ul class="quest-list">${quickTodo.map(questRow).join('')}</ul></div>` : ''}
      <div class="quests-summary">
        <div class="summary-ring" style="--p:${total ? doneCount / total : 0}"><span>${doneCount}<small>/${total}</small></span></div>
        <div>
          <div class="summary-title">${p.met ? 'Daily goal complete! 🎉' : d.rest ? 'Rest day 😴' : 'Today\'s quests'}</div>
          <div class="summary-sub">${d.rest ? 'Just <b>one light activity</b> keeps your streak alive.' : `Tap a quest when you've done it. Need <b>${d.req.workouts} workouts</b> and <b>${d.req.tasks} tasks</b> to beat the enemy.`} Quick quests in a row build a ⚡ combo.</div>
        </div>
      </div>
      ${!ch.done ? `<div class="group"><div class="group-head"><h3>⭐ Daily challenge</h3><span class="req">bonus · counts as ${ch.kind}</span></div><ul class="quest-list">${questRow(ch)}</ul></div>` : ''}
      ${group(d.rest ? '🧘 Light activity' : '🏋️ Workouts', d.req.workouts, p.workouts, todoW, 'All workouts done — nice work! 💪')}
      ${group('📜 Tasks', d.req.tasks, p.tasks, todoT, 'No tasks left. Add one below!')}
      ${taskShortfall ? `<p class="warn">⚠️ You need ${taskShortfall} more task${taskShortfall > 1 ? 's' : ''} on your list to be able to beat today's enemy.</p>` : ''}
      <div class="quest-tools">
        <button class="btn btn-primary" id="add-toggle">${addOpen ? '✕ Close' : '＋ Add quest'}</button>
        <button class="btn btn-ghost" id="edit-toggle">${editingTasks ? '✓ Done editing' : '✏️ Edit my quests'}</button>
        ${d.swaps > 0 ? '<span class="muted tiny tool-hint">🔄 1 workout swap left today · ⏱️ timer on timed workouts</span>' : ''}
      </div>
      ${addOpen ? addForm() : ''}
      ${done.length ? `<div class="group done-group">
        <div class="group-head"><h3>✅ Completed today</h3><span class="req ok">${done.length} done</span></div>
        <ul class="quest-list">${done.map(questRow).join('')}</ul>
      </div>` : ''}`;
  }

  /* Exercise + amount fields shared by the add form, edit popup and link popup. */
  function exerciseFields(prefix, exId, amount, { required = false } = {}) {
    const ex = exId ? Game.exerciseInfo(exId) : null;
    const opts = Game.allExercises().map(x => `<option value="${x.id}" ${x.id === exId ? 'selected' : ''}>${x.icon} ${esc(x.name)} (${x.unit})</option>`).join('');
    return `<div class="field-row ex-fields" data-prefix="${prefix}">
      <label class="field"><span>Exercise <small class="muted">(counts in your stats)</small></span>
        <select name="${prefix}exId" class="ex-select">${required ? '' : '<option value="">— Not tracked —</option>'}${opts}<option value="other" ${exId === 'other' ? 'selected' : ''}>➕ Other…</option></select></label>
      <label class="field field-narrow"><span>Amount <small class="muted ex-unit">${ex ? ex.unit : ''}</small></span>
        <input name="${prefix}amount" type="number" inputmode="decimal" min="0" step="any" value="${amount ?? ''}" placeholder="e.g. 30"></label>
    </div>
    <div class="field-row ex-other" data-prefix="${prefix}" ${exId === 'other' ? '' : 'hidden'}>
      <label class="field"><span>Exercise name</span><input name="${prefix}customName" maxlength="40" placeholder="e.g. Pull-ups"></label>
      <label class="field field-narrow"><span>Unit</span><select name="${prefix}customUnit">${CUSTOM_UNITS.map(u => `<option>${u}</option>`).join('')}</select></label>
    </div>`;
  }
  function readExercise(fd, prefix = '') {
    return { exId: fd.get(prefix + 'exId') || null, amount: fd.get(prefix + 'amount'), customName: fd.get(prefix + 'customName'), customUnit: fd.get(prefix + 'customUnit') };
  }
  /* Keep unit label and "Other…" fields in sync with the exercise dropdown. */
  function syncExerciseFields(root) {
    root.querySelectorAll('.ex-fields').forEach(row => {
      const sel = row.querySelector('.ex-select'), other = root.querySelector(`.ex-other[data-prefix="${row.dataset.prefix}"]`);
      const info = sel.value && sel.value !== 'other' ? Game.exerciseInfo(sel.value) : null;
      row.querySelector('.ex-unit').textContent = info ? info.unit : sel.value === 'other' ? '' : '';
      if (other) other.hidden = sel.value !== 'other';
    });
  }
  function applyDetection(form, prefix, title) {
    const d = Game.detectExercise(title);
    const sel = form.querySelector(`[name="${prefix}exId"]`), amt = form.querySelector(`[name="${prefix}amount"]`);
    if (!sel || sel.dataset.touched) return;
    if (d.exId) sel.value = d.exId;
    if (d.customName) { const n = form.querySelector(`[name="${prefix}customName"]`); if (n) n.value = d.customName; const un = form.querySelector(`[name="${prefix}customUnit"]`); if (un) un.value = d.customUnit; }
    if (d.amount != null && !amt.dataset.touched) amt.value = d.amount;
    syncExerciseFields(form);
  }

  function overloadCard() {
    const o = Game.overloadSuggestion();
    if (!o) return '';
    return `<div class="overload-card">
      <span class="ol-icon">💪</span>
      <div><b>Ready for more?</b><small>You've done <b>${esc(o.title)}</b> ${o.count} times at ${o.from} ${o.unit}. Your body has adapted. Try <b>${o.to} ${o.unit}</b>?</small>
        <div class="btn-row"><button class="btn btn-primary btn-small" data-overload="${o.id}" data-to="${o.to}">⬆️ Raise to ${o.to}</button><button class="btn btn-ghost btn-small" data-ol-snooze="${o.id}">Not yet</button></div></div>
    </div>`;
  }
  function repeatFields(repeat = 'daily', days = [], { allowOnce = true } = {}) {
    const order = [1, 2, 3, 4, 5, 6, 0];
    return `<label class="field"><span>Repeat</span>
        <select name="repeat" class="repeat-select"><option value="daily" ${repeat === 'daily' ? 'selected' : ''}>Every day</option><option value="days" ${repeat === 'days' ? 'selected' : ''}>Certain days…</option>${allowOnce ? `<option value="once" ${repeat === 'once' ? 'selected' : ''}>Today only</option>` : ''}</select></label>
      <div class="day-picker" ${repeat === 'days' ? '' : 'hidden'}>${order.map(i => `<label class="day-chip"><input type="checkbox" name="days" value="${i}" ${days.includes(i) ? 'checked' : ''}><span>${DAY_NAMES[i]}</span></label>`).join('')}</div>`;
  }
  function syncRepeat(form) { const sel = form.querySelector('.repeat-select'), dp = form.querySelector('.day-picker'); if (sel && dp) dp.hidden = sel.value !== 'days'; }

  function addForm() {
    return `<form class="add-form card" id="add-form" autocomplete="off">
      <label class="field"><span>What do you want to do?</span>
        <input name="title" maxlength="80" placeholder="e.g. 30 push-ups or Meditate 10 minutes" required></label>
      <div class="field-row">
        <label class="field"><span>Type</span>
          <select name="kind"><option value="task">📜 Task</option><option value="workout">🏋️ Workout</option></select></label>
        <label class="field"><span>Effort</span>
          <select name="effort">${Object.entries(EFFORTS).map(([k, e]) => `<option value="${k}" ${k === 'medium' ? 'selected' : ''}>${e.label} (${e.xp} base XP)</option>`).join('')}</select></label>
      </div>
      ${repeatFields('daily', [new Date().getDay()])}
      <div id="add-ex" hidden>${exerciseFields('', null, null)}<p class="muted tiny ex-hint">💡 Pick the exercise and amount so your reps count in your stats. Typing "40 push-ups" fills this in for you.</p></div>
      <button class="btn btn-primary" type="submit">Add quest</button>
    </form>`;
  }

  /* ================= gear tab ================= */
  function effectsList(it) {
    const lines = (it.effects || []).map(e => `<li style="--c:${EFFECTS[e.id].color}">${EFFECTS[e.id].icon} ${EFFECTS[e.id].desc(e.value)}</li>`);
    if (it.unique) { const U = UNIQUES[it.unique]; lines.push(`<li class="unique" style="--c:${U.color}">${U.icon} <b>${U.name}:</b> ${U.desc}</li>`); }
    return lines.length ? `<ul class="fx-list">${lines.join('')}</ul>` : '';
  }
  function itemCard(it, equipped) {
    const R = RARITIES[it.rarity];
    const canReforge = it.rarity !== 'common';
    return `<div class="item rarity-${it.rarity} ${equipped ? 'equipped' : ''}">
      <div class="item-art">${Art.item(it)}</div>
      <div class="item-body">
        <div class="item-name" style="color:${R.color}">${esc(it.name)}</div>
        <div class="item-meta">${R.label} ${SLOTS[it.slot].label} · <b>+${it.bonus}% XP</b></div>
        ${effectsList(it)}
      </div>
      <div class="item-actions">
        ${equipped ? `<span class="equipped-tag">Equipped</span>` : `<button class="btn btn-small btn-primary" data-equip="${it.id}">Equip</button>
        <button class="btn btn-small btn-ghost" data-sell="${it.id}" title="Sell for ${Game.sellPrice(it)} gold">🪙${Game.sellPrice(it)}</button>`}
        ${canReforge ? `<button class="btn btn-small btn-ghost" data-reforge="${it.id}" title="Re-roll this item's effects for ${Game.reforgePrice(it)} gold">🔨 ${Game.reforgePrice(it)}</button>` : ''}
      </div>
    </div>`;
  }

  function gearPowersHTML() {
    const gs = Game.gearStats();
    const rows = Object.entries(EFFECTS).filter(([k]) => gs[k] > 0).map(([k, E]) => `<div class="power" style="--c:${E.color}"><span>${E.icon}</span><b>${E.label}</b><small>${E.desc(gs[k])}</small></div>`);
    const uniq = [...gs.uniques].map(u => { const U = UNIQUES[u]; return `<div class="power unique" style="--c:${U.color}"><span>${U.icon}</span><b>${U.name}</b><small>${U.desc}</small></div>`; });
    return rows.length || uniq.length ? `<div class="powers">${uniq.join('')}${rows.join('')}</div>`
      : '<p class="muted">No special effects yet. <b>Rare</b> gear has 1 effect, <b>Epic</b> has 2, and <b>Legendary</b> has 2 plus a unique power.</p>';
  }

  function lockText(req) {
    if (!req) return '';
    if (req.level) return `Reach level ${req.level}`;
    const a = ACHIEVEMENTS.find(x => x.id === req.ach);
    return a ? `Earn “${a.name}”` : 'Locked';
  }

  function petArt(id, lv) { return `<svg viewBox="-19 48 24 30" class="pet-svg" shape-rendering="crispEdges" aria-hidden="true">${Art.pet(id, lv)}</svg>`; }
  function petsHTML() {
    const s = Game.state;
    return Object.entries(PETS).map(([id, P]) => {
      const p = s.pets[id];
      if (p && p.status === 'hatched') {
        const active = s.look.pet === id, max = p.level >= PET_MAX_LEVEL;
        return `<div class="pet-card ${active ? 'active' : ''}">
          <div class="pet-art">${petArt(id, p.level)}</div>
          <div class="pet-body"><b>${P.icon} ${P.name} <span class="pet-lv">Lv ${p.level}</span></b>
            <div class="bar pet-bar"><div class="fill" style="width:${max ? 100 : Math.round(p.xp / petXpNeed(p.level) * 100)}%"></div></div>
            <small>${max ? 'Max level!' : `${p.xp}/${petXpNeed(p.level)} quests to Lv ${p.level + 1}`} · <b>${P.bonusText(p.level)}</b></small></div>
          ${active ? '<button class="btn btn-small btn-ghost" data-pet="">With you ✓</button>' : `<button class="btn btn-small btn-primary" data-pet="${id}">Bring along</button>`}
        </div>`;
      }
      if (p && p.status === 'egg') {
        return `<div class="pet-card egg"><div class="pet-art egg-art">🥚</div>
          <div class="pet-body"><b>${P.name} egg</b><div class="bar pet-bar"><div class="fill egg-fill" style="width:${Math.round(p.progress / PET_HATCH * 100)}%"></div></div>
          <small>Hatches after ${PET_HATCH - p.progress} more quest${PET_HATCH - p.progress === 1 ? '' : 's'}</small></div></div>`;
      }
      return `<div class="pet-card locked"><div class="pet-art egg-art">🔒</div><div class="pet-body"><b>??? egg</b><small>Earn it: ${esc(P.egg)}</small><small class="muted">Bonus when raised: ${P.bonusText(1).replace(/\d+(\.\d+)?/, '…')}</small></div></div>`;
    }).join('');
  }

  function renderGear() {
    const s = Game.state, L = s.look;
    const set = Game.setInfo();
    const slots = Object.keys(SLOTS).map(slot => {
      const it = Game.equippedItem(slot);
      return `<div class="slot ${it ? 'rarity-' + it.rarity : 'empty'}">
        <div class="slot-icon">${it ? `<div class="slot-art">${Art.item(it)}</div>` : SLOTS[slot].icon}</div>
        <div class="slot-label">${SLOTS[slot].label}</div>
        <div class="slot-item">${it ? esc(it.name) : 'Empty'}</div>
        ${it ? `<div class="slot-bonus">+${it.bonus}%</div>` : ''}
      </div>`;
    }).join('');
    const inv = s.inventory.slice().sort((a, b) => RARITY_ORDER.indexOf(b.rarity) - RARITY_ORDER.indexOf(a.rarity) || b.bonus - a.bonus);
    const swatch = (attr, list, cur) => list.map((c, i) => `<button class="swatch ${i === cur ? 'on' : ''}" style="background:${c}" data-look="${attr}" data-val="${i}" aria-label="${attr} ${i + 1}"></button>`).join('');
    const unlockList = (attr, list, cur) => [`<button class="look-opt ${!cur ? 'on' : ''}" data-look="${attr}" data-val="">None</button>`]
      .concat(list.map(o => {
        const ok = Game.lookUnlocked(o.req);
        return `<button class="look-opt ${cur === o.id ? 'on' : ''} ${ok ? '' : 'locked'}" ${ok ? `data-look="${attr}" data-val="${o.id}"` : 'disabled'} title="${ok ? o.name : lockText(o.req)}">
          ${o.color ? `<i class="cape-dot" style="background:${o.color}"></i>` : ''}${ok ? esc(o.name) : `🔒 ${esc(o.name)}`}${ok ? '' : `<small>${esc(lockText(o.req))}</small>`}</button>`;
      })).join('');

    $('#tab-gear').innerHTML = `
      <div class="card">
        <div class="section-head"><h2>Equipped</h2><span class="chip">✨ +${Game.gearBonus()}% XP total</span></div>
        <div class="slots">${slots}</div>
        <div class="set-info ${set.bonus ? 'active' : ''}">
          <b>🧩 Gear sets:</b> wear matching materials for a bonus: 3 pieces = <b>+4%</b>, all 5 = <b>+12%</b> XP.
          ${set.count >= 2 ? `<br>You're wearing <b>${set.count} ${esc(set.material)}</b> piece${set.count > 1 ? 's' : ''}${set.bonus ? ` → <b class="ok">+${set.bonus}% set bonus!</b>` : ` (${3 - set.count} more for a bonus)`}` : ''}
        </div>
      </div>
      <div class="card">
        <div class="section-head"><h2>⚡ Gear powers</h2><span class="muted tiny">From everything you're wearing</span></div>
        ${gearPowersHTML()}
      </div>
      <div class="card" id="pets-card">
        <div class="section-head"><h2>🐾 Pets</h2><span class="muted tiny">Earn eggs, hatch them with quests, raise your pet to level ${PET_MAX_LEVEL}</span></div>
        <div class="pets">${petsHTML()}</div>
      </div>
      <div class="card">
        <div class="section-head"><h2>Appearance</h2><span class="muted tiny">Unlock capes and pets by leveling and earning badges</span></div>
        <div class="look-grid">
          <div class="look-preview">${Art.hero(s, Game.levelInfo(s.hero.totalXP).level)}</div>
          <div class="look-controls">
            <div class="look-row"><span>Hair</span><div class="opts">${LOOKS.hairStyles.map((h, i) => `<button class="look-opt ${i === L.hair ? 'on' : ''}" data-look="hair" data-val="${i}">${h}</button>`).join('')}</div></div>
            <div class="look-row"><span>Hair color</span><div class="opts">${swatch('hairColor', LOOKS.hairColors, L.hairColor)}</div></div>
            <div class="look-row"><span>Skin</span><div class="opts">${swatch('skin', LOOKS.skins, L.skin)}</div></div>
            <div class="look-row"><span>Cape</span><div class="opts">${unlockList('cape', LOOKS.capes, L.cape)}</div></div>

          </div>
        </div>
      </div>
      <div class="card">
        <div class="section-head"><h2>Backpack</h2><span class="muted">${inv.length} item${inv.length === 1 ? '' : 's'} · sell spares · 🔨 reforge to re-roll effects</span></div>
        <div class="items">${inv.map(it => itemCard(it, s.equipped[it.slot] === it.id)).join('') || '<p class="empty">Nothing yet. Beat an enemy to earn loot!</p>'}</div>
      </div>`;
  }

  /* ================= shop tab ================= */
  function renderShop() {
    const s = Game.state;
    const cards = SHOP.map(it => {
      const price = Game.shopPrice(it.id);
      const owned = s.consumables[it.id];
      const maxed = it.max && owned >= it.max;
      const afford = s.hero.gold >= price;
      return `<div class="shop-item">
        <div class="shop-icon">${it.icon}</div>
        <div class="shop-body"><b>${it.name}</b><span>${it.desc}</span>${owned != null ? `<small>You have: ${owned}${it.max ? ` / ${it.max}` : ''}</small>` : ''}</div>
        <button class="btn btn-small ${afford && !maxed ? 'btn-primary' : 'btn-ghost'}" data-buy="${it.id}" ${afford && !maxed ? '' : 'disabled'}>${maxed ? 'Max' : `🪙 ${fmt(price)}`}</button>
      </div>`;
    }).join('');
    $('#tab-shop').innerHTML = `
      <div class="card">
        <div class="section-head"><h2>🏪 Shop</h2><span class="gold-big">🪙 ${fmt(s.hero.gold)}</span></div>
        <p class="muted">Earn gold from every quest (crits give double), defeating enemies, the weekly boss, daily chests and selling spare gear.</p>
        <div class="shop-list">${cards}</div>
      </div>
      <div class="card">
        <h2>🎒 Your supplies</h2>
        <div class="supplies">
          <div class="supply"><span>🧪</span><b>${s.consumables.potion}</b> Health potion${s.consumables.potion === 1 ? '' : 's'}
            <button class="btn btn-small btn-primary" id="potion-btn2" ${s.consumables.potion && s.hero.hp < Game.heroMaxHP() ? '' : 'disabled'}>Drink</button></div>
          <div class="supply"><span>🛡️</span><b>${s.consumables.shield}</b> Streak shield${s.consumables.shield === 1 ? '' : 's'} <small class="muted">used automatically</small></div>
        </div>
      </div>`;
  }

  /* ================= hero tab ================= */
  function renderHeroTab() {
    const s = Game.state;
    const sp = Game.skillPoints();
    const attrs = Object.entries(ATTRS).map(([k, a]) => {
      const pts = s.attrs[k] || 0;
      const lv = Math.floor(pts / 10) + 1;
      return `<div class="attr">
        <div class="attr-head"><span>${a.icon} <b>${a.label}</b></span><span class="attr-lv">Lv ${lv}</span></div>
        <div class="bar attr-bar"><div class="fill" style="width:${(pts % 10) * 10}%;background:${a.color}"></div></div>
        <small>${pts} point${pts === 1 ? '' : 's'} · ${a.blurb}</small>
      </div>`;
    }).join('');
    const skills = Object.entries(SKILLS).map(([k, sk]) => {
      const v = s.skills[k];
      return `<div class="skill">
        <div class="skill-icon">${sk.icon}</div>
        <div class="skill-body"><b>${sk.label}</b><small>${sk.desc}</small>
          <div class="skill-pips">${Array.from({ length: sk.max }, (_, i) => `<i class="pip ${i < v ? 'on' : ''}"></i>`).join('')}</div></div>
        <button class="btn btn-small ${sp.free && v < sk.max ? 'btn-primary' : 'btn-ghost'}" data-skill="${k}" ${sp.free && v < sk.max ? '' : 'disabled'} aria-label="Add point to ${sk.label}">＋</button>
      </div>`;
    }).join('');
    const got = ACHIEVEMENTS.filter(a => s.achievements[a.id]).length;
    const achs = ACHIEVEMENTS.map(a => {
      const on = s.achievements[a.id];
      return `<div class="ach ${on ? 'on' : ''}" title="${esc(a.desc)}${on ? ` · earned ${on}` : ''}"><span class="ach-icon">${on ? a.icon : '🔒'}</span><b>${a.name}</b><small>${a.desc}</small></div>`;
    }).join('');
    const beasts = ENEMIES.map((e, i) => {
      const n = s.bestiary[i] || 0;
      return `<div class="beast ${n ? 'on' : ''}"><div class="beast-art">${Art.enemy(i)}</div><b>${n ? e.name : '???'}</b><small>${n ? `Defeated ×${n}` : 'Not met yet'}</small></div>`;
    }).join('');
    $('#tab-hero').innerHTML = `
      <div class="card">
        <h2>📊 Hero stats</h2>
        <p class="muted">These grow from what you actually do in real life.</p>
        <div class="attrs">${attrs}</div>
      </div>
      <div class="card">
        <div class="section-head"><h2>🌳 Skills</h2><span class="chip ${sp.free ? 'chip-gold' : ''}">${sp.free} point${sp.free === 1 ? '' : 's'} to spend</span></div>
        <p class="muted">You get a skill point every 5 levels (${sp.total} earned so far).${sp.total ? '' : ' Your first one comes at level 5.'}</p>
        <div class="skills">${skills}</div>
        ${sp.spent ? '<button class="btn btn-ghost btn-small mt" id="reset-skills">↩️ Reset skill points</button>' : ''}
      </div>
      <div class="card">
        <div class="section-head"><h2>🏅 Achievements</h2><span class="chip">${got} / ${ACHIEVEMENTS.length}</span></div>
        <div class="ach-grid">${achs}</div>
      </div>
      <div class="card">
        <div class="section-head"><h2>📖 Bestiary</h2><span class="chip">${Object.keys(s.bestiary).length} / ${ENEMIES.length} types</span></div>
        <div class="beast-grid">${beasts}</div>
      </div>`;
  }

  /* ================= journey tab ================= */
  function calendarHTML() {
    const s = Game.state;
    const byKey = Object.fromEntries(s.history.map(h => [h.key, h]));
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() - calOffset, 1);
    const daysIn = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;
    const today = Game.todayKey();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="cal-cell empty"></span>';
    let wins = 0, losses = 0;
    for (let dnum = 1; dnum <= daysIn; dnum++) {
      const k = Game.todayKey(new Date(first.getFullYear(), first.getMonth(), dnum));
      const h = byKey[k];
      let cls = '', icon = '';
      if (h) { cls = h.rest && h.met ? 'rest' : h.met ? 'win' : 'loss'; icon = h.rest && h.met ? '😴' : h.met ? '🏆' : '💀'; h.met ? wins++ : losses++; }
      if (k === today) { cls += ' today'; if (Game.progress().met) icon = '🏆'; }
      const notes = h && (h.items || []).some(x => x.n);
      cells += `<button type="button" class="cal-cell ${cls}" data-day="${k}" ${h || k === today ? '' : 'disabled'} title="${k}${h ? ` · ${h.met ? 'won' : 'lost'} vs ${esc(h.enemy)}` : ''}"><i>${dnum}</i>${icon}${notes ? '<em class="cal-note">📝</em>' : ''}</button>`;
    }
    return `<div class="cal-head">
        <button class="btn btn-small btn-ghost" data-cal="1" aria-label="Previous month">‹</button>
        <b>${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b>
        <button class="btn btn-small btn-ghost" data-cal="-1" ${calOffset === 0 ? 'disabled' : ''} aria-label="Next month">›</button>
      </div>
      <div class="cal-grid">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => `<span class="cal-dow">${d}</span>`).join('')}${cells}</div>
      <p class="muted tiny">This month: ${wins} win${wins === 1 ? '' : 's'} · ${losses} loss${losses === 1 ? '' : 'es'}</p>`;
  }

  function habitsHTML() {
    const list = Game.state.tasks.filter(t => t.repeat !== 'once' && !t.forfeit);
    if (!list.length) return '<p class="muted">Add your own quests to track them as habits.</p>';
    return `<div class="habits">${list.map(t => {
      const h = Game.habitInfo(t.id);
      const sched = t.repeat === 'days' ? (t.days || []).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(i => DAY_NAMES[i]).join(' · ') : 'Every day';
      return `<div class="habit">
        <div class="habit-top"><b>${t.kind === 'workout' ? '🏋️' : '📜'} ${esc(t.title)}</b><span class="habit-badge" title="${h.level.name} habit">${h.level.icon} ${h.level.name}</span></div>
        <div class="habit-stats"><span>🔥 <b>${h.streak}</b> streak</span><span>🏆 best ${h.best}</span><span>✅ ${h.total} times</span>${h.rate != null ? `<span>📊 <b>${h.rate}%</b> (30 days)</span>` : ''}</div>
        ${h.rate != null ? `<div class="bar habit-bar"><div class="fill" style="width:${h.rate}%;background:${h.rate >= 80 ? 'var(--green)' : h.rate >= 50 ? 'var(--gold)' : 'var(--red)'}"></div></div>` : ''}
        <small class="muted">${sched}${h.next ? ` · ${h.toNext} more to ${h.next.icon} ${h.next.name}` : ' · max level!'}</small>
      </div>`;
    }).join('')}</div>`;
  }

  function weeklyChart() {
    const s = Game.state;
    const weeks = [];
    const thisWeek = Game.weekKey();
    for (let i = 7; i >= 0; i--) {
      const d = Game.keyToDate(thisWeek); d.setDate(d.getDate() - i * 7);
      weeks.push({ key: Game.todayKey(d), label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), n: 0 });
    }
    for (const h of s.history) {
      const w = weeks.find(x => x.key === Game.weekKey(h.key));
      if (w) w.n += h.workouts ?? 0;
    }
    weeks[weeks.length - 1].n += Game.progress().workouts;
    const max = Math.max(4, ...weeks.map(w => w.n));
    const W = 320, H = 140, bw = 28, gap = (W - 20 - bw * 8) / 7;
    const bars = weeks.map((w, i) => {
      const h = Math.round((w.n / max) * (H - 40));
      const x = 10 + i * (bw + gap), y = H - 22 - h;
      return `<g><title>Week of ${w.label}: ${w.n} workouts</title>
        <rect x="${x}" y="${y}" width="${bw}" height="${Math.max(h, 2)}" rx="4" fill="${i === 7 ? 'var(--gold)' : 'var(--blue)'}"/>
        ${w.n ? `<text x="${x + bw / 2}" y="${y - 4}" text-anchor="middle" class="chart-num">${w.n}</text>` : ''}
        <text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle" class="chart-lbl">${w.label.replace(/\s.*/, '')}</text></g>`;
    }).join('');
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Workouts per week, last 8 weeks">
      <line x1="6" x2="${W - 6}" y1="${H - 22}" y2="${H - 22}" stroke="var(--line)"/>${bars}</svg>`;
  }

  function renderJourney() {
    const s = Game.state, diff = s.hero.difficulty;
    const info = Game.levelInfo(s.hero.totalXP);
    const from = Math.max(1, info.level - 2), to = info.level + 10;
    let prev = null, rows = '';
    for (let L = from; L <= to; L++) {
      const req = Game.requirements(L, diff);
      const rank = RANKS.find(r => r.level === L);
      const harder = prev && (req.workouts > prev.workouts || req.tasks > prev.tasks);
      const st = L < info.level ? 'past' : L === info.level ? 'current' : 'future';
      rows += `<li class="lvl ${st}">
        <span class="lvl-num">${L}</span>
        <span class="lvl-body">
          <b>${st === 'current' ? 'You are here' : st === 'past' ? 'Cleared' : `${fmt(Game.xpToNext(L - 1))} XP to reach`}</b>
          ${rank ? `<span class="rank-tag">🏅 ${rank.title}</span>` : ''}
          ${L % 5 === 0 ? '<span class="rank-tag">🌳 skill point</span>' : ''}
          ${harder ? '<span class="harder-tag">⬆ harder</span>' : ''}
          <small>Daily: ${req.workouts} workouts · ${req.tasks} tasks · push-ups ×${Game.workoutAmount(WORKOUTS[0], L, diff)}</small>
        </span>
      </li>`;
      prev = req;
    }
    const nr = Game.nextRank(info.level);
    const reps = Object.entries(s.stats.reps).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([id, n]) => {
      const w = Game.exerciseInfo(id);
      return w ? `<li><span>${w.icon} ${esc(w.name)}</span><b>${fmt(n)} ${w.unit.replace(' / leg', '')}</b></li>` : '';
    }).join('');
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const st = s.settings;
    const notifState = !('Notification' in window) ? 'unsupported' : Notification.permission;

    $('#tab-journey').innerHTML = `
      <div class="card">
        <div class="section-head"><h2>📈 My habits</h2><button class="btn btn-ghost btn-small" id="review-btn">📊 Last week's review</button></div>
        ${habitsHTML()}
      </div>
      <div class="card">
        <h2>📅 Calendar</h2><p class="muted tiny">Tap a day to see what you did and your notes.</p>
        ${calendarHTML()}
      </div>
      <div class="card">
        <h2>📈 Progress</h2>
        <h3 class="sub">Workouts per week</h3>
        ${weeklyChart()}
        <div class="stats mt">
          <div class="stat"><b>${fmt(s.stats.workouts)}</b><span>Workouts</span></div>
          <div class="stat"><b>${fmt(s.stats.tasks)}</b><span>Tasks</span></div>
          <div class="stat"><b>${fmt(s.stats.enemies)}</b><span>Enemies beaten</span></div>
          <div class="stat"><b>${fmt(s.stats.bosses)}</b><span>Bosses beaten</span></div>
          <div class="stat"><b>${s.hero.bestStreak}</b><span>Best streak</span></div>
          <div class="stat"><b>${fmt(s.stats.crits)}</b><span>Critical hits</span></div>
          <div class="stat"><b>×${s.stats.maxCombo}</b><span>Best combo</span></div>
          <div class="stat"><b>${fmt(s.stats.goldEarned)}</b><span>Gold earned</span></div>
        </div>
        <h3 class="sub mt">Lifetime totals</h3>
        ${reps ? `<ul class="reps">${reps}</ul>` : '<p class="muted">Complete workouts to see your lifetime totals, like “You\'ve done 2,340 push-ups!”</p>'}
        <button class="btn btn-ghost btn-small mt" id="add-reps">➕ Add missing reps</button>
      </div>
      <div class="card">
        <div class="section-head"><h2>🗺️ Level road</h2>${nr ? `<span class="chip">Next rank: ${nr.title} at Lv ${nr.level}</span>` : ''}</div>
        <p class="muted">The higher your level, the more quests you need each day and the bigger your workouts get. Enemies get tougher too.</p>
        <ol class="level-road">${rows}</ol>
      </div>
      <div class="card" id="settings-card">
        <h2>⚙️ Settings</h2>
        <form id="rename-form" class="inline-form">
          <label class="field"><span>Hero name</span><input name="name" maxlength="20" value="${esc(s.hero.name)}"></label>
          <button class="btn btn-ghost" type="submit">Save</button>
        </form>
        <div class="field"><span>Difficulty</span>
          <div class="diff-switch">${Object.values(DIFFICULTIES).map(D => `<button class="btn ${D.id === diff ? 'btn-primary' : 'btn-ghost'}" data-diff="${D.id}">${D.icon} ${D.label}</button>`).join('')}</div>
        </div>
        <label class="field"><span>😴 Weekly rest day <small class="muted">(applies from the next day)</small></span>
          <select id="rest-day"><option value="">No rest day</option>${days.map((d, i) => `<option value="${i}" ${st.restDay === i ? 'selected' : ''}>${d}</option>`).join('')}</select></label>
        <div class="field"><span>🔔 Daily reminder</span>
          <div class="inline-form">
            <label class="switch"><input type="checkbox" id="remind-on" ${st.reminders && notifState === 'granted' ? 'checked' : ''} ${notifState === 'unsupported' ? 'disabled' : ''}><span>Remind me if the enemy isn't beaten by</span></label>
            <input type="time" id="remind-time" value="${esc(st.reminderTime)}" class="time-input">
          </div>
          <small class="muted">${notifState === 'unsupported' ? 'This browser does not support notifications.' : notifState === 'denied' ? 'Notifications are blocked for this site. Allow them in your browser settings.' : 'Works while the app is open or running in the background. Install the app for the best results.'}</small>
        </div>
        <div class="field"><span>🔊 Sound</span>
          <div class="sound-settings">
            <label class="vol-row">Volume <input type="range" id="vol" min="0" max="100" step="5" value="${Math.round(Sound.prefs.volume * 100)}"><b id="vol-val">${Math.round(Sound.prefs.volume * 100)}%</b></label>
            <label class="switch"><input type="checkbox" id="snd-sfx" ${Sound.prefs.sfx ? 'checked' : ''}><span>Sound effects</span></label>
            <label class="switch"><input type="checkbox" id="snd-voice" ${Sound.prefs.voice ? 'checked' : ''}><span>Enemy talking blips</span></label>
          </div></div>
        <label class="switch field"><input type="checkbox" id="jump-battle" ${st.jumpToBattle !== false ? 'checked' : ''}><span>🏟️ Scroll up to the battle scene when I finish a quest</span></label>
        <label class="field"><span>💬 Enemy taunts</span>
          <select id="taunt-mode">${[['off', 'Off'], ['normal', 'Normal'], ['savage', '🔥 Savage (harsh and personal)']].map(([v, l]) => `<option value="${v}" ${(st.taunts || 'normal') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <div class="field"><span>Real-life motivation</span><div><button class="btn btn-ghost" id="reasons-btn2">🎯 Edit reason, rewards & forfeit</button></div></div>
      </div>
      <div class="card" id="cloud-card">${cloudCardHTML()}</div>
      <div class="card" id="sync-card">
        <h2>🔄 Backup & sync codes</h2>
        <p class="muted">Your progress is saved in this browser. To move it to another device (or keep a backup), use a sync code or a backup file.</p>
        <div class="sync-grid">
          <div class="sync-box">
            <b>Sync code</b>
            <small>Copy on this device, paste on the other one.</small>
            <div class="btn-row"><button class="btn btn-primary btn-small" id="copy-code">📋 Copy sync code</button><button class="btn btn-ghost btn-small" id="paste-code">📥 Paste code</button></div>
          </div>
          <div class="sync-box">
            <b>Backup file</b>
            <small>Save a file you can load later or email to yourself.</small>
            <div class="btn-row"><button class="btn btn-primary btn-small" id="export-file">💾 Download backup</button><button class="btn btn-ghost btn-small" id="import-file">📂 Load backup</button></div>
            <input type="file" id="import-input" accept=".json,application/json" hidden>
          </div>
        </div>
      </div>
      <div class="card">
        <h2>📲 Install as an app</h2>
        ${installHTML()}
        <button class="btn btn-danger mt" id="reset-btn">Start over</button>
      </div>`;
  }

  /* ---------- cloud sync ---------- */
  const CLOUD_SQL = `create table public.saves (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;
create policy "read own save" on public.saves for select using (auth.uid() = user_id);
create policy "insert own save" on public.saves for insert with check (auth.uid() = user_id);
create policy "update own save" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
revoke all on public.saves from anon;
grant select, insert, update on public.saves to authenticated;`;
  function timeAgo(ms) {
    if (!ms) return 'never';
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return new Date(ms).toLocaleDateString();
  }
  function cloudStatusText(ci) {
    if (ci.status === 'syncing') return '🔄 Syncing…';
    if (ci.status === 'error') return `⚠️ ${esc(ci.error)}`;
    if (ci.status === 'synced') return `✅ Synced ${timeAgo(ci.lastSync)}`;
    return '';
  }
  function cloudCardHTML() {
    const ci = Cloud.info();
    const head = '<div class="section-head"><h2>☁️ Cloud sync</h2>' + (ci.email ? '<span class="chip chip-ok">On</span>' : '') + '</div>';
    if (!ci.configured) {
      return `${head}
        <p class="muted">Keep your phone and computer in sync automatically. It uses a free <b>Supabase</b> database that you create once (about 5 minutes).</p>
        <details class="help-sec cloud-setup"><summary>📋 How to set it up</summary>
          <ol class="setup-steps">
            <li>Go to <b>supabase.com</b>, create a free account and click <b>New project</b>. Pick any name and password and the region closest to you.</li>
            <li>Open <b>SQL Editor</b> → <b>New query</b>, paste this code and click <b>Run</b>:
              <textarea class="code-box" readonly rows="6">${esc(CLOUD_SQL)}</textarea>
              <button type="button" class="btn btn-ghost btn-small" id="copy-sql">📋 Copy code</button></li>
            <li>Optional but easier: <b>Authentication</b> → <b>Sign In / Providers</b> → <b>Email</b>, turn off <b>Confirm email</b>.</li>
            <li>Open <b>Project Settings</b> → <b>API</b> (or "Data API" / "API Keys"). Copy the <b>Project URL</b> and the <b>anon public</b> key and paste them below.</li>
            <li>Do the same on your other device, then log in with the same email and password on both.</li>
          </ol>
        </details>
        <form id="cloud-config-form" class="cloud-form" autocomplete="off">
          <label class="field"><span>Project URL</span><input name="url" placeholder="https://xxxx.supabase.co" inputmode="url"></label>
          <label class="field"><span>anon public key</span><input name="anonKey" placeholder="eyJhbGciOi…"></label>
          <button class="btn btn-primary" type="submit">Save & continue</button>
        </form>`;
    }
    if (!ci.email) {
      return `${head}
        <p class="muted">Log in on every device with the same email and password. Your progress then syncs automatically.</p>
        <form id="cloud-login-form" class="cloud-form" autocomplete="on">
          <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
          <label class="field"><span>Password <small class="muted">(at least 6 characters)</small></span><input name="password" type="password" minlength="6" autocomplete="current-password" required></label>
          <div class="btn-row"><button class="btn btn-primary" type="submit" name="act" value="in">Log in</button><button class="btn btn-ghost" type="submit" name="act" value="up">Create account</button></div>
        </form>
        <p class="tiny cloud-status" id="cloud-status">${cloudStatusText(ci)}</p>
        <p class="muted tiny">Use the email and password from the app, not a login link from the Supabase website. Project: ${esc(ci.host)}</p>
        ${ci.builtIn ? '' : '<button type="button" class="link-btn tiny" id="cloud-reset">Change Supabase project</button>'}`;
    }
    return `${head}
      <p>Logged in as <b>${esc(ci.email)}</b></p>
      <p class="cloud-status" id="cloud-status">${cloudStatusText(ci)}</p>
      <p class="muted tiny">Changes upload a few seconds after you make them, and the app checks for changes from your other device whenever you open it.</p>
      <p class="muted tiny">Project: ${esc(ci.host)}</p>
      <div class="btn-row"><button class="btn btn-primary btn-small" id="cloud-sync">🔄 Sync now</button><button class="btn btn-ghost btn-small" id="cloud-logout">Log out</button></div>`;
  }
  function renderCloudCard() { const c = document.getElementById('cloud-card'); if (c) c.innerHTML = cloudCardHTML(); }

  /* Both devices changed since the last sync: let the player pick which one to keep. */
  function cloudConflict(local, remote) {
    return new Promise((resolve) => {
      const sum = (s) => { const i = Game.levelInfo(s.hero.totalXP), n = s.stats ? s.stats.workouts + s.stats.tasks : 0; return `<b>Level ${i.level}</b><span>${(s.hero.totalXP || 0).toLocaleString()} XP · ${n} quest${n === 1 ? '' : 's'} done</span><small class="muted">Last change: ${s.meta && s.meta.updatedAt ? new Date(s.meta.updatedAt).toLocaleString() : 'unknown'}</small>`; };
      const md = modal(`
        <div class="modal-burst">☁️</div>
        <h2>Which progress do you want to keep?</h2>
        <p class="muted">This device and the cloud both have changes. Pick one: the other will be replaced.</p>
        <div class="conflict-grid">
          <button class="conflict-opt" data-keep="local"><span>📱 This device</span>${sum(local)}</button>
          <button class="conflict-opt" data-keep="cloud"><span>☁️ Cloud</span>${sum(remote)}</button>
        </div>`, { dismissable: false });
      md.root.querySelectorAll('[data-keep]').forEach(b => b.addEventListener('click', () => { md.close(); resolve(b.dataset.keep); }));
    });
  }
  function cloudApplied() {
    if ($('#app').hidden) { $('#modal-root').innerHTML = ''; boot(); toast('☁️ Your progress was loaded from the cloud'); return; }
    const rep = Game.ensureToday();
    renderAll();
    toast('☁️ Updated with progress from your other device');
    if (rep) showReport(rep);
  }
  function cloudLoginModal() {
    const md = modal(`<div class="modal-burst">☁️</div><h2>Log in to cloud sync</h2>
      <form id="cloud-login-form2" class="cloud-form">
        <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" type="submit">Log in</button></div>
      </form>`);
    md.root.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      try { await Cloud.signIn(f.get('email'), f.get('password')); if (!Game.state) { Sound.play('error'); toast('No cloud progress found for this account yet.'); } }
      catch (err) { Sound.play('error'); toast(`❌ ${err.message}`); }
    });
  }

  function installHTML() {
    if (window.matchMedia('(display-mode: standalone)').matches || navigator.standalone) return '<p class="muted">✅ You\'re using the installed app. It works offline too.</p>';
    if (installPrompt) return '<p class="muted">Put QuestFit on your home screen. It opens like a normal app and works offline.</p><button class="btn btn-primary" id="install-btn">📲 Install QuestFit</button>';
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    if (ios) return '<p class="muted">On iPhone/iPad: open this page in <b>Safari</b>, tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</p>';
    return '<p class="muted">On Android (Chrome): open the browser menu <b>⋮</b> and tap <b>Install app</b> or <b>Add to Home screen</b>. On a computer, look for the install icon in the address bar. (Requires the online version, e.g. GitHub Pages.)</p>';
  }

  /* ================= modals & effects ================= */
  function modal(html, { onClose, dismissable = true, cls = '' } = {}) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal-backdrop"><div class="modal ${cls}" role="dialog" aria-modal="true">${html}</div></div>`;
    let closed = false;
    const close = () => { if (closed) return; closed = true; root.innerHTML = ''; onClose && onClose(); };
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
    Arena.whenIdle().then(() => fn(() => nextModal()));
  }

  function toast(text, cls = '', ms = 2600) {
    const el = document.createElement('div');
    el.className = `toast ${cls}`;
    el.style.setProperty('--ms', ms + 'ms');
    if (typeof text === 'string') el.textContent = text; else el.appendChild(text);
    const root = $('#toast-root');
    root.appendChild(el);
    while (root.children.length > 3) root.firstElementChild.remove();
    setTimeout(() => el.remove(), ms);
  }
  /* One combined popup instead of a stack of separate ones. */
  function rewardToast(lines) {
    const el = document.createElement('div');
    el.className = 'reward-toast-inner';
    el.innerHTML = `<b>✨ Rewards</b><ul>${lines.map(l => `<li>${l}</li>`).join('')}</ul>`;
    toast(el, 'reward-toast', 3200 + lines.length * 700);
  }
  function achievementToast(a) {
    const el = document.createElement('div');
    el.className = 'ach-toast-inner';
    el.innerHTML = `<span class="ach-toast-icon">${a.icon}</span><span><small>Achievement unlocked!</small><b>${esc(a.name)}</b><em>${esc(a.desc)}</em></span>`;
    toast(el, 'ach-toast', 4000);
  }
  function floatText(anchor, text, cls, dy = 0) {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = `float-text ${cls || ''}`;
    el.textContent = text;
    el.style.left = `${Math.min(window.innerWidth - 40, Math.max(40, r.left + r.width / 2))}px`;
    el.style.top = `${r.top + window.scrollY + dy}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }
  function animate(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

  function lootBlock(it) {
    const R = RARITIES[it.rarity];
    return `<div class="loot rarity-${it.rarity}">
      <div class="loot-art">${Art.item(it)}</div>
      <div class="loot-name" style="color:${R.color}">${esc(it.name)}</div>
      <div class="loot-meta">${R.label} ${SLOTS[it.slot].label} · +${it.bonus}% XP</div>
      ${effectsList(it)}
    </div>`;
  }
  /* Loot popup with an Equip button when the new item isn't auto-equipped. */
  function lootModal({ burst, title, intro, item, autoEquip, extra = '', sound }) {
    enqueueModal((done) => {
      if (sound) Sound.play(sound);
      const cur = item ? Game.equippedItem(item.slot) : null;
      const showEquip = item && !autoEquip && cur?.id !== item.id;
      const better = showEquip && cur && item.bonus > cur.bonus;
      const m = modal(`
        <div class="modal-burst">${burst}</div>
        <h2>${title}</h2>
        ${extra}
        ${intro ? `<p>${intro}</p>` : ''}
        ${item ? lootBlock(item) : ''}
        ${item && autoEquip ? '<p class="muted">Equipped automatically — check out your new look!</p>' : showEquip && cur ? `<p class="muted">Currently wearing: ${esc(cur.name)} (+${cur.bonus}%)</p>` : ''}
        <div class="modal-actions">
          ${showEquip ? `<button class="btn ${better ? 'btn-primary' : 'btn-ghost'}" id="loot-equip">Equip${better ? ' (better!)' : ''}</button>` : ''}
          <button class="btn ${!showEquip || !better ? 'btn-primary' : 'btn-ghost'}" data-close>Awesome</button>
        </div>`, { onClose: () => { renderAll(); done(); } });
      const eqBtn = m.root.querySelector('#loot-equip');
      if (eqBtn) eqBtn.addEventListener('click', () => { Sound.play('loot'); handleEvents(Game.equip(item.id)); m.close(); });
    });
  }

  function handleEvents(events, anchor) {
    const summary = [], achs = [];
    for (const ev of events || []) {
      if (ev.type === 'xp') {
        floatText(anchor, `${ev.crit ? '💥 ' : ''}+${ev.amount} XP`, ev.crit ? 'xp crit' : 'xp');
        setTimeout(() => floatText(anchor, `+${ev.gold} 🪙`, 'gold-float', 26), 150);
        animate($('#hero-art'), 'attack');
        lastActivity = Date.now();
        const willDefeat = events.some(e => e.type === 'defeat');
        Arena.attack({ damage: ev.damage, crit: ev.crit, combo: ev.combo }).then(() => {
          if (willDefeat) return;
          const p = Game.progress();
          speak(ev.crit ? 'crit' : ev.combo >= 3 ? 'combo' : p.pct >= 0.66 ? 'nervous' : 'hit');
        });
        if (ev.healed) setTimeout(() => floatText($('#hero-art'), `+${ev.healed} HP`, 'heal'), 300);
        if (ev.speed) summary.push('⚡ Speed bonus: +25% XP');
        if (ev.secondWind) summary.push('🌬️ Second Wind: ×1.5 XP, double damage');
        if (ev.crit) { Sound.play('crit'); summary.push(ev.critMult === 3 ? '🪓 Executioner crit: triple XP & gold' : '💥 Critical hit: double XP & gold'); }
        else Sound.play('complete');
        if (ev.combo >= 2) setTimeout(() => { Sound.play('combo', ev.combo); floatText($('#combo-meter') || anchor, `⚡ COMBO ×${ev.combo}`, 'combo-float'); }, 350);
      } else if (ev.type === 'bossHit') {
        setTimeout(() => { animate($('#boss-art'), 'hit'); Sound.play('bossHit'); floatText($('#boss-art'), `-${ev.dmg}`, 'dmg', 10); }, 200);
      } else if (ev.type === 'challenge') {
        summary.push(`⭐ Daily challenge: +${ev.gold} gold`);
      } else if (ev.type === 'bonus') {
        setTimeout(() => Sound.play('bonus'), 250);
        summary.push(`🎯 Daily goal bonus: +${ev.amount} XP`);
      } else if (ev.type === 'achievement') {
        achs.push(ev.ach);
      } else if (ev.type === 'egg') {
        summary.push(`🥚 You earned a ${PETS[ev.id].name} egg! Do ${PET_HATCH} quests to hatch it`);
      } else if (ev.type === 'petLevel') {
        summary.push(`🐾 ${PETS[ev.id].name} grew to level ${ev.level}: ${PETS[ev.id].bonusText(ev.level)}`);
      } else if (ev.type === 'habitLevel') {
        summary.push(`${ev.level.icon} “${esc(ev.title)}” is now a ${ev.level.name} habit!`);
      } else if (ev.type === 'petHatch') {
        enqueueModal((done) => {
          Sound.play('chest');
          const P = PETS[ev.id];
          modal(`<div class="hatch-anim"><span class="hatch-egg">🥚</span><div class="hatch-pet">${petArt(ev.id, 1)}</div></div>
            <h2>Your egg hatched!</h2><p>Say hi to your new <b>${P.name}</b>! It grows as you complete quests together.</p>
            <p class="muted">Bonus: ${P.bonusText(1)} (grows every level, up to level ${PET_MAX_LEVEL})</p>
            <div class="modal-actions"><button class="btn btn-primary" data-close>Welcome! 🐾</button></div>`, { onClose: () => { renderAll(); done(); } });
        });
      } else if (ev.type === 'defeat') {
        Arena.defeat(ev.enemy.tier, ev.rest).then(() => { speak(ev.rest ? 'sleeping' : 'beaten'); renderBattle(); });
        const m = Game.state.motivation;
        const reward = m.dailyReward ? `<div class="real-reward">🎁 Real-life reward unlocked:<b>${esc(m.dailyReward)}</b></div>` : '';
        if (ev.rest) lootModal({ burst: '😴', title: 'Rest day complete!', extra: reward, intro: `Your streak continues. You found <b>${ev.gold} gold</b> while resting.`, sound: 'victory' });
        else lootModal({ burst: '🏆', title: 'Enemy defeated!', extra: reward, intro: `You beat the <b>${esc(ev.enemy.name)}</b> and got <b>${ev.gold} gold</b>. It also dropped:`, item: ev.item, autoEquip: ev.autoEquip, sound: 'victory' });
      } else if (ev.type === 'monster') {
        Arena.monster(ev.monster.tier);
        if (ev.item) lootModal({ burst: '👾', title: 'Wandering monster defeated!', intro: `You beat the <b>${esc(ev.monster.name)}</b> that was following you. It dropped:`, item: ev.item, autoEquip: ev.autoEquip, sound: 'victory' });
        else lootModal({ burst: '👾', title: 'Wandering monster defeated!', intro: `You beat the <b>${esc(ev.monster.name)}</b> and found a pouch with <b>${ev.gold} gold</b>!`, sound: 'victory' });
      } else if (ev.type === 'bossDefeat') {
        lootModal({ burst: '👑', title: 'WEEKLY BOSS DEFEATED!', intro: `You took down the <b>${esc(ev.boss.name)}</b>! +<b>${ev.gold} gold</b> and a guaranteed Epic+ drop:`, item: ev.item, autoEquip: ev.autoEquip, sound: 'victory' });
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
          const unlocks = LOOKS.capes.filter(o => o.req && o.req.level && o.req.level > ev.from && o.req.level <= ev.to);
          const changes = [];
          Sound.play('levelup');
          if (ev.skillPoint) changes.push('🌳 <b>New skill point!</b> Spend it in the Hero tab');
          unlocks.forEach(u => changes.push(`🎨 Unlocked: <b>${esc(u.name)}</b> (Gear → Appearance)`));
          if (b.workouts > a.workouts) changes.push(`Daily workouts: ${a.workouts} → <b>${b.workouts}</b>`);
          if (b.tasks > a.tasks) changes.push(`Daily tasks: ${a.tasks} → <b>${b.tasks}</b>`);
          changes.push(`Workouts get tougher (push-ups ${Game.workoutAmount(WORKOUTS[0], ev.from, diff)} → <b>${Game.workoutAmount(WORKOUTS[0], ev.to, diff)}</b>)`);
          changes.push(`HP fully restored (max ${Game.heroMaxHP()})`);
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
    if (achs.length) summary.push(`🏅 ${achs.length > 1 ? `${achs.length} achievements` : 'Achievement'}: ${achs.map(a => `${a.icon} ${esc(a.name)}`).join(', ')}`);
    if (summary.length) {
      const show = () => { if (achs.length) Sound.play('achievement'); rewardToast(summary); };
      if (events.some(e => e.type === 'xp')) Arena.whenIdle().then(show); else show();
    }
  }

  function showReport(report) {
    if (!report) return;
    enqueueModal((done) => {
      if (report.days.some(d => !d.met && d.dmg)) Sound.play('hurt');
      const lines = report.days.map(d => d.met
        ? `<li class="win">${d.rest ? '😴 Rest day done' : `🏆 You beat the ${esc(d.enemy)}`} and recovered ${d.heal} HP</li>`
        : d.rest ? '<li class="loss">😴 You skipped your light activity on rest day (no damage)</li>'
        : `<li class="loss">💀 ${d.key === 'skipped' ? 'Skipped day — the' : 'The'} ${esc(d.enemy)} hit you for <b>${d.dmg}</b> damage</li>`).join('');
      modal(`
        <div class="modal-burst">🌅</div>
        <h2>A new day begins</h2>
        <ul class="report">${lines}
          ${report.phoenix ? '<li class="win">🔥 <b>Phoenix!</b> Your gear saved you from a knockout with 1 HP left.</li>' : ''}
          ${report.shieldUsed ? `<li class="win">🛡️ A streak shield saved your streak${report.shieldUsed > 1 ? ` (${report.shieldUsed} used)` : ''}!</li>` : ''}
          ${report.bossEscaped ? `<li class="loss">👑 The ${esc(report.bossEscaped)} escaped at the end of the week.</li>` : ''}
          ${report.newBoss ? `<li>👑 A new weekly boss appears: <b>${esc(report.newBoss)}</b></li>` : ''}
        </ul>
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
        <p>Fresh quests, a daily chest and a new enemy await.</p>
        <div class="modal-actions"><button class="btn btn-primary" data-close>To battle!</button></div>`,
        { onClose: () => { renderAll(); done(); } });
    });
    if (report.review) reviewModal(report.review, true);
  }

  function reasonsModal(intro = false, after) {
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
          <button type="button" class="btn btn-ghost" data-close>${intro ? 'Skip for now' : 'Cancel'}</button>
          <button class="btn btn-primary" type="submit">Save</button>
        </div>
      </form>`, { onClose: () => { renderAll(); if (after) after(); } });
    md.root.querySelector('#reasons-form').addEventListener('submit', (e) => {
      e.preventDefault();
      Game.setMotivation(Object.fromEntries(new FormData(e.target)));
      Sound.play('loot');
      md.close();
      toast('🎯 Your reasons are saved');
    });
  }

  /* ---------- chest ---------- */
  function openChestFlow() {
    const res = Game.openChest();
    if (!res) return;
    Sound.play('chest');
    const content = res.type === 'gold' ? `<div class="chest-prize">🪙<b>${res.gold} gold</b></div>`
      : res.type === 'potion' ? '<div class="chest-prize">🧪<b>Health potion</b></div>'
      : res.type === 'shield' ? '<div class="chest-prize">🛡️<b>Streak shield</b></div>' : '';
    enqueueModal((done) => {
      const m = modal(`
        <div class="chest-anim"><span class="chest-closed">🎁</span><span class="chest-burst">✨</span></div>
        <h2>Daily chest</h2>
        <div class="chest-reveal">${content}${res.item ? lootBlock(res.item) + (res.autoEquip ? '<p class="muted">Equipped automatically!</p>' : '<p class="muted">Added to your backpack.</p>') : ''}</div>
        <div class="modal-actions"><button class="btn btn-primary" data-close>Nice!</button></div>`, { onClose: () => { renderAll(); done(); handleEvents(res.events); } });
      void m;
    });
  }

  /* ---------- editing custom quests & exercise tracking ---------- */
  function editTaskModal(id) {
    const t = Game.state.tasks.find(x => x.id === id);
    if (!t) return;
    const md = modal(`
      <div class="modal-burst">✏️</div>
      <h2>Edit quest</h2>
      <form id="edit-form" autocomplete="off">
        <label class="field"><span>Name</span><input name="title" maxlength="80" value="${esc(t.title)}" required></label>
        <label class="field"><span>Effort</span><select name="effort">${Object.entries(EFFORTS).map(([k, e]) => `<option value="${k}" ${k === t.effort ? 'selected' : ''}>${e.label} (${e.xp} base XP)</option>`).join('')}</select></label>
        ${t.repeat !== 'once' ? repeatFields(t.repeat, t.days || [], { allowOnce: false }) : ''}
        ${t.kind === 'workout' ? exerciseFields('', t.exId, t.amount) + '<p class="muted tiny">Changing the amount applies from now on. Today\'s finished quest keeps its old amount.</p>' : ''}
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save</button></div>
      </form>`, { onClose: renderAll });
    const form = md.root.querySelector('#edit-form');
    form.addEventListener('change', (e) => { if (e.target.classList.contains('ex-select')) syncExerciseFields(form); if (e.target.name === 'repeat') syncRepeat(form); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(form);
      Game.updateTask(id, { title: f.get('title'), effort: f.get('effort'), ...(t.repeat !== 'once' ? { repeat: f.get('repeat'), days: f.getAll('days') } : {}), ...(t.kind === 'workout' ? readExercise(f) : {}) });
      Sound.play('loot'); md.close(); toast('✏️ Quest updated');
    });
  }

  /* One-time popup: connect workouts added before tracking existed to an exercise. */
  function linkWorkoutsModal() {
    const list = Game.unlinkedWorkouts();
    if (!list.length) return;
    enqueueModal((done) => {
      const rows = list.map(t => {
        const d = Game.detectExercise(t.title);
        return `<div class="link-row"><b>🏋️ ${esc(t.title)}</b>${exerciseFields(t.id + '_', d.exId, d.amount)}</div>`;
      }).join('');
      const md = modal(`
        <div class="modal-burst">📊</div>
        <h2>Count your own workouts in your stats</h2>
        <p class="muted">Your own workouts can now count toward your lifetime totals, hero stats and achievements. Check the exercise and fill in how much you do each time.</p>
        <form id="link-form" autocomplete="off">${rows}
          <div class="modal-actions"><button type="button" class="btn btn-ghost" id="link-skip">Don't track these</button><button class="btn btn-primary" type="submit">Save</button></div>
        </form>`, { dismissable: false, onClose: () => { renderAll(); done(); } });
      const form = md.root.querySelector('#link-form');
      list.forEach(t => {
        const d = Game.detectExercise(t.title);
        if (d.customName) { form.querySelector(`[name="${t.id}_exId"]`).value = 'other'; form.querySelector(`[name="${t.id}_customName"]`).value = d.customName; form.querySelector(`[name="${t.id}_customUnit"]`).value = d.customUnit; }
      });
      syncExerciseFields(form);
      form.addEventListener('change', (e) => { if (e.target.classList.contains('ex-select')) syncExerciseFields(form); });
      md.root.querySelector('#link-skip').addEventListener('click', () => { Game.dismissLinking(); md.close(); });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const f = new FormData(form);
        list.forEach(t => Game.updateTask(t.id, readExercise(f, t.id + '_')));
        Sound.play('loot'); md.close(); toast('📊 Your workouts now count in your stats');
      });
    });
  }

  function addRepsModal() {
    const md = modal(`
      <div class="modal-burst">➕</div>
      <h2>Add missing reps</h2>
      <p class="muted">Did a workout that wasn't counted? Add it to your lifetime totals here.</p>
      <form id="reps-form" autocomplete="off">
        ${exerciseFields('', 'pushups', null, { required: true })}
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" type="submit">Add</button></div>
      </form>`, { onClose: renderAll });
    const form = md.root.querySelector('#reps-form');
    form.addEventListener('change', (e) => { if (e.target.classList.contains('ex-select')) syncExerciseFields(form); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const { exId, amount } = Game.resolveExercise(readExercise(f));
      if (!exId || !Game.addReps(exId, amount)) { Sound.play('error'); toast('Enter an amount above 0.'); return; }
      const info = Game.exerciseInfo(exId);
      Sound.play('coin'); md.close(); toast(`➕ Added ${amount} ${info.unit} of ${info.name}`);
    });
  }

  /* ---------- notes, day details, weekly review ---------- */
  function noteModal(key) {
    const q = [...Game.quests(), Game.challengeQuest(), ...Game.quickQuests()].find(x => x.key === key);
    const item = q ? { t: q.title } : null;
    const md = modal(`
      <div class="modal-burst">📝</div>
      <h2>Add a note</h2>
      <p class="muted">${item ? esc(item.t) : 'Quest'} · e.g. how it went, how you felt, a new personal best.</p>
      <form id="note-form"><textarea name="note" class="code-box note-box" rows="4" maxlength="280" placeholder="Ran 5.2 km, felt great!">${esc(noteOf(key))}</textarea>
        <div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" type="submit">Save note</button></div></form>`, { onClose: renderAll });
    const ta = md.root.querySelector('textarea'); ta.focus();
    md.root.querySelector('#note-form').addEventListener('submit', (e) => { e.preventDefault(); Game.setNote(key, ta.value); Sound.play('click'); md.close(); toast('📝 Note saved'); });
  }
  function dayModal(key) {
    const today = key === Game.todayKey();
    const h = today ? null : Game.state.history.find(x => x.key === key);
    const items = today ? Game.dayItems() : (h && h.items) || [];
    const reps = today ? {} : (h && h.reps) || {};
    const date = Game.keyToDate(key).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    const result = today ? (Game.progress().met ? '🏆 Enemy defeated' : '⚔️ Battle in progress') : h ? (h.rest && h.met ? '😴 Rest day done' : h.met ? `🏆 Beat the ${esc(h.enemy)}` : `💀 Lost to the ${esc(h.enemy)}`) : '';
    const repLines = Object.entries(reps).map(([id, n]) => { const x = Game.exerciseInfo(id); return x ? `<li>${x.icon} ${esc(x.name)}: <b>${n} ${x.unit}</b></li>` : ''; }).join('');
    modal(`
      <div class="modal-burst">📓</div>
      <h2>${date}</h2>
      <p><b>${result}</b></p>
      ${items.length ? `<ul class="day-items">${items.map(x => `<li><span>${x.i} ${esc(x.t)}${x.q ? ' <small class="muted">(Quick Quest)</small>' : ''}</span>${x.n ? `<em>📝 ${esc(x.n)}</em>` : ''}</li>`).join('')}</ul>` : `<p class="muted">${h ? 'This day was saved before the calendar kept details.' : 'Nothing completed yet.'}</p>`}
      ${repLines ? `<h3 class="sub">Reps</h3><ul class="day-reps">${repLines}</ul>` : ''}
      <div class="modal-actions"><button class="btn btn-primary" data-close>Close</button></div>`);
  }
  function reviewModal(r, fromReport = false) {
    if (!r) { toast('No review yet: play a full week first.'); return; }
    const start = Game.keyToDate(r.week), end = Game.keyToDate(r.week); end.setDate(end.getDate() + 6);
    const range = `${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
    const reps = Object.entries(r.reps).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => { const x = Game.exerciseInfo(id); return x ? `<li>${x.icon} ${esc(x.name)}: <b>${n} ${x.unit}</b></li>` : ''; }).join('');
    const tips = r.slipped.map(sl => `<li><b>${esc(sl.title)}</b>: missed ${sl.missed} of ${sl.scheduled} days. ${sl.missed / sl.scheduled >= 0.6 ? 'Make it smaller (e.g. 5 minutes instead of 15) or move it to fewer days?' : 'Try doing it at the same time every day, like right after breakfast.'} <button class="link-btn" data-edit-habit="${sl.id}">Edit</button></li>`).join('');
    const fn = (done) => {
      const md = modal(`
        <div class="modal-burst">📊</div>
        <h2>Your week in review</h2>
        <p class="muted">${range}</p>
        <div class="stats review-stats">
          <div class="stat"><b>${r.wins}/${r.days}</b><span>Enemies beaten</span></div>
          <div class="stat"><b>${r.quests}</b><span>Quests done</span></div>
          <div class="stat"><b>${r.workouts}</b><span>Workouts</span></div>
        </div>
        ${r.best && r.best.done ? `<p>⭐ Best day: <b>${Game.keyToDate(r.best.key).toLocaleDateString(undefined, { weekday: 'long' })}</b> with ${r.best.done} quests.</p>` : ''}
        ${reps ? `<h3 class="sub">Top exercises</h3><ul class="day-reps">${reps}</ul>` : ''}
        ${r.strong.length ? `<p>💪 Perfect habits: <b>${r.strong.map(esc).join(', ')}</b>. Keep it up!</p>` : ''}
        ${tips ? `<h3 class="sub">Habits that slipped</h3><ul class="review-tips">${tips}</ul>` : '<p>🌟 No habits slipped this week. Amazing!</p>'}
        <div class="modal-actions"><button class="btn btn-primary" data-close>${fromReport ? "Let's make this week better!" : 'Close'}</button></div>`, { onClose: () => { renderAll(); done && done(); } });
      md.root.querySelectorAll('[data-edit-habit]').forEach(b => b.addEventListener('click', () => { md.close(); setTimeout(() => editTaskModal(b.dataset.editHabit), 50); }));
    };
    if (fromReport) enqueueModal(fn); else fn();
  }

  /* ---------- quick quest roller ---------- */
  let quickPrefs = { kind: 'any', time: 5 };
  function quickModal() {
    let candidate = null, freeReroll = true;
    const seen = [];
    const chips = (name, opts, cur) => opts.map(([v, l]) => `<button type="button" class="look-opt ${String(cur) === String(v) ? 'on' : ''}" data-q${name}="${v}">${l}</button>`).join('');
    const md = modal(`
      <div class="modal-burst quick-burst" id="quick-dice">🎲</div>
      <h2>Quick Quest</h2>
      <p class="muted">Bored and got a few minutes? Roll a random challenge. Finish it within the time for a ⚡ +25% speed bonus.</p>
      <div class="look-row"><span>Type</span><div class="opts" id="q-kind">${chips('kind', [['workout', '🏋️ Workout'], ['task', '📜 Task'], ['any', '🎲 Surprise me']], quickPrefs.kind)}</div></div>
      <div class="look-row"><span>Time I have</span><div class="opts" id="q-time">${chips('time', Object.entries(QUICK_TIMES).map(([k, t]) => [k, `${t.icon} ${t.label}`]), quickPrefs.time)}</div></div>
      <div id="quick-result"></div>
      <div class="modal-actions" id="quick-actions"><button class="btn btn-primary btn-block" id="quick-roll">🎲 Roll!</button></div>`);
    const root = md.root;
    const res = root.querySelector('#quick-result'), acts = root.querySelector('#quick-actions');
    root.addEventListener('click', (e) => {
      const k = e.target.closest('[data-qkind]'), t = e.target.closest('[data-qtime]');
      if (k) { quickPrefs.kind = k.dataset.qkind; root.querySelectorAll('[data-qkind]').forEach(b => b.classList.toggle('on', b === k)); Sound.play('click'); }
      if (t) { quickPrefs.time = +t.dataset.qtime; root.querySelectorAll('[data-qtime]').forEach(b => b.classList.toggle('on', b === t)); Sound.play('click'); }
      if (e.target.closest('#quick-roll')) roll(false);
      if (e.target.closest('#quick-reroll')) {
        if (!freeReroll && !Game.payGold(10)) { Sound.play('error'); toast('You need 10 gold to reroll.'); return; }
        const wasFree = freeReroll; freeReroll = false; roll(true, wasFree);
      }
      if (e.target.closest('#quick-accept') && candidate) {
        const q = Game.acceptQuick(candidate);
        Sound.play('buy');
        md.close();
        renderAll();
        toast(`🎲 Quick Quest accepted: ${q.title}`);
        if (q.monster) setTimeout(() => toast(`👾 A wandering ${q.monster.name} is following you!`, 'crit-toast'), 400);
      }
      if (e.target.closest('#quick-skip')) { candidate = null; freeReroll = true; res.innerHTML = ''; acts.innerHTML = '<button class="btn btn-primary btn-block" id="quick-roll">🎲 Roll!</button>'; }
    });
    function roll(isReroll, wasFree) {
      const dice = root.querySelector('#quick-dice');
      animate(dice, 'rolling');
      Sound.play('swap');
      acts.innerHTML = '';
      // flash a few random titles before revealing, like a slot machine
      let n = 0;
      const pool = QUICK_QUESTS.filter(q => q.time === quickPrefs.time && (quickPrefs.kind === 'any' || q.kind === quickPrefs.kind));
      const iv = setInterval(() => {
        const p = pool[Math.floor(Math.random() * pool.length)];
        res.innerHTML = `<div class="quick-card spinning"><span class="quick-icon">${p.icon}</span><b>${esc(p.t.replace(/\{n\}/g, '?'))}</b></div>`;
        if (++n % 2) Sound.play('tick');
        if (n >= 8) { clearInterval(iv); reveal(isReroll, wasFree); }
      }, 85);
    }
    function reveal(isReroll, wasFree) {
      candidate = Game.rollQuick(quickPrefs, seen);
      seen.push(candidate.t);
      const half = Game.quickFullLeft() === 0;
      Sound.play(candidate.monster ? 'bossHit' : 'coin');
      res.innerHTML = `<div class="quick-card ${candidate.monster ? 'has-monster' : ''}">
        <span class="quick-icon">${candidate.icon}</span>
        <b>${esc(candidate.title)}</b>
        <small>${candidate.kind === 'workout' ? '🏋️ Workout' : '📜 Task'} · ${QUICK_TIMES[candidate.time].icon} ${QUICK_TIMES[candidate.time].label}${candidate.timer ? ' · ⏱️ timer available' : ''}</small>
        <div class="quick-rewards"><span>+${half ? Math.round(candidate.xp / 2) : candidate.xp} XP</span><span>+${half ? Math.round(candidate.gold / 2) : candidate.gold} 🪙</span><span>⚡ +25% if done in ${QUICK_TIMES[candidate.time].label}</span></div>
        ${half ? '<p class="muted tiny">You\'ve used today\'s 5 full-reward Quick Quests, so this one gives 50%.</p>' : ''}
        ${candidate.monster ? `<div class="monster-alert"><div class="monster-art">${Art.enemy(candidate.monster.tier)}</div><span><b>👾 A wandering ${esc(candidate.monster.name)} appears!</b><small>Finish this quest to beat it: it drops gold or gear.</small></span></div>` : ''}
      </div>`;
      acts.innerHTML = `<button class="btn btn-ghost" id="quick-skip">✖ Skip</button>
        <button class="btn btn-ghost" id="quick-reroll">🔄 Reroll${freeReroll ? ' (free)' : ' 🪙10'}</button>
        <button class="btn btn-primary" id="quick-accept">✅ Accept</button>`;
      if (isReroll && !wasFree) renderAll();
    }
  }

  /* ---------- workout timer ---------- */
  let wakeLock = null;
  function timerModal(key) {
    const q = [...Game.quests(), ...Game.quickQuests()].find(x => x.key === key);
    if (!q || !q.timer) return;
    const total = q.timer;
    let remaining = total, endAt = 0, running = false, iv = null, lastBeep = -1;
    const md = modal(`
      <h2>⏱️ ${esc(q.title)}</h2>
      <p class="muted">${q.quick ? 'Quick Quest' : esc(q.detail)} · the quest completes automatically when the timer ends.</p>
      <div class="timer-ring" id="timer-ring" style="--p:1"><span id="timer-text">${fmtSecs(total)}</span></div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="timer-toggle">▶ Start</button>
        <button class="btn btn-ghost" id="timer-reset">↺ Reset</button>
        <button class="btn btn-ghost" data-close>Cancel</button>
      </div>`, { onClose: () => { clearInterval(iv); releaseWake(); }, dismissable: false });
    const text = md.root.querySelector('#timer-text'), ring = md.root.querySelector('#timer-ring'), btn = md.root.querySelector('#timer-toggle');
    const draw = () => { text.textContent = fmtSecs(Math.ceil(remaining)); ring.style.setProperty('--p', (remaining / total).toFixed(4)); };
    const tick = () => {
      remaining = Math.max(0, (endAt - Date.now()) / 1000);
      const whole = Math.ceil(remaining);
      if (whole <= 3 && whole > 0 && whole !== lastBeep) { lastBeep = whole; Sound.play('tick'); }
      draw();
      if (remaining <= 0) finish();
    };
    const finish = () => {
      clearInterval(iv); running = false;
      Sound.play('timerDone');
      md.close();
      const events = Game.complete(key, { viaTimer: true });
      renderAll();
      const row = document.querySelector(`[data-key="${CSS.escape(key)}"] .xp-chip`) || $('#hero-art');
      withArenaInView(() => handleEvents(events, row));
      toast('⏱️ Time! Quest complete', 'gold');
    };
    btn.addEventListener('click', () => {
      if (running) { clearInterval(iv); running = false; btn.textContent = '▶ Resume'; releaseWake(); return; }
      endAt = Date.now() + remaining * 1000; running = true; btn.textContent = '⏸ Pause';
      iv = setInterval(tick, 200);
      requestWake();
      Sound.play('click');
    });
    md.root.querySelector('#timer-reset').addEventListener('click', () => { clearInterval(iv); running = false; remaining = total; lastBeep = -1; btn.textContent = '▶ Start'; draw(); });
  }
  async function requestWake() { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; } }
  function releaseWake() { try { wakeLock?.release(); } catch { /* ignore */ } wakeLock = null; }

  /* ---------- sync ---------- */
  async function encodeSync() {
    const json = Game.exportData();
    const bytes = new TextEncoder().encode(json);
    if (window.CompressionStream) {
      const gz = await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
      return 'QF1:' + b64(new Uint8Array(gz));
    }
    return 'QF0:' + b64(bytes);
  }
  async function decodeSync(code) {
    code = code.trim().replace(/\s+/g, '');
    if (code.startsWith('{')) return code;
    const [tag, data] = [code.slice(0, 4), code.slice(4)];
    const bytes = unb64(data);
    if (tag === 'QF1:') {
      const buf = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      return new TextDecoder().decode(buf);
    }
    if (tag === 'QF0:') return new TextDecoder().decode(bytes);
    throw new Error('bad code');
  }
  function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function unb64(str) { const s = atob(str); const u8 = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i); return u8; }

  async function copyCode() {
    const code = await encodeSync();
    let copied = false;
    try { await navigator.clipboard.writeText(code); copied = true; } catch { copied = false; }
    const md = modal(`
      <div class="modal-burst">📋</div>
      <h2>${copied ? 'Sync code copied!' : 'Your sync code'}</h2>
      <p class="muted">${copied ? 'Paste it on your other device: Journey → Backup & sync → Paste code.' : 'Copy this code and paste it on your other device: Journey → Backup & sync → Paste code.'} You can send it to yourself by message or email.</p>
      <textarea class="code-box" readonly rows="5">${esc(code)}</textarea>
      <p class="muted tiny">⚠️ Loading a code replaces the progress on the other device.</p>
      <div class="modal-actions"><button class="btn btn-primary" data-close>Done</button></div>`);
    const ta = md.root.querySelector('textarea');
    ta.addEventListener('focus', () => ta.select());
    if (!copied) { ta.focus(); ta.select(); }
  }
  function pasteCode() {
    const md = modal(`
      <div class="modal-burst">📥</div>
      <h2>Paste a sync code</h2>
      <p class="muted">This will <b>replace</b> the progress on this device with the progress from the code.</p>
      <textarea class="code-box" id="paste-box" rows="5" placeholder="QF1:…"></textarea>
      <div class="modal-actions"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-primary" id="load-code">Load progress</button></div>`);
    md.root.querySelector('#load-code').addEventListener('click', async () => {
      try {
        const json = await decodeSync(md.root.querySelector('#paste-box').value);
        if (!Game.importData(json)) throw new Error('invalid');
        toast('✅ Progress loaded');
        setTimeout(() => location.reload(), 600);
      } catch { Sound.play('error'); toast('❌ That code didn\'t work. Copy it again and paste the whole thing.'); }
    });
  }
  function exportFile() {
    const blob = new Blob([Game.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `questfit-backup-${Game.todayKey()}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('💾 Backup downloaded');
  }
  function importFile(file) {
    const r = new FileReader();
    r.onload = () => {
      if (!confirm('Load this backup? It replaces the progress on this device.')) return;
      if (Game.importData(String(r.result))) { toast('✅ Backup loaded'); setTimeout(() => location.reload(), 600); }
      else { Sound.play('error'); toast('❌ That file is not a QuestFit backup.'); }
    };
    r.readAsText(file);
  }

  /* ---------- reminders ---------- */
  async function notify(title, body) {
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'questfit-reminder' });
      else new Notification(title, { body, icon: 'icons/icon-192.png' });
    } catch { /* ignore */ }
  }
  function checkReminder() {
    const s = Game.state;
    if (!s || !s.settings.reminders || !('Notification' in window) || Notification.permission !== 'granted') return;
    const today = Game.todayKey();
    if (s.settings.lastReminded === today || s.day.rest || Game.progress().met) return;
    const [h, m] = s.settings.reminderTime.split(':').map(Number);
    const now = new Date();
    if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
    Game.setSetting('lastReminded', today);
    const p = Game.progress(), d = s.day;
    const left = Math.max(0, d.req.workouts - p.workouts) + Math.max(0, d.req.tasks - p.tasks);
    notify(`⚔️ The ${d.enemy.name} is still standing!`, `“${tauntText()}” — ${left} quest${left === 1 ? '' : 's'} left to beat it before midnight.`);
  }

  /* ================= help & tour ================= */
  const TOUR_KEY = 'questfit.tourDone';
  const TOUR = [
    { sel: '#arena', title: 'Your battle', text: 'This is you and today\'s enemy. Every quest you finish makes your hero attack. Beat the enemy by finishing your daily goal before midnight!' },
    { sel: '#hero-card', title: 'Your hero', text: 'Your level, XP and HP. Quests give XP to level up. If the enemy wins at night, you lose HP.' },
    { sel: '#tab-quests .quest-list .quest', title: 'Your quests', text: 'Tap a quest when you\'ve done it. Workouts and tasks both count toward beating the enemy.' },
    { sel: '#quick-btn', title: 'Quick Quests', text: 'Bored with a few minutes to spare? Roll a random mini challenge for bonus XP and gold.' },
    { sel: '#add-toggle', title: 'Your own habits', text: 'Add the things you want to make a habit, every day or on certain weekdays. They track streaks and level up.' },
    { sel: '.tabs', title: 'More to explore', text: 'Gear and pets, the shop, your hero stats and skills, and your journey with calendar, habits and settings.' },
    { sel: '#help-btn', title: 'Need help?', text: 'Tap ❓ any time for help or to see this tour again. Good luck, hero! ⚔️' },
  ];
  function startTour() {
    switchTab('quests');
    let i = 0;
    const layer = document.createElement('div');
    layer.className = 'tour-layer';
    layer.innerHTML = '<div class="tour-spot"></div><div class="tour-tip" role="dialog" aria-live="polite"></div>';
    document.body.appendChild(layer);
    const spot = layer.querySelector('.tour-spot'), tip = layer.querySelector('.tour-tip');
    const end = () => { layer.remove(); try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* ignore */ } };
    const show = () => {
      const step = TOUR[i];
      const target = document.querySelector(step.sel);
      if (!target) { i++; if (i < TOUR.length) show(); else end(); return; }
      target.scrollIntoView({ block: 'center' });
      setTimeout(() => {
        const r = target.getBoundingClientRect(), pad = 6;
        Object.assign(spot.style, { left: `${r.left - pad}px`, top: `${r.top - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
        tip.innerHTML = `<small>${i + 1} / ${TOUR.length}</small><b>${step.title}</b><p>${step.text}</p>
          <div class="btn-row"><button class="btn btn-ghost btn-small" data-tour="skip">Skip</button><button class="btn btn-primary btn-small" data-tour="next">${i === TOUR.length - 1 ? 'Done!' : 'Next →'}</button></div>`;
        const below = r.bottom + 190 < window.innerHeight;
        tip.style.top = below ? `${r.bottom + 14}px` : '';
        tip.style.bottom = below ? '' : `${window.innerHeight - r.top + 14}px`;
      }, 80);
    };
    layer.addEventListener('click', (e) => {
      const b = e.target.closest('[data-tour]');
      if (!b) return;
      Sound.play('click');
      if (b.dataset.tour === 'skip') return end();
      i++;
      if (i >= TOUR.length) end(); else show();
    });
    show();
  }
  function helpModal() {
    const sec = (t, b) => `<details class="help-sec"><summary>${t}</summary><p>${b}</p></details>`;
    const md = modal(`
      <div class="modal-burst">❓</div>
      <h2>How QuestFit works</h2>
      <button class="btn btn-primary btn-block" id="tour-again">🧭 Show the tour</button>
      <div class="help-list">
        ${sec('⚔️ The daily enemy', 'Finish the required number of workouts and tasks before midnight to beat today\'s enemy. You get gear, gold and +1 streak. If you don\'t, it hits you at midnight. At 0 HP you\'re knocked out: you lose XP and a piece of gear.')}
        ${sec('⬆️ Levels', 'Quests give XP. Each level needs a bit more XP, and higher levels need more quests per day and bigger workouts. Every 5 levels you get a skill point (Hero tab).')}
        ${sec('🔁 Habits', 'Your own quests are your habits. Set them to every day or certain weekdays. Each has its own streak and success rate, and levels up at 7, 30, 100 and 365 completions. See them in Journey → My habits.')}
        ${sec('💪 Getting stronger', 'After you do a workout 10 times at the same amount, the app suggests a little more. You decide whether to raise it.')}
        ${sec('🎲 Quick Quests', 'Random 2–15 minute challenges for spare time. They give bonus XP and gold but don\'t count toward the daily goal. The first 5 per day give full rewards.')}
        ${sec('🐾 Pets', 'Earn eggs by reaching goals (see Gear → Pets). An egg hatches after 10 quests. Bring a pet along and it grows with every quest, giving a bonus up to level 10.')}
        ${sec('🎒 Gear & gold', 'Gear gives bonus XP and special effects. Spend gold in the shop on potions, streak shields, crates and eggs. Reforge gear to re-roll its effects.')}
        ${sec('👑 Weekly boss', 'Every quest during the week damages the weekly boss. Beat it by Sunday midnight for Epic+ gear and lots of gold.')}
        ${sec('📝 Notes', 'Tap 📝 on a finished quest to add a note. You can read your notes later by tapping a day in the calendar.')}
        ${sec('🔄 Sync', 'Use cloud sync (Journey → Cloud sync) to keep your phone and computer in sync, or a sync code / backup file.')}
      </div>
      <div class="modal-actions"><button class="btn btn-ghost" data-close>Close</button></div>`);
    md.root.querySelector('#tour-again').addEventListener('click', () => { md.close(); setTimeout(startTour, 100); });
  }

  /* ================= onboarding ================= */
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
      <p>Turn workouts and daily tasks into an adventure. Finish quests to earn XP and gold, level up your hero, defeat enemies and collect gear.</p>
      <form id="start-form">
        <label class="field"><span>Name your hero</span><input name="name" maxlength="20" placeholder="Hero" autofocus></label>
        <div class="field"><span>Choose your difficulty</span><div class="diff-cards">${cards}</div></div>
        <button class="btn btn-primary btn-block" type="submit">Begin adventure</button>
        <p class="muted tiny center">Already playing on another device? ${Cloud.configured() ? '<button type="button" class="link-btn" id="onb-cloud">Log in to cloud sync</button> or ' : ''}<button type="button" class="link-btn" id="onb-sync">use a sync code</button></p>
      </form>`, { dismissable: false });
    m.root.querySelectorAll('[data-pick]').forEach(b => b.addEventListener('click', () => {
      chosen = b.dataset.pick;
      m.root.querySelectorAll('[data-pick]').forEach(x => x.classList.toggle('selected', x === b));
    }));
    m.root.querySelector('#onb-sync').addEventListener('click', () => pasteCode());
    const oc = m.root.querySelector('#onb-cloud'); if (oc) oc.addEventListener('click', () => cloudLoginModal());
    m.root.querySelector('#start-form').addEventListener('submit', (e) => {
      e.preventDefault();
      Game.start(new FormData(e.target).get('name'), chosen);
      m.close();
      boot();
      reasonsModal(true, () => { let seen = false; try { seen = !!localStorage.getItem(TOUR_KEY); } catch { /* ignore */ } if (!seen) setTimeout(startTour, 300); });
    });
  }

  /* ================= events ================= */
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
  function drinkPotion() {
    const healed = Game.usePotion();
    if (!healed) return;
    Sound.play('potion');
    renderAll();
    floatText($('#hero-art'), `+${healed} HP`, 'heal');
    handleEvents(Game.checkAchievements());
  }

  function wire() {
    renderSoundToggle();
    $('#help-btn').addEventListener('click', () => { Sound.play('click'); helpModal(); });
    $('#sound-toggle').addEventListener('click', () => { Sound.setMuted(!Sound.muted); renderSoundToggle(); Sound.play('click'); });
    $('#gold-label').addEventListener('click', () => switchTab('shop'));
    document.querySelector('.tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) { switchTab(b.dataset.tab); Sound.play('click'); } });

    $('#hero-card').addEventListener('click', (e) => { if (e.target.closest('#potion-btn')) drinkPotion(); });
    $('#battle-card').addEventListener('click', (e) => { if (e.target.closest('#reasons-btn')) reasonsModal(); });
    $('#battle-card').addEventListener('toggle', (e) => { if (e.target.id === 'stakes-wrap') stakesOpen = e.target.open; }, true);

    $('#tab-quests').addEventListener('click', (e) => {
      const c = e.target.closest('[data-complete]');
      if (c) {
        const key = c.dataset.complete;
        const li = c.closest('.quest');
        li.classList.add('completing');
        const rect = li.querySelector('.xp-chip').getBoundingClientRect(), capY = window.scrollY;
        const ghost = { getBoundingClientRect: () => ({ left: rect.left, width: rect.width, top: rect.top + capY - window.scrollY }) };
        const events = Game.complete(key);
        justDone = key;
        setTimeout(() => { renderAll(); justDone = null; floatText(ghost, '✓', 'xp'); withArenaInView(() => handleEvents(events, ghost)); }, 280);
        return;
      }
      if (e.target.closest('#chest-btn')) { openChestFlow(); return; }
      if (e.target.closest('#quick-btn')) { Sound.play('click'); quickModal(); return; }
      const nb = e.target.closest('[data-note]');
      if (nb) { noteModal(nb.dataset.note); return; }
      const ol = e.target.closest('[data-overload]');
      if (ol) { Game.acceptOverload(ol.dataset.overload, Number(ol.dataset.to)); Sound.play('levelup'); renderAll(); toast(`💪 Raised to ${ol.dataset.to}. Let's go!`); return; }
      const os = e.target.closest('[data-ol-snooze]');
      if (os) { Game.snoozeOverload(os.dataset.olSnooze); renderAll(); toast('Okay! I\'ll ask again in a week.'); return; }
      const uq = e.target.closest('[data-unquick]');
      if (uq) { Game.removeQuick(uq.dataset.unquick); Sound.play('undo'); renderAll(); toast('Quick Quest removed'); return; }
      const tm = e.target.closest('[data-timer]');
      if (tm) { timerModal(tm.dataset.timer); return; }
      const sw = e.target.closest('[data-swap]');
      if (sw) {
        const w = Game.swapWorkout(sw.dataset.swap);
        if (w) { Sound.play('swap'); renderAll(); toast(`🔄 Swapped to ${w.name}`); }
        return;
      }
      const u = e.target.closest('[data-undo]');
      if (u) { Sound.play('undo'); Game.undo(u.dataset.undo); renderAll(); toast('↩️ Quest marked as not done'); return; }
      const ed = e.target.closest('[data-edit]');
      if (ed) { editTaskModal(ed.dataset.edit); return; }
      const d = e.target.closest('[data-del]');
      if (d) {
        const t = Game.state.tasks.find(x => x.id === d.dataset.del);
        if (t && confirm(`Delete "${t.title}"?`)) { Game.removeTask(t.id); renderAll(); }
        return;
      }
      if (e.target.closest('#add-toggle')) { addOpen = !addOpen; renderQuests(); if (addOpen) $('#add-form input').focus(); return; }
      if (e.target.closest('#edit-toggle')) { editingTasks = !editingTasks; renderQuests(); }
    });
    $('#tab-quests').addEventListener('input', (e) => {
      const form = e.target.closest('#add-form');
      if (!form) return;
      if (e.target.name === 'title' && form.kind.value !== 'workout') {
        const d = Game.detectExercise(e.target.value);
        if (d.exId) { form.kind.value = 'workout'; form.querySelector('#add-ex').hidden = false; }
      }
      if (e.target.name === 'title') applyDetection(form, '', e.target.value);
      if (e.target.name === 'amount') e.target.dataset.touched = '1';
    });
    $('#tab-quests').addEventListener('change', (e) => {
      const form = e.target.closest('#add-form');
      if (!form) return;
      if (e.target.name === 'repeat') syncRepeat(form);
      if (e.target.name === 'kind') { form.querySelector('#add-ex').hidden = e.target.value !== 'workout'; if (e.target.value === 'workout') applyDetection(form, '', form.title.value); }
      if (e.target.classList.contains('ex-select')) { e.target.dataset.touched = '1'; syncExerciseFields(form); }
    });
    $('#tab-quests').addEventListener('submit', (e) => {
      if (e.target.id !== 'add-form') return;
      e.preventDefault();
      const f = new FormData(e.target);
      const t = Game.addTask({ title: f.get('title'), effort: f.get('effort'), kind: f.get('kind'), repeat: f.get('repeat'), days: f.getAll('days'), ...readExercise(f) });
      if (t) { toast(`📜 New quest: ${t.title}`); addOpen = false; renderAll(); }
    });

    $('#tab-gear').addEventListener('click', (e) => {
      const eq = e.target.closest('[data-equip]');
      if (eq) { Sound.play('loot'); const ev = Game.equip(eq.dataset.equip); renderAll(); toast('🛡️ Equipped!'); handleEvents(ev); return; }
      const sl = e.target.closest('[data-sell]');
      if (sl) {
        const it = Game.state.inventory.find(i => i.id === sl.dataset.sell);
        if (it && confirm(`Sell ${it.name} for ${Game.sellPrice(it)} gold?`)) { Game.discard(it.id); Sound.play('coin'); renderAll(); toast(`🪙 Sold for ${Game.sellPrice(it)} gold`); }
        return;
      }
      const rf = e.target.closest('[data-reforge]');
      if (rf) {
        const it = Game.state.inventory.find(i => i.id === rf.dataset.reforge);
        if (!it || !confirm(`Reforge ${it.name} for ${Game.reforgePrice(it)} gold? Its effects${it.unique ? ' and unique power' : ''} will be re-rolled.`)) return;
        const res = Game.reforge(it.id);
        if (!res.ok) { Sound.play('error'); toast('Not enough gold to reforge.'); return; }
        Sound.play('chest');
        renderAll();
        lootModal({ burst: '🔨', title: 'Reforged!', intro: 'The blacksmith hammers new power into your gear:', item: res.item, autoEquip: true });
        handleEvents(res.events);
        return;
      }
      const pt = e.target.closest('[data-pet]');
      if (pt) { Game.setPet(pt.dataset.pet || null); Sound.play('click'); renderAll(); toast(pt.dataset.pet ? `🐾 ${PETS[pt.dataset.pet].name} is coming along!` : 'Your pet is resting at home'); return; }
      const lk = e.target.closest('[data-look]');
      if (lk) { Game.setLook({ [lk.dataset.look]: lk.dataset.val || null }); Sound.play('click'); renderAll(); }
    });

    $('#tab-shop').addEventListener('click', (e) => {
      const b = e.target.closest('[data-buy]');
      if (b) {
        const res = Game.buy(b.dataset.buy);
        if (!res.ok) { Sound.play('error'); toast(res.reason === 'max' ? 'You already have the maximum.' : 'Not enough gold yet.'); return; }
        Sound.play('buy');
        renderAll();
        if (res.item) lootModal({ burst: b.dataset.buy === 'epic' ? '💎' : '📦', title: 'Crate opened!', intro: 'You got:', item: res.item, autoEquip: res.autoEquip, sound: 'chest' });
        else toast(res.id === 'potion' ? '🧪 Health potion bought' : '🛡️ Streak shield bought');
        handleEvents(res.events);
        return;
      }
      if (e.target.closest('#potion-btn2')) drinkPotion();
    });

    $('#tab-hero').addEventListener('click', (e) => {
      const sk = e.target.closest('[data-skill]');
      if (sk && Game.spendSkill(sk.dataset.skill)) { Sound.play('loot'); renderAll(); toast(`🌳 ${SKILLS[sk.dataset.skill].label} upgraded!`); return; }
      if (e.target.closest('#reset-skills') && confirm('Reset all skill points? You can spend them again.')) { Game.resetSkills(); renderAll(); }
    });

    $('#tab-journey').addEventListener('click', async (e) => {
      const cal = e.target.closest('[data-cal]');
      if (cal) { calOffset = Math.max(0, calOffset + Number(cal.dataset.cal)); renderJourney(); return; }
      const db = e.target.closest('[data-diff]');
      if (db && db.dataset.diff !== Game.state.hero.difficulty) {
        const D = DIFFICULTIES[db.dataset.diff];
        if (confirm(`Switch to ${D.label}? Today's workouts will be regenerated for the new mode. Your level and gear stay.`)) { Game.setDifficulty(D.id); renderAll(); toast(`${D.icon} ${D.label} mode`); }
        return;
      }
      if (e.target.closest('#reasons-btn2')) { reasonsModal(); return; }
      if (e.target.closest('#add-reps')) { addRepsModal(); return; }
      const dy = e.target.closest('[data-day]');
      if (dy) { dayModal(dy.dataset.day); return; }
      if (e.target.closest('#review-btn')) { reviewModal(Game.weekReview(Game.lastWeekKey())); return; }
      if (e.target.closest('#copy-sql')) { try { await navigator.clipboard.writeText(CLOUD_SQL); toast('📋 SQL copied'); } catch { toast('Select the code and copy it'); } return; }
      if (e.target.closest('#cloud-sync')) { Cloud.sync('manual'); return; }
      if (e.target.closest('#cloud-logout')) { if (confirm('Log out of cloud sync on this device? Your progress stays here.')) { await Cloud.signOut(); renderCloudCard(); toast('Logged out of cloud sync'); } return; }
      if (e.target.closest('#cloud-reset')) { if (confirm('Remove the Supabase project details from this device?')) { Cloud.setConfig('', ''); await Cloud.signOut(); renderCloudCard(); } return; }
      if (e.target.closest('#copy-code')) { copyCode(); return; }
      if (e.target.closest('#paste-code')) { pasteCode(); return; }
      if (e.target.closest('#export-file')) { exportFile(); return; }
      if (e.target.closest('#import-file')) { $('#import-input').click(); return; }
      if (e.target.closest('#install-btn') && installPrompt) {
        installPrompt.prompt();
        try { await installPrompt.userChoice; } catch { /* ignore */ }
        installPrompt = null; renderJourney(); return;
      }
      if (e.target.closest('#reset-btn') && confirm('Start over? This deletes your hero, level and gear. Tip: download a backup first.')) {
        Game.reset(); $('#app').hidden = true; onboarding();
      }
    });
    $('#tab-journey').addEventListener('input', (e) => { if (e.target.id === 'vol') $('#vol-val').textContent = e.target.value + '%'; });
    $('#tab-journey').addEventListener('change', async (e) => {
      if (e.target.id === 'import-input' && e.target.files[0]) importFile(e.target.files[0]);
      if (e.target.id === 'rest-day') { Game.setSetting('restDay', e.target.value === '' ? null : Number(e.target.value)); toast(e.target.value === '' ? 'No rest day' : '😴 Rest day saved — starts from the next one'); }
      if (e.target.id === 'vol') { Sound.setPrefs({ volume: Number(e.target.value) / 100 }); Sound.play('coin'); }
      if (e.target.id === 'snd-sfx') { Sound.setPrefs({ sfx: e.target.checked }); Sound.play('click'); }
      if (e.target.id === 'snd-voice') { Sound.setPrefs({ voice: e.target.checked }); Sound.play('blip'); }
      if (e.target.id === 'jump-battle') { Game.setSetting('jumpToBattle', e.target.checked); toast(e.target.checked ? '🏟️ Jumping to the battle is on' : 'Jumping to the battle is off'); }
      if (e.target.id === 'taunt-mode') { Game.setSetting('taunts', e.target.value); if (e.target.value === 'off') Arena.hideBubble(); else greet(); toast(e.target.value === 'off' ? '🤐 Taunts off' : e.target.value === 'savage' ? '🔥 Savage taunts on. You asked for it.' : '💬 Taunts on'); }
      if (e.target.id === 'remind-time') Game.setSetting('reminderTime', e.target.value || '18:00');
      if (e.target.id === 'remind-on') {
        if (e.target.checked) {
          const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
          Game.setSetting('reminders', perm === 'granted');
          if (perm === 'granted') { toast('🔔 Reminder on'); notify('🔔 Reminders are on', `We'll nudge you at ${Game.state.settings.reminderTime} if the enemy is still standing.`); }
          else toast('Notifications were not allowed.');
          renderJourney();
        } else { Game.setSetting('reminders', false); toast('🔕 Reminder off'); }
      }
    });
    $('#tab-journey').addEventListener('submit', async (e) => {
      if (e.target.id === 'cloud-config-form') {
        e.preventDefault();
        const f = new FormData(e.target);
        if (!/^https:\/\/.+/.test(f.get('url')) || String(f.get('anonKey')).trim().length < 20) { Sound.play('error'); toast('Check the Project URL (starts with https://) and the key.'); return; }
        Cloud.setConfig(f.get('url'), f.get('anonKey'));
        await Cloud.init({ onConflict: cloudConflict, onApplied: cloudApplied });
        renderCloudCard(); toast('☁️ Saved! Now log in or create an account.');
        return;
      }
      if (e.target.id === 'cloud-login-form') {
        e.preventDefault();
        const f = new FormData(e.target), act = e.submitter && e.submitter.value;
        try {
          if (act === 'up') { const r = await Cloud.signUp(f.get('email'), f.get('password')); toast(r.confirm ? '📧 Check your email to confirm, then log in here.' : '☁️ Account created. Sync is on!'); }
          else { await Cloud.signIn(f.get('email'), f.get('password')); toast('☁️ Logged in. Sync is on!'); }
          Sound.play('buy');
        } catch (err) { Sound.play('error'); toast(`❌ ${err.message}`); }
        renderCloudCard();
        return;
      }
      if (e.target.id !== 'rename-form') return;
      e.preventDefault();
      Game.rename(new FormData(e.target).get('name'));
      renderAll(); toast('Name saved');
    });

    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; if (Game.state) renderJourney(); });

    const tick = () => { if (Game.state) { const rep = Game.ensureToday(); if (rep) { renderAll(); showReport(rep); } checkReminder(); } };
    setInterval(tick, 60 * 1000);
    let lastKey = Game.todayKey(), comboWas = false;
    setInterval(() => {
      const el = document.getElementById('day-countdown');
      if (el) el.textContent = countdownText();
      if (Game.state) {
        const cm = document.getElementById('combo-meter');
        const t = comboText();
        if (cm) { cm.textContent = t; cm.hidden = !t; }
        if (comboWas && !t) toast('⚡ Combo ended');
        document.querySelectorAll('[data-speed]').forEach(el => { el.textContent = speedText(+el.dataset.speed); });
        const mode = Game.state.settings.taunts || 'normal';
        const idleMs = (mode === 'savage' ? 5 : 10) * 60 * 1000, now = Date.now();
        if (mode !== 'off' && !document.hidden && !$('#modal-root').children.length && !Arena.isBusy() && !Game.state.day.rest && !Game.progress().met
          && now - lastActivity > idleMs && now - lastTauntAt > idleMs) speak(Game.stakes().knockout ? 'cocky' : 'idle');
        comboWas = !!t;
      }
      const key = Game.todayKey();
      if (key !== lastKey) { lastKey = key; tick(); }
    }, 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { tick(); if (Game.state && Date.now() - lastTauntAt > 30 * 60 * 1000) greet(); } });
  }

  function boot() {
    const report = Game.ensureToday();
    $('#app').hidden = false;
    renderAll();
    switchTab(currentTab);
    showReport(report);
    handleEvents(Game.checkAchievements());
    linkWorkoutsModal();
    checkReminder();
    lastActivity = Date.now();
    setTimeout(greet, 900);
    try {
      if (!localStorage.getItem(TOUR_KEY) && Game.state.stats.workouts + Game.state.stats.tasks > 0) {
        localStorage.setItem(TOUR_KEY, '1');
        setTimeout(() => toast('❓ New: tap the ? at the top for help or a tour of the app'), 2500);
      }
    } catch { /* ignore */ }
  }

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  Game.onSave(() => Cloud.scheduleUpload());
  Cloud.onChange((ci) => {
    const st = document.getElementById('cloud-status');
    if (st) st.innerHTML = cloudStatusText(ci); else if (document.getElementById('cloud-card')) renderCloudCard();
  });
  wire();
  if (Game.load()) boot(); else onboarding();
  Cloud.init({ onConflict: cloudConflict, onApplied: cloudApplied });
  // Check for changes from the other device when coming back to the app, and every 2 minutes while open.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) Cloud.sync('focus'); });
  setInterval(() => { if (!document.hidden) Cloud.sync('poll'); }, 2 * 60 * 1000);
})();
