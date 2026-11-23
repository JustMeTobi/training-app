/* QuestFit — pixel-style SVG art for the hero and enemies */
'use strict';

const Art = (() => {
  const METAL = { common: '#9aa3b2', rare: '#3b82f6', epic: '#a855f7', legendary: '#f5b301' };
  const DARK  = { common: '#6b7280', rare: '#1d4ed8', epic: '#7e22ce', legendary: '#b7791f' };
  const r = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;

  function hero(state, level) {
    const eq = (slot) => Game.equippedItem(slot);
    const weapon = eq('weapon'), helmet = eq('helmet'), armor = eq('armor'), shield = eq('shield'), boots = eq('boots');
    const look = state.look || { hair: 0, hairColor: 0, skin: 0 };
    const skin = LOOKS.skins[look.skin] || LOOKS.skins[0];
    const hair = LOOKS.hairColors[look.hairColor] || LOOKS.hairColors[0];
    const style = LOOKS.hairStyles[look.hair] || 'Short';
    const cape = look.cape ? LOOKS.capes.find(c => c.id === look.cape) : null;
    let s = '';

    // aura grows with rank
    if (level >= 6) {
      const c = level >= 30 ? '#f59e0b' : level >= 15 ? '#a855f7' : level >= 10 ? '#3b82f6' : '#22c55e';
      s += `<ellipse class="aura" cx="32" cy="44" rx="28" ry="34" fill="${c}" opacity=".18"/>`;
    }
    s += `<ellipse cx="32" cy="76" rx="16" ry="3" fill="#000" opacity=".35"/>`;
    if (cape) s += `<path class="cape" d="M21 36 L43 36 L47 70 L39 66 L32 71 L25 66 L17 70 Z" fill="${cape.color}"/><path d="M21 36 L43 36 L44 42 L20 42 Z" fill="#000" opacity=".2"/>`;
    if (style === 'Long' && !helmet) s += r(22, 18, 20, 20, hair);
    if (style === 'Ponytail' && !helmet) s += r(40, 20, 4, 4, hair) + r(41, 24, 4, 12, hair);

    // legs + boots
    s += r(25, 56, 6, 12, '#334155') + r(33, 56, 6, 12, '#334155');
    const bootC = boots ? METAL[boots.rarity] : '#6b4423';
    const bootD = boots ? DARK[boots.rarity] : '#4a2f18';
    s += r(23, 67, 8, 7, bootC) + r(33, 67, 8, 7, bootC) + r(23, 72, 8, 2, bootD) + r(33, 72, 8, 2, bootD);

    // body / armor
    const bodyC = armor ? METAL[armor.rarity] : '#2563eb';
    const bodyD = armor ? DARK[armor.rarity] : '#1e40af';
    s += r(22, 36, 20, 21, bodyC) + r(22, 53, 20, 4, '#78350f') + r(30, 53, 4, 4, '#fbbf24');
    if (armor) {
      s += r(19, 35, 7, 6, bodyD) + r(38, 35, 7, 6, bodyD);       // shoulder pads
      s += r(27, 39, 10, 2, '#ffffff', 'opacity=".35"') + r(31, 41, 2, 10, bodyD);
    } else {
      s += r(30, 36, 4, 6, bodyD);
    }
    // arms
    s += r(17, 40, 5, 12, armor ? bodyD : '#2563eb') + r(42, 40, 5, 12, armor ? bodyD : '#2563eb');
    s += r(17, 51, 5, 4, skin) + r(42, 51, 5, 4, skin);

    // head
    s += r(24, 18, 16, 17, skin);
    s += r(27, 25, 3, 3, '#1f2937') + r(34, 25, 3, 3, '#1f2937');
    s += r(29, 31, 6, 1, '#b45309');
    if (helmet) {
      const hc = METAL[helmet.rarity], hd = DARK[helmet.rarity];
      s += r(22, 13, 20, 9, hc) + r(22, 21, 3, 9, hc) + r(39, 21, 3, 9, hc) + r(22, 21, 20, 2, hd);
      s += r(31, 9, 2, 5, helmet.rarity === 'legendary' ? '#ef4444' : hd);
      if (helmet.rarity === 'legendary' || helmet.rarity === 'epic') s += r(29, 6, 6, 4, helmet.rarity === 'legendary' ? '#ef4444' : '#f0abfc');
    } else if (style === 'Spiky') {
      s += r(23, 15, 18, 5, hair) + `<path d="M23 16 L25 9 L28 15 L31 8 L34 15 L37 9 L39 15 L41 11 L41 17 Z" fill="${hair}"/>` + r(23, 19, 2, 4, hair) + r(39, 19, 2, 4, hair);
    } else if (style === 'Mohawk') {
      s += r(29, 8, 6, 12, hair) + r(24, 17, 16, 2, hair, 'opacity=".5"');
    } else if (style === 'Long') {
      s += r(23, 14, 18, 7, hair) + r(23, 19, 3, 10, hair) + r(38, 19, 3, 10, hair);
    } else if (style === 'Ponytail') {
      s += r(23, 15, 18, 6, hair) + r(23, 19, 3, 4, hair) + r(38, 19, 3, 4, hair) + r(41, 17, 3, 4, hair);
    } else if (style === 'Bald') {
      s += r(26, 18, 4, 2, '#ffffff', 'opacity=".3"');
    } else {
      s += r(23, 15, 18, 6, hair) + r(23, 19, 3, 6, hair) + r(38, 19, 3, 4, hair);
    }

    // shield (hero's left / viewer's left)
    if (shield) {
      const c = METAL[shield.rarity], d = DARK[shield.rarity];
      s += r(9, 40, 12, 16, d) + r(10, 41, 10, 14, c) + r(14, 43, 2, 10, d) + r(11, 47, 8, 2, d);
    }
    // weapon (viewer's right)
    const g = weapon ? `class="weapon"` : '';
    if (weapon) {
      const c = METAL[weapon.rarity];
      const glow = weapon.rarity === 'legendary' || weapon.rarity === 'epic';
      s += `<g ${g}>`;
      if (glow) s += r(47, 13, 8, 36, c, 'opacity=".25"');
      s += r(49, 15, 4, 33, weapon.tier === 0 ? '#b07d4a' : c) + r(50, 15, 2, 33, '#ffffff', 'opacity=".35"');
      s += r(45, 47, 12, 3, '#78350f') + r(49, 50, 4, 6, '#5b3a1e') + r(48, 56, 6, 2, '#fbbf24');
      s += '</g>';
    }
    if (look.pet) s += pet(look.pet);
    return `<svg viewBox="-16 0 96 80" class="hero-svg" shape-rendering="crispEdges" role="img" aria-label="Your character">${s}</svg>`;
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

  return { hero, enemy, METAL };
})();
