# ⚔️ QuestFit

A game-like web app for workouts and daily tasks. Finish quests to earn XP, level up your hero, beat the daily enemy and collect gear.

## Play

Open `index.html` in a browser. No install or build step. Progress is saved in your browser (localStorage).

To host it for free, use **GitHub Pages**: Settings → Pages → *Deploy from a branch* → pick your branch and `/ (root)`.

## How it works

- **Pick a mode:** 🌱 Beginner, ⚔️ Intermediate or 🔥 Hard. Harder modes have more quests, bigger reps, tougher enemies, more XP and better loot. You can switch modes in **Journey → Settings**.
- **Daily quests:** each day you get a set of workouts plus your own tasks. Tap a quest to complete it. Finished quests turn green with a ✓, get crossed out and move to **Completed today**. Tap *Undo* if you made a mistake.
- **Daily enemy:** you need to finish a set number of workouts and tasks each day. Every required quest damages the enemy. If you beat it, you get a bonus, a piece of loot, +1 streak and some HP back the next morning. If you don't, it hits you at midnight. At 0 HP you're knocked out (see below).
- **Real-life stakes:** set your own *reason* (shown next to the enemy every day), a *daily reward* you allow yourself when you win, a *big reward* for a winning streak, and a *forfeit* you owe if you get knocked out. The enemy card shows exactly what you win today and what you lose tonight.
- **Knockouts:** at 0 HP you lose half your progress toward the next level, the enemy steals one piece of your equipped gear, and your forfeit is added to the next day's quests.
- **Levels get harder:** the XP needed per level goes up, workout amounts grow every level, and the number of quests you have to do each day goes up at set levels. **Journey → Level road** shows what's coming.
- **Gear:** weapons, helmets, armor, shields and boots, in four rarities: Common, Rare, Epic and Legendary. Each piece adds bonus XP, and you can see it on your character.
- **Your own quests:** use *＋ Add quest* to add tasks or workouts, repeating every day or for today only. Use *✏️ Edit my quests* to delete them.

## Project layout

```
index.html      page shell
css/style.css   styles
js/data.js      difficulties, workouts, enemies, gear tables
js/game.js      game rules and saving (no DOM code)
js/art.js       pixel-style SVG hero and enemies
js/ui.js        rendering and interaction
```
