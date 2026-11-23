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
- ⭐ **Daily challenge:** a bonus quest each day.
- 🔄 **Swap:** reroll 1 workout per day.
- 😴 **Rest day:** pick a weekday. The enemy sleeps and one light activity keeps your streak.
- 📅 **Calendar, weekly chart and lifetime totals.**

**Practical**
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
js/ui.js        rendering and interaction
```
