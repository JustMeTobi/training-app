/* QuestFit — the enemy's voice: personality-based taunts that react to what you do. */
'use strict';

const Taunts = (() => {
  /* Which personality each enemy tier has (index = ENEMIES tier). */
  const PERSONALITY = ['silly', 'sneaky', 'sarcastic', 'sneaky', 'brute', 'brute', 'spooky', 'sarcastic', 'arrogant', 'dramatic', 'arrogant'];

  const LINES = {
    silly: {
      morning: ["Goood morning! I ate your breakfast. Blub.", "Rise and shine! Or don't. I'm a slime, I can wait."],
      day: ["Bloop! I'm still here. Are you?", "I've been jiggling all day. That counts as cardio, right?"],
      evening: ["Evening! Time for snacks, not squats. Blub!", "The sun's going down and so is your motivation. Hehe."],
      late: ["It's late! Go to bed and let me win. Blub.", "Sleepy? Me too. Let's both quit. Deal?"],
      hit: ["Ow! That squished me!", "Hey! I just got my goo the way I like it!", "Splat! Rude!"],
      crit: ["MY GOO! You split me in half!", "WAAAH! That was a big one!"],
      combo: ["Stop stop stop, I'm getting dizzy!", "Too fast! I'm wobbling!"],
      idle: ["Blub… blub… are you still there?", "I'm getting bored. Poke me with a push-up!", "Hellooo? Your quests are waiting. Blub."],
      nervous: ["I'm… I'm melting a little. Is that normal?", "Okay, maybe we can be friends?"],
      cocky: ["You look tired. Like, slime-tired.", "One more loss and I'll eat your gear. Nom."],
      beaten: ["*melts into a puddle* …blub.", "You win… I'm gonna go be a puddle now."],
      sleeping: ["Zzz… blub… zzz…", "*gentle jiggling snores*"],
    },
    sneaky: {
      morning: ["Psst. Skip the workout. Nobody's watching.", "Up already? I was going to steal your shoes."],
      day: ["I've been hiding behind your to-do list all day.", "You won't even notice when I take your streak."],
      evening: ["Getting dark… perfect time for me to strike.", "Shhh. Just lie on the couch. It's comfy."],
      late: ["Midnight's close. I can almost taste your HP.", "Tick tock. I'm sharpening my claws."],
      hit: ["Hey! I didn't see that coming!", "Ugh, cheap shot!", "Grrr. Lucky."],
      crit: ["Where did THAT come from?!", "Ow ow ow! Not the tail!"],
      combo: ["Wait, wait, I need to hide!", "You're too quick! No fair!"],
      idle: ["Still scrolling? I'm getting stronger…", "Your push-ups are waiting. I'm waiting too. Hehe.", "I'll just borrow your motivation while you're not using it."],
      nervous: ["Maybe I'll just… sneak away now…", "Let's call it a draw? No? Okay…"],
      cocky: ["Your gear looks shiny. It'll look better on me.", "One more loss and I'm taking something nice."],
      beaten: ["You got me… this time.", "I'll be back. Sneakier."],
      sleeping: ["Zzz… *one eye open* …zzz…", "Zzz… not sleeping… just… resting…"],
    },
    sarcastic: {
      morning: ["Oh look, you're awake. Wow. Inspiring.", "Morning. I'd say 'good', but I've seen your plans."],
      day: ["Still at zero? Bold strategy.", "Fascinating. Another day of 'I'll do it later'."],
      evening: ["Evening already? Time flies when you do nothing.", "Let me guess: you'll start tomorrow."],
      late: ["A few hours left. Totally enough time. Sure.", "Great plan, doing everything at the last minute."],
      hit: ["Ow. Congratulations, I guess.", "Wow, a whole exercise. Proud of you.", "Rattle. That tickled."],
      crit: ["Okay. THAT one actually hurt.", "I felt that in my bones. And I'm ALL bones."],
      combo: ["Slow down, you'll pull something.", "Who even are you right now?"],
      idle: ["Don't mind me, just watching you not work out.", "Your quests aren't going to complete themselves. Shocking, I know.", "Riveting. Truly."],
      nervous: ["Fine. You're… competent. Ugh.", "Okay, I may have underestimated you."],
      cocky: ["Your HP is looking a bit… thin.", "I'd hate to see you lose your gear. Kidding, I'd love it."],
      beaten: ["*falls apart* Typical.", "Well. That was embarrassing for me."],
      sleeping: ["Zzz… wake me when you do something… zzz…", "*sarcastic snoring*"],
    },
    brute: {
      morning: ["ME AWAKE. YOU WEAK.", "Morning! Me eat rocks for breakfast. You eat cereal. Ha."],
      day: ["YOU NO TRAIN? ME SMASH.", "Me lift boulders all day. You lift phone."],
      evening: ["Night coming. Me hit hard tonight.", "You tired? Me not tired. Me NEVER tired."],
      late: ["Soon midnight. Then SMASH TIME.", "Me count down. Me bad at counting. But SOON."],
      hit: ["OOF! You hit good!", "Grr! Me barely felt that!", "HNNG. Me angry now."],
      crit: ["OWWW! MY FACE!", "BIG HIT! Me respect. Also ow."],
      combo: ["TOO MANY HITS! ME CONFUSED!", "STOP! Me need break!"],
      idle: ["WHY YOU STOP? Me want fight!", "Hello?! Do squats! Me watching!", "You sit. Me grow stronger. Simple math."],
      nervous: ["Me… maybe go home soon.", "Okay okay! You strong! Me admit!"],
      cocky: ["You look squishy today. Me like.", "One more loss and me take your shiny things."],
      beaten: ["*thud* Me… nap now.", "You strong. Me go eat rocks and cry."],
      sleeping: ["ZZZ… SNORK… ZZZ…", "*snores so loud the ground shakes*"],
    },
    spooky: {
      morning: ["The morning light can't save you…", "I haunted your alarm. That's why you snoozed."],
      day: ["Your quests whisper to me… they're lonely…", "I feel your motivation fading… delicious…"],
      evening: ["The cold creeps closer as the sun sets…", "Brrr… can you feel my chill? That's your streak freezing."],
      late: ["The midnight hour approaches… and so do I…", "Soon… soon your HP will be mine…"],
      hit: ["You… touched me?! How?!", "Ooooh… that stung…", "The chill… it's breaking…"],
      crit: ["AAAAH! The warmth! It burns!", "Impossible! You struck my spirit!"],
      combo: ["Too much light! Too much energy!", "Stop moving so fast… I can't haunt you properly…"],
      idle: ["So quiet… so still… just how I like it…", "Your quests are getting cold… like me…", "Wooooo… do something…"],
      nervous: ["I'm… fading… this isn't fair…", "Perhaps… I'll haunt someone lazier…"],
      cocky: ["Your life force is so weak tonight…", "I'll take your gear to the afterlife…"],
      beaten: ["*fades into mist* …I'll return at dusk…", "Nooo… the light…"],
      sleeping: ["…zzz… *ghostly whispers* …zzz…", "Even ghosts need rest days… zzz…"],
    },
    arrogant: {
      morning: ["A mere mortal dares to wake up near me?", "I've already flown around the world twice today. You?"],
      day: ["Pathetic. I've seen dragonflies with more drive.", "Do you know who I am? Do your push-ups, peasant."],
      evening: ["The night belongs to dragons. And you're out of time.", "Your feeble efforts amuse me."],
      late: ["Hours left, and you haven't scratched my scales.", "I'll enjoy roasting your HP at midnight."],
      hit: ["A scratch. On MY scales?!", "Hmph. Beginner's luck.", "You dare?!"],
      crit: ["WHAT WAS THAT?! My magnificent scales!", "IMPOSSIBLE! No mortal hits that hard!"],
      combo: ["Enough! I command you to stop!", "How is a human this fast?!"],
      idle: ["I'm waiting. Dragons hate waiting.", "Are you… resting? In MY presence?", "My treasure grows while you sit there."],
      nervous: ["Perhaps I'll… allow you to win. Out of pity.", "This is not how dragon stories end!"],
      cocky: ["Your gear will look lovely in my hoard.", "One more loss, mortal. Then I feast on your loot."],
      beaten: ["*crashes down* …this never happened.", "Tell no one of this."],
      sleeping: ["Zzz… *smoke puffs* …zzz…", "*sleeps on a pile of gold*"],
    },
    dramatic: {
      morning: ["BEHOLD! The dawn of your DOOM!", "Another day! Another chance for me to TRIUMPH!"],
      day: ["The prophecy foretold you'd skip leg day!", "I sense… great laziness in you!"],
      evening: ["As darkness falls, my POWER RISES!", "The stars align… against your streak!"],
      late: ["THE HOUR IS NIGH! MIDNIGHT APPROACHES!", "Your fate is SEALED! …unless you do your quests."],
      hit: ["You DARE strike the Void Lich?!", "A minor setback in my GRAND PLAN!", "Ugh! My robes!"],
      crit: ["NOOOO! My phylactery! My dignity!", "This… this is a TRAGEDY!"],
      combo: ["The sheer AUDACITY of these combos!", "Cease this relentless ASSAULT!"],
      idle: ["The silence… it's DEAFENING!", "Your quests cry out for a HERO! Where is one?!", "I've had time to write three villain monologues."],
      nervous: ["Wait! Let me deliver my final speech first!", "This wasn't in the prophecy!"],
      cocky: ["Your life hangs by a THREAD!", "Soon your gear joins my ETERNAL COLLECTION!"],
      beaten: ["*dramatically collapses* Remember… me…", "Defeated… but my LEGEND lives on!"],
      sleeping: ["Zzz… *dramatic snoring* …zzz…", "Even villains need their beauty sleep… zzz…"],
    },
  };

  /* Personal lines use your real data. {placeholders} are filled in; lines with missing data are skipped. */
  const PERSONAL = [
    { need: 'forfeit', l: "Can't wait to watch you do {forfeit}." },
    { need: 'forfeit', l: '{forfeit}? Better start practicing for that.' },
    { need: 'streak', l: '{streak} days in a row? Cute. It ends today.' },
    { need: 'streak', l: 'That {streak}-day streak looks very breakable.' },
    { need: 'reward', l: 'No {reward} for you tonight.' },
    { need: 'reward', l: 'Imagine earning {reward}. Could never be you.' },
    { need: 'stat', l: '{stat} level {statLv}? I\'ve seen slimes with more.' },
    { need: 'left', l: '{left} quests left and you\'re just looking at me?' },
    { need: 'name', l: 'Hey {name}, the couch misses you. Go sit. I\'ll wait.' },
  ];
  const SAVAGE = {
    personal: [
      { need: 'forfeit', l: '{forfeit}. Tomorrow. I\'ll be watching every rep.' },
      { need: 'name', l: 'Your hero is embarrassed of you, {name}.' },
      { need: 'pet', l: 'Even your {pet} believes in me more than you.' },
      { need: 'why', l: '"{why}"? Doesn\'t look like it from here.' },
      { need: 'left', l: '{left} quests. You\'ll quit after one. Watch.' },
    ],
    idle: ['Wow. Still nothing. Honestly impressive.', 'Your future self is disappointed.', 'Every minute you wait, I get stronger. Thanks!'],
    hit: ['That\'s it? My grandma hits harder.', 'Was that a workout or a stretch?'],
    greet: ['Oh, it\'s you. The one who "starts tomorrow".', 'Ready to give up again today?'],
  };

  const recent = [];
  function choose(lines) {
    const fresh = lines.filter(l => !recent.includes(l));
    const l = (fresh.length ? fresh : lines)[Math.floor(Math.random() * (fresh.length || lines.length))];
    recent.push(l); if (recent.length > 14) recent.shift();
    return l;
  }
  function fill(line, ctx) { return line.replace(/\{(\w+)\}/g, (_, k) => ctx[k] ?? ''); }
  function personalLines(ctx, savage) {
    const pool = savage ? [...PERSONAL, ...SAVAGE.personal] : PERSONAL;
    return pool.filter(p => ctx[p.need] != null && ctx[p.need] !== '' && ctx[p.need] !== 0).map(p => fill(p.l, ctx));
  }

  /* situation: morning|day|evening|late|hit|crit|combo|idle|nervous|cocky|beaten|sleeping */
  function line(situation, ctx) {
    const mode = ctx.mode || 'normal';
    if (mode === 'off') return null;
    const savage = mode === 'savage';
    const set = LINES[PERSONALITY[ctx.tier] || 'silly'];
    const greet = ['morning', 'day', 'evening', 'late'].includes(situation);
    // Personal lines mix into greetings, idle pokes and cocky moments.
    if (greet || situation === 'idle' || situation === 'cocky') {
      const personal = personalLines(ctx, savage);
      if (personal.length && Math.random() < (savage ? 0.5 : 0.25)) return choose(personal);
      if (savage && Math.random() < 0.35) return choose(greet ? SAVAGE.greet : situation === 'idle' ? SAVAGE.idle : set[situation]);
    }
    if (savage && situation === 'hit' && Math.random() < 0.3) return choose(SAVAGE.hit);
    return fill(choose(set[situation] || set.day), ctx);
  }
  function greetSituation(hour) { return hour < 11 ? 'morning' : hour < 17 ? 'day' : hour < 21 ? 'evening' : 'late'; }
  const count = () => Object.values(LINES).reduce((n, p) => n + Object.values(p).reduce((a, l) => a + l.length, 0), 0) + PERSONAL.length + SAVAGE.personal.length + SAVAGE.idle.length + SAVAGE.hit.length + SAVAGE.greet.length;

  return { line, greetSituation, count };
})();
