/* QuestFit — retro sound effects made with the Web Audio API (no audio files). */
'use strict';

const Sound = (() => {
  const KEY = 'questfit.muted';
  let ctx = null;
  const PREFS = 'questfit.soundPrefs';
  let muted = false;
  let prefs = { volume: 0.8, sfx: true, voice: true };
  try { muted = localStorage.getItem(KEY) === '1'; prefs = { ...prefs, ...JSON.parse(localStorage.getItem(PREFS) || '{}') }; } catch { /* storage unavailable */ }
  const level = () => Math.max(0.0001, prefs.volume);

  function ac() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // One short note. t = start offset in seconds.
  function tone(freq, t, dur, { type = 'square', vol = 0.12, slide = 0 } = {}) {
    const a = ac(); if (!a) return;
    const start = a.currentTime + t;
    const osc = a.createOscillator(), gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol * level()), start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  function noise(t, dur, vol = 0.15) {
    const a = ac(); if (!a) return;
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = a.createBufferSource(), gain = a.createGain(), filter = a.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 1800;
    src.buffer = buf; gain.gain.value = vol * level();
    src.connect(filter).connect(gain).connect(a.destination);
    src.start(a.currentTime + t);
  }

  const sounds = {
    // sword hit + coin chime
    complete() {
      noise(0, 0.08, 0.12);
      tone(220, 0, 0.08, { type: 'square', vol: 0.08, slide: -120 });
      tone(988, 0.06, 0.08, { vol: 0.09 });
      tone(1319, 0.13, 0.22, { vol: 0.09 });
    },
    undo() {
      tone(660, 0, 0.09, { type: 'triangle', vol: 0.12 });
      tone(440, 0.08, 0.14, { type: 'triangle', vol: 0.12, slide: -100 });
    },
    bonus() {
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.06, 0.12, { type: 'triangle', vol: 0.12 }));
    },
    victory() {
      noise(0, 0.25, 0.18);
      tone(110, 0, 0.35, { type: 'sawtooth', vol: 0.1, slide: -60 });
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3 + i * 0.12, 0.18, { vol: 0.1 }));
      tone(1047, 0.78, 0.5, { vol: 0.1 });
      tone(1319, 0.78, 0.5, { type: 'triangle', vol: 0.08 });
    },
    levelup() {
      const seq = [392, 523, 659, 784, 659, 784, 1047];
      seq.forEach((f, i) => tone(f, i * 0.09, 0.14, { vol: 0.1 }));
      tone(1047, 0.65, 0.6, { vol: 0.1 });
      tone(1568, 0.65, 0.6, { type: 'triangle', vol: 0.08 });
    },
    loot() {
      [1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.07, 0.2, { type: 'triangle', vol: 0.1 }));
    },
    hurt() {
      noise(0, 0.2, 0.2);
      tone(180, 0, 0.35, { type: 'sawtooth', vol: 0.12, slide: -120 });
    },
    click() { tone(880, 0, 0.04, { type: 'triangle', vol: 0.06 }); },
    crit() {
      noise(0, 0.18, 0.22);
      tone(160, 0, 0.2, { type: 'sawtooth', vol: 0.12, slide: -100 });
      [1319, 1760, 2093].forEach((f, i) => tone(f, 0.08 + i * 0.05, 0.14, { vol: 0.08 }));
    },
    coin() { tone(1319, 0, 0.06, { vol: 0.07 }); tone(1976, 0.05, 0.18, { vol: 0.07 }); },
    combo(n = 2) { tone(440 * Math.pow(1.12, Math.min(n, 8)), 0, 0.1, { type: 'triangle', vol: 0.09 }); },
    bossHit() { noise(0, 0.12, 0.14); tone(90, 0, 0.25, { type: 'sawtooth', vol: 0.11, slide: -40 }); },
    chest() {
      tone(200, 0, 0.12, { type: 'square', vol: 0.07, slide: 120 });
      [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, 0.15 + i * 0.06, 0.16, { type: 'triangle', vol: 0.1 }));
    },
    achievement() {
      [659, 880, 1109, 1319].forEach((f, i) => tone(f, i * 0.08, 0.16, { vol: 0.09 }));
      tone(1760, 0.34, 0.4, { type: 'triangle', vol: 0.09 });
    },
    buy() { tone(1047, 0, 0.06, { vol: 0.08 }); tone(1568, 0.06, 0.06, { vol: 0.08 }); tone(2093, 0.12, 0.2, { type: 'triangle', vol: 0.08 }); },
    potion() { for (let i = 0; i < 5; i++) tone(400 + i * 120, i * 0.05, 0.08, { type: 'sine', vol: 0.1, slide: 200 }); },
    swap() { tone(523, 0, 0.07, { type: 'triangle', vol: 0.09 }); tone(784, 0.07, 0.1, { type: 'triangle', vol: 0.09 }); },
    blip() { tone(520 + Math.random() * 240, 0, 0.035, { type: 'square', vol: 0.025 }); },
    whoosh() { noise(0, 0.14, 0.06); tone(300, 0, 0.12, { type: 'sine', vol: 0.03, slide: 400 }); },
    poof() { noise(0, 0.3, 0.14); tone(400, 0, 0.3, { type: 'triangle', vol: 0.06, slide: -320 }); },
    tick() { tone(1200, 0, 0.03, { type: 'square', vol: 0.04 }); },
    timerDone() { [0, 0.18, 0.36].forEach(t => tone(1568, t, 0.12, { vol: 0.1 })); tone(2093, 0.54, 0.35, { vol: 0.1 }); },
    error() { tone(200, 0, 0.12, { type: 'square', vol: 0.07 }); tone(150, 0.1, 0.16, { type: 'square', vol: 0.07 }); },
  };

  function play(name, arg) {
    if (muted || !sounds[name] || prefs.volume <= 0) return;
    if (name === 'blip' ? !prefs.voice : !prefs.sfx) return;
    try { sounds[name](arg); } catch { /* audio unavailable */ }
  }
  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* ignore */ }
  }

  function setPrefs(p) {
    prefs = { ...prefs, ...p };
    try { localStorage.setItem(PREFS, JSON.stringify(prefs)); } catch { /* ignore */ }
  }
  return { play, setMuted, setPrefs, get prefs() { return { ...prefs }; }, get muted() { return muted; } };
})();
