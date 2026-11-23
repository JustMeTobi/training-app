/* QuestFit — pixel-style SVG art for the hero and enemies */
'use strict';

const Art = (() => {
  const METAL = { common: '#9aa3b2', rare: '#3b82f6', epic: '#a855f7', legendary: '#f5b301' };
  const DARK  = { common: '#6b7280', rare: '#1d4ed8', epic: '#7e22ce', legendary: '#b7791f' };
  const r = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;

  /* Material sets the base color of a piece; rarity sets its trim and gems. */
  const MAT = [
    ['#a87444', '#6b4423'], ['#b4875a', '#7c5532'], ['#cd8a3e', '#8a5622'], ['#9aa3b2', '#5f6878'], ['#d6dde6', '#8893a3'],
    ['#e5e7eb', '#a1a8b5'], ['#67e8f9', '#0e7490'], ['#4c3f6b', '#231a3a'], ['#efe6cf', '#b4a582'], ['#fff7d6', '#e0b84a'],
  ];
  const GEM = { common: '#cbd5e1', rare: '#3b82f6', epic: '#c026d3', legendary: '#f59e0b' };
  const mat = (it) => MAT[Math.max(0, Math.min(MAT.length - 1, it.tier || 0))];
  const baseName = (it) => it.base || SLOTS[it.slot].bases.find(b => it.name.split(' ').includes(b)) || SLOTS[it.slot].bases[0];
  function fxColor(it) {
    if (it.unique && UNIQUES[it.unique]) return UNIQUES[it.unique].color;
    const e = (it.effects || [])[0];
    return e ? EFFECTS[e.id].color : null;
  }
  /* Wrap a piece in its effect glow, plus sparkles for unique powers. */
  function fx(it, inner, sparkAt) {
    const c = fxColor(it);
    if (!c) return inner;
    let sp = '';
    if (it.unique && sparkAt) sparkAt.forEach(([x, y], i) => { sp += `<rect class="spark" x="${x}" y="${y}" width="2" height="2" fill="${c}" style="animation-delay:${i * 0.4}s"/>`; });
    return `<g class="fx ${it.unique ? 'fx-unique' : ''}" style="--fx:${c}">${inner}</g>${sp}`;
  }

  function drawWeapon(it) {
    const [c, d] = mat(it), gem = GEM[it.rarity], b = baseName(it);
    let s = '';
    if (b === 'Axe') {
      s += r(50, 14, 3, 42, '#6b4423') + `<path d="M53 15 L62 11 L63 29 L53 25 Z" fill="${c}"/><path d="M61 12 L63 12 L63 29 L61 28 Z" fill="#fff" opacity=".45"/><path d="M50 17 L45 20 L50 23 Z" fill="${d}"/>` + r(56, 18, 3, 3, gem);
    } else if (b === 'Hammer') {
      s += r(50, 20, 3, 36, '#6b4423') + r(42, 11, 19, 11, c) + r(42, 11, 19, 2, '#fff', 'opacity=".35"') + r(45, 11, 2, 11, d) + r(56, 11, 2, 11, d) + r(50, 14, 3, 4, gem);
    } else if (b === 'Blade') {
      s += `<path d="M50 48 Q46 30 55 10 L57 11 Q52 30 53 48 Z" fill="${c}"/><path d="M52 47 Q49 30 56 11 L57 11 Q52 30 53 47 Z" fill="#fff" opacity=".4"/>` + r(46, 47, 10, 3, d) + r(49, 50, 4, 6, '#3f2a17') + r(48, 56, 6, 2, gem);
    } else {
      s += r(49, 15, 4, 33, c) + r(50, 15, 2, 33, '#fff', 'opacity=".35"') + `<path d="M49 15 L51 11 L53 15 Z" fill="${c}"/>` + r(45, 47, 12, 3, d) + r(49, 50, 4, 6, '#5b3a1e') + r(48, 56, 6, 2, gem);
    }
    return `<g class="weapon">${fx(it, s, [[57, 14], [44, 24], [58, 34]])}</g>`;
  }

  function drawHelmet(it) {
    const [c, d] = mat(it), gem = GEM[it.rarity], b = baseName(it), glow = fxColor(it) || '#e0f2fe';
    let s = '';
    if (b === 'Hood') {
      s += r(21, 13, 22, 9, c) + r(21, 20, 4, 15, c) + r(39, 20, 4, 15, c) + r(24, 18, 16, 3, '#000', 'opacity=".3"') + `<path d="M28 13 L32 7 L36 13 Z" fill="${c}"/>` + r(21, 33, 22, 2, gem);
    } else if (b === 'Visor') {
      s += r(22, 12, 20, 10, c) + r(22, 21, 3, 10, c) + r(39, 21, 3, 10, c) + r(24, 21, 16, 10, d) + r(25, 25, 14, 2, glow) + r(31, 8, 2, 5, gem) + r(22, 12, 20, 2, '#fff', 'opacity=".3"');
    } else if (b === 'Crown') {
      s += `<path d="M23 17 L23 10 L27 14 L32 7 L37 14 L41 10 L41 17 Z" fill="${c}" stroke="${d}" stroke-width="1"/>` + r(31, 12, 2, 2, gem) + r(25, 14, 2, 2, gem) + r(37, 14, 2, 2, gem);
    } else {
      s += r(22, 13, 20, 9, c) + r(22, 21, 3, 9, c) + r(39, 21, 3, 9, c) + r(22, 21, 20, 2, d) + r(22, 13, 20, 2, '#fff', 'opacity=".3"');
      s += r(31, 8, 2, 6, gem);
      if (it.rarity === 'epic' || it.rarity === 'legendary') s += r(29, 5, 6, 4, gem);
    }
    return fx(it, s, [[20, 10], [43, 14], [32, 3]]);
  }

  function drawShield(it) {
    const [c, d] = mat(it), gem = GEM[it.rarity], b = baseName(it), em = fxColor(it) || d;
    let s = '';
    if (b === 'Buckler') {
      s += `<circle cx="15" cy="48" r="8" fill="${d}"/><circle cx="15" cy="48" r="6.5" fill="${c}"/><circle cx="15" cy="48" r="2.5" fill="${gem}"/>`;
    } else if (b === 'Aegis') {
      s += `<path d="M7 39 L23 39 L23 50 L15 59 L7 50 Z" fill="${d}"/><path d="M8.5 40.5 L21.5 40.5 L21.5 49.5 L15 57 L8.5 49.5 Z" fill="${c}"/><path d="M15 43 L18 47 L15 52 L12 47 Z" fill="${em}"/>`;
    } else if (b === 'Bulwark') {
      s += r(6, 35, 16, 24, d) + r(7, 36, 14, 22, c) + r(8, 37, 2, 2, d) + r(18, 37, 2, 2, d) + r(8, 55, 2, 2, d) + r(18, 55, 2, 2, d) + r(12, 42, 4, 10, em) + r(10, 45, 8, 3, em);
    } else {
      s += r(9, 40, 12, 16, d) + r(10, 41, 10, 14, c) + r(14, 43, 2, 10, em) + r(11, 47, 8, 2, em) + r(14, 47, 2, 2, gem);
    }
    return fx(it, s, [[5, 38], [22, 44], [12, 59]]);
  }

  function drawArmor(it, skin) {
    const [c, d] = mat(it), gem = GEM[it.rarity], b = baseName(it), em = fxColor(it) || gem;
    let s = '';
    if (b === 'Tunic') {
      s += r(22, 36, 20, 21, c) + `<path d="M29 36 L32 41 L35 36 Z" fill="${skin}"/>` + r(22, 50, 20, 2, gem) + r(17, 40, 5, 9, d) + r(42, 40, 5, 9, d);
    } else if (b === 'Mail') {
      s += r(22, 36, 20, 21, c);
      for (let y = 38; y < 52; y += 3) for (let x = 23 + ((y / 3) % 2); x < 41; x += 3) s += r(x, y, 1, 1, d);
      s += r(19, 35, 6, 5, d) + r(39, 35, 6, 5, d) + r(17, 40, 5, 11, d) + r(42, 40, 5, 11, d);
    } else if (b === 'Cuirass') {
      s += r(22, 36, 20, 21, c) + r(18, 34, 8, 7, d) + r(38, 34, 8, 7, d) + r(18, 34, 8, 2, gem) + r(38, 34, 8, 2, gem);
      s += `<circle cx="32" cy="44" r="4" fill="${d}"/><circle cx="32" cy="44" r="2.5" fill="${em}"/>` + r(17, 40, 5, 11, d) + r(42, 40, 5, 11, d);
    } else {
      s += r(22, 36, 20, 21, c) + r(19, 35, 7, 6, d) + r(38, 35, 7, 6, d) + r(27, 39, 10, 2, '#fff', 'opacity=".35"') + r(31, 41, 2, 10, d) + r(30, 46, 4, 3, em);
      s += r(17, 40, 5, 11, d) + r(42, 40, 5, 11, d);
    }
    s += r(22, 53, 20, 4, '#78350f') + r(30, 53, 4, 4, '#fbbf24');
    return fx(it, s, [[17, 36], [46, 38], [32, 58]]);
  }

  function drawBoots(it) {
    const [c, d] = mat(it), gem = GEM[it.rarity], b = baseName(it);
    let s = '';
    if (b === 'Greaves') s += r(24, 60, 7, 14, c) + r(33, 60, 7, 14, c) + r(24, 62, 7, 2, gem) + r(33, 62, 7, 2, gem) + r(23, 72, 8, 2, d) + r(33, 72, 8, 2, d);
    else if (b === 'Sabatons') s += r(23, 66, 8, 8, c) + r(33, 66, 8, 8, c) + r(20, 71, 4, 3, c) + r(40, 71, 4, 3, c) + r(23, 68, 8, 1, d) + r(33, 68, 8, 1, d) + r(25, 66, 2, 2, gem) + r(37, 66, 2, 2, gem);
    else if (b === 'Treads') s += r(23, 66, 8, 8, c) + r(33, 66, 8, 8, c) + r(23, 72, 8, 2, d) + r(33, 72, 8, 2, d) + r(23, 68, 8, 1, gem) + r(33, 68, 8, 1, gem);
    else s += r(23, 67, 8, 7, c) + r(33, 67, 8, 7, c) + r(23, 72, 8, 2, d) + r(33, 72, 8, 2, d) + r(23, 67, 8, 1, gem) + r(33, 67, 8, 1, gem);
    if ((it.effects || []).some(e => e.id === 'combo')) s += `<path d="M23 66 L17 62 L19 66 L16 66 L22 69 Z M41 66 L47 62 L45 66 L48 66 L42 69 Z" fill="#f8fafc" opacity=".9"/>`;
    return fx(it, s, [[19, 60], [44, 62], [32, 76]]);
  }

  function hair(style, color, crown) {
    const h = color;
    if (style === 'Spiky') return r(23, 15, 18, 5, h) + (crown ? '' : `<path d="M23 16 L25 9 L28 15 L31 8 L34 15 L37 9 L39 15 L41 11 L41 17 Z" fill="${h}"/>`) + r(23, 19, 2, 4, h) + r(39, 19, 2, 4, h);
    if (style === 'Mohawk') return (crown ? r(29, 14, 6, 6, h) : r(29, 8, 6, 12, h)) + r(24, 17, 16, 2, h, 'opacity=".5"');
    if (style === 'Long') return r(23, 14, 18, 7, h) + r(23, 19, 3, 10, h) + r(38, 19, 3, 10, h);
    if (style === 'Ponytail') return r(23, 15, 18, 6, h) + r(23, 19, 3, 4, h) + r(38, 19, 3, 4, h) + r(41, 17, 3, 4, h);
    if (style === 'Bald') return r(26, 18, 4, 2, '#ffffff', 'opacity=".3"');
    return r(23, 15, 18, 6, h) + r(23, 19, 3, 6, h) + r(38, 19, 3, 4, h);
  }

  function hero(state, level) {
    const eq = (slot) => Game.equippedItem(slot);
    const weapon = eq('weapon'), helmet = eq('helmet'), armor = eq('armor'), shield = eq('shield'), boots = eq('boots');
    const look = state.look || { hair: 0, hairColor: 0, skin: 0 };
    const skin = LOOKS.skins[look.skin] || LOOKS.skins[0];
    const hairC = LOOKS.hairColors[look.hairColor] || LOOKS.hairColors[0];
    const style = LOOKS.hairStyles[look.hair] || 'Short';
    const cape = look.cape ? LOOKS.capes.find(c => c.id === look.cape) : null;
    const crown = helmet && baseName(helmet) === 'Crown';
    const showHair = !helmet || crown;
    let s = '';

    if (level >= 6) {
      const c = level >= 30 ? '#f59e0b' : level >= 15 ? '#a855f7' : level >= 10 ? '#3b82f6' : '#22c55e';
      s += `<ellipse class="aura" cx="32" cy="44" rx="28" ry="34" fill="${c}" opacity=".18"/>`;
    }
    s += `<ellipse cx="32" cy="76" rx="16" ry="3" fill="#000" opacity=".35"/>`;
    if (cape) s += `<path class="cape" d="M21 36 L43 36 L47 70 L39 66 L32 71 L25 66 L17 70 Z" fill="${cape.color}"/><path d="M21 36 L43 36 L44 42 L20 42 Z" fill="#000" opacity=".2"/>`;
    if (showHair && style === 'Long') s += r(22, 18, 20, 20, hairC);
    if (showHair && style === 'Ponytail') s += r(40, 20, 4, 4, hairC) + r(41, 24, 4, 12, hairC);

    s += r(25, 56, 6, 12, '#334155') + r(33, 56, 6, 12, '#334155');
    s += boots ? drawBoots(boots) : r(23, 67, 8, 7, '#6b4423') + r(33, 67, 8, 7, '#6b4423') + r(23, 72, 8, 2, '#4a2f18') + r(33, 72, 8, 2, '#4a2f18');
    s += armor ? drawArmor(armor, skin) : r(22, 36, 20, 21, '#2563eb') + r(30, 36, 4, 6, '#1e40af') + r(17, 40, 5, 12, '#2563eb') + r(42, 40, 5, 12, '#2563eb') + r(22, 53, 20, 4, '#78350f') + r(30, 53, 4, 4, '#fbbf24');
    s += r(17, 51, 5, 4, skin) + r(42, 51, 5, 4, skin);

    s += r(24, 18, 16, 17, skin) + r(27, 25, 3, 3, '#1f2937') + r(34, 25, 3, 3, '#1f2937') + r(29, 31, 6, 1, '#b45309');
    if (showHair) s += hair(style, hairC, crown);
    if (helmet) s += drawHelmet(helmet);
    if (shield) s += drawShield(shield);
    if (weapon) s += drawWeapon(weapon);
    if (look.pet) s += pet(look.pet);
    return `<svg viewBox="-16 0 96 80" class="hero-svg" shape-rendering="crispEdges" role="img" aria-label="Your character">${s}</svg>`;
  }

  /* A single item on its own, cropped from the hero layout. */
  const ITEM_VIEW = { weapon: '23 6 50 50', helmet: '17 1 30 30', armor: '14 31 36 30', shield: '3 34 23 26', boots: '15 57 34 20' };
  function item(it) {
    let s = '';
    if (it.slot === 'weapon') s = drawWeapon(it);
    else if (it.slot === 'helmet') s = r(24, 18, 16, 17, '#475569', 'opacity=".5"') + drawHelmet(it);
    else if (it.slot === 'armor') s = drawArmor(it, '#94a3b8');
    else if (it.slot === 'shield') s = drawShield(it);
    else s = drawBoots(it);
    return `<svg viewBox="${ITEM_VIEW[it.slot]}" class="item-svg" shape-rendering="crispEdges" aria-hidden="true">${s}</svg>`;
  }

  /* Small companion drawn next to the hero (left side). */
  function pet(id) {
    let p = '<g class="pet">';
    if (id === 'dog') p += r(-13, 66, 12, 7, '#c08a4e') + r(-15, 62, 6, 6, '#c08a4e') + r(-16, 61, 2, 4, '#7a4f25') + r(-12, 63, 1, 1, '#111') + r(-12, 73, 2, 3, '#7a4f25') + r(-4, 73, 2, 3, '#7a4f25') + r(-1, 64, 2, 4, '#c08a4e');
    else if (id === 'cat') p += r(-13, 67, 11, 6, '#6b7280') + r(-15, 62, 7, 6, '#6b7280') + `<path d="M-15 62 L-15 59 L-13 62 Z M-10 62 L-8 59 L-8 62 Z" fill="#6b7280"/>` + r(-14, 64, 1, 1, '#facc15') + r(-11, 64, 1, 1, '#facc15') + r(-2, 61, 2, 8, '#6b7280');
    else if (id === 'slime') p += `<rect x="-14" y="64" width="14" height="11" rx="5" fill="#4ade80"/><circle cx="-10" cy="69" r="1.6" fill="#111"/><circle cx="-4" cy="69" r="1.6" fill="#111"/><rect x="-12" y="65" width="4" height="2" fill="#fff" opacity=".5"/>`;
    else if (id === 'owl') p += `<rect x="-13" y="58" width="11" height="14" rx="4" fill="#92400e"/><circle cx="-10" cy="63" r="2.4" fill="#fde68a"/><circle cx="-5" cy="63" r="2.4" fill="#fde68a"/><circle cx="-10" cy="63" r="1" fill="#111"/><circle cx="-5" cy="63" r="1" fill="#111"/><path d="M-8.5 65 L-6.5 65 L-7.5 67 Z" fill="#f59e0b"/>` + r(-9, 72, 1, 3, '#f59e0b') + r(-6, 72, 1, 3, '#f59e0b');
    else if (id === 'dragon') p += `<path d="M-16 60 L-12 64 L-16 66 Z M2 58 L-2 64 L2 66 Z" fill="#fb7185" opacity=".85"/><rect x="-13" y="60" width="12" height="13" rx="4" fill="#ef4444"/><path d="M-12 60 L-11 56 L-9 60 M-5 60 L-3 56 L-2 60" fill="#fde68a"/><circle cx="-10" cy="64" r="1.4" fill="#fde047"/><circle cx="-4" cy="64" r="1.4" fill="#fde047"/>` + r(-11, 73, 2, 3, '#b91c1c') + r(-5, 73, 2, 3, '#b91c1c');
    return p + '</g>';
  }

  function enemy(tier, { sleeping = false, boss = false } = {}) {
    const e = ENEMIES[tier] || ENEMIES[0];
    const c = e.color;
    let s = '';
    s += `<ellipse cx="40" cy="74" rx="22" ry="4" fill="#000" opacity=".35"/>`;
    if (e.wings) {
      s += `<path d="M14 34 L0 18 L4 40 L14 46 Z" fill="${c}" opacity=".75"/><path d="M66 34 L80 18 L76 40 L66 46 Z" fill="${c}" opacity=".75"/>`;
    }
    if (e.horns) s += `<path d="M24 22 L18 4 L32 18 Z" fill="#f5f5f4"/><path d="M56 22 L62 4 L48 18 Z" fill="#f5f5f4"/>`;
    if (e.ears) s += `<path d="M20 28 L14 10 L32 22 Z" fill="${c}"/><path d="M60 28 L66 10 L48 22 Z" fill="${c}"/>`;
    // body
    if (e.ghost) s += `<path d="M14 40 Q14 14 40 14 Q66 14 66 40 L66 70 L58 64 L50 70 L40 64 L30 70 L22 64 L14 70 Z" fill="${c}"/>`;
    else s += `<rect x="12" y="16" width="56" height="56" rx="22" fill="${c}"/>`;
    s += `<rect x="18" y="22" width="16" height="8" rx="4" fill="#fff" opacity=".25"/>`;
    if (e.spikes) s += `<path d="M22 70 L26 62 L30 70 M36 72 L40 63 L44 72 M50 70 L54 62 L58 70" fill="#1f2937" opacity=".45"/>`;
    // eyes
    const eyeC = e.glow || '#fff', pupil = e.dark ? '#ef4444' : '#111827';
    const xs = e.eyes === 1 ? [40] : e.eyes === 3 ? [27, 40, 53] : [30, 50];
    for (const x of xs) {
      if (sleeping) { s += `<path d="M${x - 5} 38 Q${x} 42 ${x + 5} 38" stroke="#111827" stroke-width="2.5" fill="none" stroke-linecap="round"/>`; continue; }
      if (e.dark) s += `<circle cx="${x}" cy="38" r="6" fill="#111827"/><circle cx="${x}" cy="38" r="2" fill="${pupil}"/>`;
      else s += `<circle cx="${x}" cy="38" r="6" fill="${eyeC}"/><circle cx="${x + 1}" cy="39" r="3" fill="${pupil}"/>`;
    }
    if (!sleeping) s += `<path d="M24 31 L35 34 M56 31 L45 34" stroke="#111827" stroke-width="2.5" stroke-linecap="round"/>`;
    // mouth
    s += `<path d="M28 54 Q40 ${e.teeth ? 62 : 58} 52 54" stroke="#111827" stroke-width="3" fill="${e.teeth ? '#111827' : 'none'}" stroke-linecap="round"/>`;
    if (e.teeth) s += `<path d="M32 55 L34 59 L36 56 M44 56 L46 59 L48 55" fill="#fff"/>`;
    if (sleeping) s += `<text x="60" y="16" font-size="12" font-weight="900" fill="#c7d2fe" font-family="sans-serif">z</text><text x="68" y="8" font-size="9" font-weight="900" fill="#c7d2fe" font-family="sans-serif">z</text>`;
    if (boss && !e.crown) s += `<path d="M26 16 L28 4 L34 11 L40 2 L46 11 L52 4 L54 16 Z" fill="#facc15" stroke="#b45309" stroke-width="1.5"/>`;
    if (boss) s += `<circle cx="40" cy="42" r="36" fill="none" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4 6" opacity=".6"/>`;
    if (e.crown) s += `<path d="M26 16 L28 4 L34 11 L40 2 L46 11 L52 4 L54 16 Z" fill="#facc15" stroke="#b45309" stroke-width="1.5"/>`;
    return `<svg viewBox="0 0 80 80" class="enemy-svg" role="img" aria-label="${e.name}">${s}</svg>`;
  }

  return { hero, enemy, item, METAL };
})();
