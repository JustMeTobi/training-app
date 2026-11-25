/* QuestFit — the battle scene: hero vs. today's enemy, animated when you complete quests. */
'use strict';

const Arena = (() => {
  const RM = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wait = (ms) => new Promise(res => setTimeout(res, RM() ? 0 : ms));
  let el = null, heroEl, enemyEl, fxEl, bubbleEl, bgEl, fireEl;
  let sig = '', pendingState = null, busy = 0, chain = Promise.resolve();
  let typingTimer = null;

  /* Background theme by enemy tier: the further you get, the wilder the scenery. */
  const THEMES = ['meadow', 'meadow', 'forest', 'forest', 'cave', 'cave', 'frost', 'frost', 'volcano', 'volcano', 'volcano'];
  /* How each enemy type goes down. */
  const DEATH = ['melt', 'fall', 'crumble', 'fall', 'fall', 'crumble', 'fade', 'crumble', 'fall', 'fade', 'fall'];

  function particles(cls, n, area) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = Math.round(area.x + Math.random() * area.w), y = Math.round(area.y + Math.random() * area.h);
      s += `<circle class="${cls}" cx="${x}" cy="${y}" r="${(Math.random() * 1.2 + 0.6).toFixed(1)}" style="animation-delay:${(Math.random() * 6).toFixed(2)}s;animation-duration:${(3 + Math.random() * 4).toFixed(2)}s"/>`;
    }
    return s;
  }
  function background(theme) {
    let s = '';
    if (theme === 'meadow') {
      s += `<defs><linearGradient id="sky-m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b4a9a"/><stop offset="1" stop-color="#8aa4e8"/></linearGradient></defs>
        <rect width="300" height="120" fill="url(#sky-m)"/><circle cx="250" cy="24" r="12" fill="#fde68a" opacity=".9"/>
        <g class="bg-cloud"><ellipse cx="60" cy="22" rx="22" ry="6" fill="#fff" opacity=".45"/><ellipse cx="72" cy="18" rx="12" ry="6" fill="#fff" opacity=".45"/></g>
        <g class="bg-cloud slow"><ellipse cx="170" cy="34" rx="18" ry="5" fill="#fff" opacity=".35"/></g>
        <path d="M0 80 Q50 60 100 78 T200 74 T300 70 V120 H0Z" fill="#2f6f45"/><rect y="92" width="300" height="28" fill="#3f8f4f"/>
        ${Array.from({ length: 14 }, (_, i) => `<path d="M${10 + i * 21} 94 l2 -5 l2 5 M${16 + i * 21} 96 l1.5 -4 l1.5 4" stroke="#58b56a" stroke-width="1.2" fill="none"/>`).join('')}`;
    } else if (theme === 'forest') {
      s += `<defs><linearGradient id="sky-f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141c33"/><stop offset="1" stop-color="#2b3d5c"/></linearGradient></defs>
        <rect width="300" height="120" fill="url(#sky-f)"/><circle cx="60" cy="22" r="8" fill="#e2e8f0" opacity=".7"/>
        ${Array.from({ length: 12 }, (_, i) => { const x = i * 27 - 6, h = 40 + (i * 37 % 25); return `<path d="M${x} 94 L${x + 14} ${94 - h} L${x + 28} 94Z" fill="${i % 2 ? '#13301f' : '#183a26'}"/>`; }).join('')}
        <rect y="92" width="300" height="28" fill="#21402b"/>${particles('bg-firefly', 14, { x: 10, y: 30, w: 280, h: 55 })}`;
    } else if (theme === 'cave') {
      s += `<rect width="300" height="120" fill="#1f1b18"/><rect width="300" height="120" fill="url(#cg)" opacity=".5"/>
        <defs><radialGradient id="cg" cx=".5" cy=".7" r=".7"><stop offset="0" stop-color="#57534e"/><stop offset="1" stop-color="#0c0a09"/></radialGradient></defs>
        ${Array.from({ length: 13 }, (_, i) => `<path d="M${i * 24} 0 L${i * 24 + 8} ${14 + (i * 13 % 18)} L${i * 24 + 16} 0Z" fill="#3a3430"/>`).join('')}
        <path d="M30 94 l6 -14 l6 14Z M250 94 l5 -10 l5 10Z" fill="#7dd3fc" opacity=".55" class="bg-crystal"/>
        <rect y="92" width="300" height="28" fill="#3a3430"/>${particles('bg-drip', 6, { x: 10, y: 10, w: 280, h: 10 })}`;
    } else if (theme === 'frost') {
      s += `<defs><linearGradient id="sky-i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e3a5f"/><stop offset="1" stop-color="#6b9cc4"/></linearGradient></defs>
        <rect width="300" height="120" fill="url(#sky-i)"/>
        <rect x="40" y="40" width="12" height="54" fill="#c7d2fe" opacity=".35"/><rect x="36" y="36" width="20" height="6" fill="#c7d2fe" opacity=".35"/>
        <rect x="240" y="52" width="12" height="42" fill="#c7d2fe" opacity=".3"/><rect x="236" y="48" width="20" height="5" fill="#c7d2fe" opacity=".3"/>
        <path d="M0 94 Q80 84 150 92 T300 90 V120 H0Z" fill="#dbeafe"/><rect y="98" width="300" height="22" fill="#cbd5e1"/>${particles('bg-snow', 28, { x: 0, y: -10, w: 300, h: 40 })}`;
    } else {
      s += `<defs><linearGradient id="sky-v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a0a0a"/><stop offset="1" stop-color="#7c2d12"/></linearGradient></defs>
        <rect width="300" height="120" fill="url(#sky-v)"/>
        <path d="M150 94 L190 30 L205 30 L250 94Z" fill="#1c1917"/><path d="M190 30 L197 22 L205 30Z" fill="#f97316" class="bg-lava"/>
        <rect y="92" width="300" height="28" fill="#292524"/><path d="M20 104 L70 100 L90 108 M140 110 L200 104 M230 102 L285 108" stroke="#f97316" stroke-width="1.5" class="bg-lava"/>
        ${particles('bg-ember', 16, { x: 0, y: 70, w: 300, h: 30 })}`;
    }
    return `<svg viewBox="0 0 300 120" preserveAspectRatio="xMidYMax slice" class="arena-bg-svg" aria-hidden="true">${s}</svg>`;
  }
  const campfire = `<svg viewBox="0 0 30 30" class="campfire" aria-hidden="true"><rect x="5" y="24" width="20" height="3" rx="1.5" fill="#78350f"/><rect x="8" y="22" width="14" height="3" rx="1.5" fill="#92400e" transform="rotate(-12 15 23)"/>
    <path class="flame" d="M15 5 Q22 14 19 21 Q15 25 11 21 Q8 14 15 5Z" fill="#f97316"/><path class="flame f2" d="M15 11 Q19 16 17.5 20 Q15 22 12.5 20 Q11 16 15 11Z" fill="#fde047"/></svg>`;

  function mount() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'arena';
    el.id = 'arena';
    el.innerHTML = `<div class="arena-bg"></div><div class="arena-fire" hidden>${campfire}</div>
      <div class="arena-hero"></div><div class="arena-enemy enemy-art" id="enemy-art"></div>
      <div class="arena-fx" aria-hidden="true"></div>
      <div class="arena-bubble" role="status" aria-live="polite" hidden><span></span></div>`;
    bgEl = el.querySelector('.arena-bg'); heroEl = el.querySelector('.arena-hero'); enemyEl = el.querySelector('.arena-enemy');
    fxEl = el.querySelector('.arena-fx'); bubbleEl = el.querySelector('.arena-bubble'); fireEl = el.querySelector('.arena-fire');
    return el;
  }

  function heroSig(s, level) {
    const eq = Object.values(s.equipped).join(',');
    return `${eq}|${JSON.stringify(s.look)}|${level >= 30 ? 4 : level >= 15 ? 3 : level >= 10 ? 2 : level >= 6 ? 1 : 0}`;
  }
  /* Re-draw the scene only when something visible changed, and never in the middle of an animation. */
  function update(s) {
    mount();
    if (busy) { pendingState = s; return; }
    const d = s.day, p = Game.progress(), level = Game.levelInfo(s.hero.totalXP).level;
    const down = p.met && !d.rest;
    const next = `${d.enemy.tier}|${d.rest}|${down}|${heroSig(s, level)}`;
    if (next === sig) return;
    const themeChanged = sig.split('|')[0] !== String(d.enemy.tier) || !sig;
    sig = next;
    if (themeChanged) { bgEl.innerHTML = background(THEMES[d.enemy.tier] || 'meadow'); el.dataset.theme = THEMES[d.enemy.tier]; }
    heroEl.innerHTML = Art.hero(s, level);
    heroEl.className = `arena-hero ${d.rest ? 'resting' : ''} ${down ? 'proud' : ''}`;
    fireEl.hidden = !d.rest;
    enemyEl.innerHTML = Art.enemy(d.enemy.tier, { sleeping: d.rest });
    enemyEl.className = `arena-enemy enemy-art ${down ? 'down down-' + (DEATH[d.enemy.tier] || 'fall') : ''}`;
  }

  function queue(fn) {
    busy++;
    chain = chain.then(fn).catch(() => {}).then(() => {
      busy--;
      if (!busy && pendingState) { const s = pendingState; pendingState = null; update(s); }
    });
    return chain;
  }
  const whenIdle = () => chain;
  const isBusy = () => busy > 0;

  function cls(node, c, ms) { node.classList.remove(c); void node.offsetWidth; node.classList.add(c); if (ms) setTimeout(() => node.classList.remove(c), ms); }
  function spawn(className, style = {}, html = '', ms = 900) {
    const n = document.createElement('div');
    n.className = className;
    Object.entries(style).forEach(([k, v]) => n.style.setProperty(k, v));
    n.innerHTML = html;
    fxEl.appendChild(n);
    setTimeout(() => n.remove(), ms);
    return n;
  }
  function weaponInfo() {
    const w = Game.equippedItem('weapon');
    if (!w) return { base: 'none', color: '#e2e8f0' };
    const base = (w.base || SLOTS.weapon.bases.find(b => w.name.includes(b)) || 'Sword').toLowerCase();
    const color = w.unique ? UNIQUES[w.unique].color : (w.effects && w.effects[0]) ? EFFECTS[w.effects[0].id].color : '#e2e8f0';
    return { base, color };
  }

  /* One quest = one attack: run in, strike with the equipped weapon, enemy reels, run back. */
  function attack({ damage = 100, crit = false, combo = 1 }) {
    return queue(async () => {
      if (!el || !el.isConnected) return;
      const { base, color } = weaponInfo();
      el.style.setProperty('--run', `${Math.round(el.clientWidth * 0.33)}px`);
      heroEl.classList.toggle('glow', combo >= 3);
      Sound.play('whoosh');
      heroEl.classList.add('run');
      await wait(300);
      cls(heroEl, `strike-${base}`, 420);
      await wait(130);
      if (base === 'hammer') spawn('fx-shock', { '--c': color }, '', 700);
      else if (base === 'blade') { spawn('fx-slash', { '--c': color }, '', 500); setTimeout(() => spawn('fx-slash second', { '--c': color }, '', 500), 120); }
      else if (base === 'axe') spawn('fx-slash chop', { '--c': color }, '', 500);
      else if (base === 'none') spawn('fx-punch', { '--c': color }, '', 400);
      else spawn('fx-slash', { '--c': color }, '', 500);
      if (combo >= 5) spawn('fx-bolt', {}, '⚡', 600);
      cls(enemyEl, crit ? 'hit-crit' : 'hit', 600);
      if (crit) { cls(el, 'crit-zoom', 700); document.body.classList.remove('shake'); void document.body.offsetWidth; document.body.classList.add('shake'); }
      spawn(`arena-dmg ${crit ? 'crit' : ''}`, {}, `${crit ? 'CRIT! ' : ''}-${damage}`, 1100);
      await wait(crit ? 420 : 260);
      heroEl.classList.remove('run');
      await wait(320);
    });
  }

  /* The enemy goes down its own way, drops coins + loot, and the hero celebrates. */
  function defeat(tier, rest) {
    return queue(async () => {
      if (!el || !el.isConnected || rest) return;
      const how = DEATH[tier] || 'fall';
      enemyEl.classList.add(`die-${how}`);
      Sound.play('poof');
      for (let i = 0; i < 9; i++) spawn('arena-coin', { '--dx': `${Math.round((Math.random() - 0.5) * 120)}px`, '--dy': `${-30 - Math.round(Math.random() * 40)}px`, 'animation-delay': `${i * 40}ms` }, '🪙', 1300);
      await wait(700);
      heroEl.classList.add('victory');
      Sound.play('coin');
      await wait(800);
      heroEl.classList.remove('victory');
      enemyEl.classList.remove(`die-${how}`);
      sig = '';               // let update() draw the resting "down" pose
    });
  }

  /* A wandering monster from a Quick Quest runs in and gets bonked. */
  function monster(tier) {
    return queue(async () => {
      if (!el || !el.isConnected) return;
      const m = spawn('arena-monster', {}, Art.enemy(tier), 1600);
      await wait(450);
      cls(heroEl, 'strike-none', 400);
      spawn('fx-punch', { '--c': '#fde047' }, '', 400);
      m.classList.add('bonk');
      Sound.play('bossHit');
      await wait(700);
    });
  }

  /* Speech bubble that types out letter by letter with a soft blip. */
  function say(text) {
    mount();
    clearInterval(typingTimer);
    if (!text) { bubbleEl.hidden = true; return; }
    const span = bubbleEl.querySelector('span');
    bubbleEl.hidden = false;
    cls(bubbleEl, 'pop');
    enemyEl.classList.add('talking');
    if (RM()) { span.textContent = text; enemyEl.classList.remove('talking'); return; }
    let i = 0;
    span.textContent = '';
    typingTimer = setInterval(() => {
      i++;
      span.textContent = text.slice(0, i);
      if (i % 3 === 1 && text[i - 1] !== ' ') Sound.play('blip');
      if (i >= text.length) { clearInterval(typingTimer); enemyEl.classList.remove('talking'); }
    }, 28);
  }
  function hideBubble() { clearInterval(typingTimer); if (bubbleEl) bubbleEl.hidden = true; }

  return { mount, update, attack, defeat, monster, say, hideBubble, whenIdle, isBusy };
})();
