# ⚔️ QuestFit

A game-like web app for workouts and daily tasks. Finish quests to earn XP and gold, level up your hero, beat enemies and bosses, collect gear and unlock achievements.

## Play

Open `index.html` in a browser, or host it free on **GitHub Pages** (Settings → Pages → *Deploy from a branch* → `main`, `/ (root)`). Progress is saved in your browser.

**Install it like an app:** on the GitHub Pages version, use *Add to Home Screen* (iPhone: Safari → Share) or *Install app* (Android Chrome). The installed app works offline.

## Features

**Core**
- Three modes: 🌱 Beginner, ⚔️ Intermediate and 🔥 Hard. The number of daily quests and the workout sizes grow as you level.
- A daily enemy you beat by finishing your required workouts and tasks. If it isn't beaten by midnight it hits back, and at 0 HP you're knocked out: you lose XP, a piece of gear, and owe your real-life forfeit.
- Real-life motivation: your reason, a daily reward, a big streak reward and a forfeit.

**Combat**
- 🏟️ **Battle scene:** your hero and today's enemy face off in an animated arena. Every quest you finish makes your hero run in and strike with the equipped weapon (sword slash, axe chop, hammer shockwave, double blade cut). Crits zoom and shake, combos glow, and each enemy type goes down its own way (melts, falls, crumbles, fades) with a coin shower. The background changes as you reach tougher enemies: meadow, forest, cave, frozen ruins, volcano. On rest days the enemy sleeps and your hero rests by a campfire.
- 💬 **Taunting enemies:** 200+ lines across 7 personalities (silly slimes, sneaky goblins, sarcastic skeletons, brutish orcs, spooky wraiths, arrogant dragons, a dramatic lich). They greet you by time of day, react to every hit, poke you when you've been idle, and get personal with your streak, reward and forfeit. Set them to Off, Normal or 🔥 Savage in Journey → Settings.
- 👑 **Weekly boss:** every quest you do during the week damages it. Beat it by Sunday midnight for Epic+ gear and gold.
- 💥 **Critical hits:** a chance for double XP and gold.
- ⚡ **Combos:** quests done within 15 minutes of each other stack an XP multiplier (up to +50%).
- 💬 **Enemy taunts** that change as the fight goes on.
- 📖 **Bestiary** of every monster type you've beaten.

**Rewards**
- 🪙 **Gold and shop:** health potions, streak shields, gear crates and epic crates. Sell spare gear for gold.
- 🎁 **Daily chest:** gold, potions, a shield or gear.
- ✨ **Gear effects:** Rare gear has 1 effect, Epic 2, and Legendary 2 plus a **unique power**. Effects: Power (boss damage), Precision (crit), Fortune (gold), Vitality (HP), Armor, Luck, Regen and Swiftness (combo time). Unique powers: Executioner, Phoenix, Midas, Second Wind, Time Lord and Vampiric. Every gear type (sword, axe, hammer, blade, hood, crown, buckler, aegis…) looks different on your hero, glows in its effect's color and is colored by its material. 🔨 Reforge re-rolls an item's effects for gold.
- 🧩 **Gear sets:** 3 matching pieces give +4% XP, 5 give +12%.
- 🎨 **Appearance:** hair styles and colors, skin tones, plus capes and pets you unlock.

**Progress**
- 🏅 **35 achievements.**
- 🌳 **Skill tree:** 1 point every 5 levels in Warrior, Scholar, Tank or Lucky.
- 📊 **Hero stats:** Strength, Endurance and Discipline grow from what you actually do.

**Daily variety**
- 🎲 **Quick Quests:** bored and have a few minutes? Roll a random 2, 5 or 15-minute workout or task (about 70 ideas, scaled to your level). Finish it in time for a ⚡ +25% speed bonus; 15% of them bring a 👾 wandering monster that drops gold or gear. They're bonus quests: they don't count toward the daily goal, and the first 5 each day give full rewards (50% after that).
- ⭐ **Daily challenge:** a bonus quest each day.
- 🔄 **Swap:** reroll 1 workout per day.
- 😴 **Rest day:** pick a weekday. The enemy sleeps and one light activity keeps your streak.
- 📅 **Calendar, weekly chart and lifetime totals.**

**Habits**
- 📅 **Weekday quests:** your own quests can repeat every day, on certain weekdays (e.g. Gym on Mon/Wed/Fri) or today only.
- 🔥 **Streaks per habit** with a 30-day success rate, and **habit levels** (🥉 7, 🥈 30, 🥇 100, 💎 365 completions). See Journey → My habits.
- 📝 **Notes** on finished quests; tap a day in the calendar to see what you did and your notes.
- 📊 **Weekly review** every Monday: wins, quests, top exercises, perfect habits, and tips for habits that slipped.
- 💪 **Progressive overload:** after doing a workout 10 times at the same amount, the app suggests a little more (you decide).

**Pets**
- 🐾 Pets hatch from **eggs** you earn (3-day streak, 7-day streak, 50 tasks, a wandering monster, 3 weekly bosses) or buy as a mystery egg. An egg hatches after 10 quests.
- Pets **grow to level 10** as you complete quests with them, giving a bonus that grows each level (gold, healing, crit, task XP or boss damage), and get bigger at levels 5 and 10.

**Practical**
- ☁️ **Cloud sync** between phone and computer with a free Supabase database. See [SUPABASE_SETUP.md](SUPABASE_SETUP.md).
- ❓ **Help and tour:** a first-time tour, plus help for every feature behind the ❓ button.
- 🔊 **Volume slider** and separate switches for sound effects and the enemy's talking blips.
- 📲 Installable app that works offline.
- 🔔 Daily reminder notification if the enemy isn't beaten by a time you choose.
- 🔄 **Backup and sync** between devices with a sync code or a backup file (Journey → Backup & sync).
- ⏱️ Built-in timer for timed workouts that completes the quest automatically.

## Project layout

```
index.html      page shell
manifest.json   app install info
sw.js           offline support (service worker)
icons/          app icons
css/style.css   styles
js/data.js      difficulties, workouts, enemies, gear, shop, achievements, cosmetics
js/game.js      game rules and saving (no DOM code)
js/art.js       pixel-style SVG hero, pets and enemies
js/sound.js     retro sound effects (Web Audio, no files)
js/taunts.js    enemy taunt lines and personalities
js/arena.js     animated battle scene
js/cloud.js     cloud sync (Supabase)
js/cloud-config.js  optional Supabase URL + anon key for all devices
js/ui.js        rendering and interaction
```
