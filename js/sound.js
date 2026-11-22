/* QuestFit — retro sound effects made with the Web Audio API (no audio files). */
'use strict';

const Sound = (() => {
  const KEY = 'questfit.muted';
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem(KEY) === '1'; } catch { /* storage unavailable */ }

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
    gain.gain.exponentialRampToValueAtTime(vol, start + 0.01);
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
    src.buffer = buf; gain.gain.value = vol;
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
  };

  function play(name) {
    if (muted || !sounds[name]) return;
    try { sounds[name](); } catch { /* audio unavailable */ }
  }
  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch { /* ignore */ }
  }

  return { play, setMuted, get muted() { return muted; } };
})();
