/*
 * Math Realm: sound effects, background music and confetti, shared by every game.
 *
 *   RealmFX.correct()  RealmFX.wrong()  RealmFX.fanfare()  RealmFX.confetti()
 *   RealmFX.soundOn / RealmFX.toggleSound()        sound effects start OFF
 *   RealmMusic.on   / RealmMusic.toggle()          music starts ON (after the first click)
 *   RealmMusic.setTheme('race')                    pick the music for a page: 'calm' (default) or 'race'
 *   RealmFX.gallop(ms)                             hoofbeats while a unicorn runs
 *
 * The music is original and made in the browser: a slow, dreamy chord loop
 * with a soft music-box melody and the odd sparkle. Nothing is downloaded.
 * Each computer remembers a student's music and sound choices.
 */
(function () {
  'use strict';

  let ctx = null;
  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function pref(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : v === 'on'; } catch (e) { return fallback; }
  }
  function savePref(key, on) {
    try { localStorage.setItem(key, on ? 'on' : 'off'); } catch (e) { /* fine */ }
  }
  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  const hz = midi => 440 * Math.pow(2, (midi - 69) / 12);

  let noiseBuf = null;
  function noiseBuffer(a) {
    if (noiseBuf && noiseBuf.sampleRate === a.sampleRate) return noiseBuf;
    const b = a.createBuffer(1, a.sampleRate, a.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = b;
    return b;
  }

  /* ── Sound effects ── */

  let soundOn = pref('mathRealm.sound', false);

  function note(freq, at, dur, type, vol) {
    const a = audio();
    if (!a) return;
    const t = a.currentTime + at;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol || 0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  window.RealmFX = {
    get soundOn() { return soundOn; },
    toggleSound() {
      soundOn = !soundOn;
      savePref('mathRealm.sound', soundOn);
      if (soundOn) this.correct();
      return soundOn;
    },
    correct() {
      if (!soundOn) return;
      note(1046.5, 0, 0.18, 'triangle');
      note(1318.5, 0.07, 0.22, 'triangle');
    },
    wrong() {
      if (!soundOn) return;
      note(311, 0, 0.22, 'sine', 0.08);
      note(262, 0.12, 0.3, 'sine', 0.08);
    },
    gallop(ms) {
      if (!soundOn) return;
      const a = audio();
      if (!a) return;
      const noise = noiseBuffer(a);
      const beats = Math.max(1, Math.round(ms / 360));
      for (let i = 0; i < beats; i++) {
        [0, 0.085, 0.17].forEach((off, k) => {   // da-da-dum, like hooves
          const t = a.currentTime + i * 0.36 + off;
          const src = a.createBufferSource();
          src.buffer = noise;
          const bp = a.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.value = k === 2 ? 900 : 1300;
          bp.Q.value = 6;
          const g = a.createGain();
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(k === 2 ? 0.5 : 0.32, t + 0.004);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
          src.connect(bp).connect(g).connect(a.destination);
          src.start(t, Math.random() * 0.5, 0.1);
        });
      }
    },
    fanfare() {
      if (!soundOn) return;
      [523.3, 659.3, 784, 1046.5].forEach((f, i) => note(f, i * 0.11, 0.35, 'triangle', 0.1));
      note(1318.5, 0.5, 0.6, 'triangle', 0.1);
    },
    confetti() {
      if (reducedMotion()) return;
      const colors = ['#FF7EB6', '#7CC8FF', '#FFD84D', '#4FD1AB', '#C9A8FF', '#FFFFFF'];
      const layer = document.createElement('div');
      layer.setAttribute('aria-hidden', 'true');
      layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:50';
      for (let i = 0; i < 70; i++) {
        const p = document.createElement('i');
        const size = 6 + Math.random() * 8;
        const drift = (Math.random() - 0.5) * 30;
        p.style.cssText = 'position:absolute;top:-20px;left:' + (Math.random() * 100) + 'vw;width:' + size + 'px;height:' + (size * 0.6) + 'px;' +
          'background:' + colors[i % colors.length] + ';border-radius:2px;opacity:.95';
        p.animate(
          [{ transform: 'translate(0,0) rotate(0deg)' }, { transform: 'translate(' + drift + 'vw,105vh) rotate(' + (360 + Math.random() * 540) + 'deg)' }],
          { duration: 1600 + Math.random() * 1400, delay: Math.random() * 400, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' }
        );
        layer.appendChild(p);
      }
      document.body.appendChild(layer);
      setTimeout(() => layer.remove(), 3600);
    },
  };

  /* ── Background music ── */

  // Music themes. Chords are MIDI notes; patterns pick chord tones over one bar of
  // 8 eighth notes (3-5 are an octave up, null is a rest).
  const THEMES = {
    // Fact Garden and Rectangle Kingdom: slow, dreamy, music-box
    calm: {
      bpm: 72, restChance: 0.25, sparkleRate: 0.08, padVol: 0.05, arpVol: 0.03, bassVol: 0.07, drums: false,
      // D major, two 4-bar phrases: D A Bm G | Bm G D A
      chords: [[62, 66, 69], [57, 61, 64], [59, 62, 66], [55, 59, 62], [59, 62, 66], [55, 59, 62], [62, 66, 69], [57, 61, 64]],
      patterns: [[0, 1, 2, 4, 2, 1, null, null], [0, null, 2, null, 3, null, 2, 1], [2, 1, 0, null, 1, 2, 4, null], [null, 0, 1, 2, null, 2, 1, null], [0, 2, 4, 5, 4, 2, null, null]],
      sparkle: [86, 88, 90, 93, 95, 98],
    },
    // Unicorn Racetrack: a bit quicker and more magical. D Lydian (the E major chord,
    // with its G sharp, gives the "enchanted" sound), a running harp, a soft heartbeat.
    race: {
      bpm: 100, restChance: 0, sparkleRate: 0.14, padVol: 0.032, arpVol: 0.026, bassVol: 0.06, drums: true,
      chords: [[62, 66, 69], [64, 68, 71], [59, 62, 66], [57, 61, 64], [55, 59, 62], [64, 68, 71], [62, 66, 69], [57, 61, 64]],
      patterns: [[0, 1, 2, 4, 3, 4, 2, 1], [0, 2, 4, 5, 4, 2, 1, 2], [2, 1, 0, 1, 2, 4, 5, 4], [0, 1, 2, 3, 4, 3, 2, 1]],
      sparkle: [86, 88, 90, 92, 93, 95],
    },
  };
  let theme = THEMES.calm;
  const stepLen = () => 60 / theme.bpm / 2;   // eighth notes

  let musicOn = pref('mathRealm.music', true);
  let playing = false, timer = null, nextAt = 0, step = 0, pattern = null;
  let bus = null;

  function buildBus(a) {
    const master = a.createGain();
    master.gain.value = 0.0001;
    const tone = a.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2400;
    const verb = a.createConvolver();
    const len = a.sampleRate * 3;
    const ir = a.createBuffer(2, len, a.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    verb.buffer = ir;
    const wet = a.createGain();
    wet.gain.value = 0.45;
    tone.connect(master);
    tone.connect(verb).connect(wet).connect(master);
    master.connect(a.destination);
    return { master: master, input: tone };
  }

  function voice(a, freq, at, dur, opts) {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = opts.type;
    osc.frequency.setValueAtTime(freq, at);
    if (opts.detune) osc.detune.setValueAtTime(opts.detune, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(opts.vol, at + opts.attack);
    if (opts.hold) g.gain.setValueAtTime(opts.vol, at + opts.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(bus.input);
    osc.start(at);
    osc.stop(at + dur + 0.1);
  }

  function kick(a, at) {
    const osc = a.createOscillator(), g = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, at);
    osc.frequency.exponentialRampToValueAtTime(45, at + 0.12);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.11, at + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    osc.connect(g).connect(bus.input);
    osc.start(at);
    osc.stop(at + 0.3);
  }
  function shaker(a, at, vol) {
    const src = a.createBufferSource(), hp = a.createBiquadFilter(), g = a.createGain();
    src.buffer = noiseBuffer(a);
    hp.type = 'highpass';
    hp.frequency.value = 6500;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
    src.connect(hp).connect(g).connect(bus.input);
    src.start(at, Math.random() * 0.5, 0.08);
  }

  function schedule(a, s, at) {
    const T = theme;
    const bar = Math.floor(s / 8) % T.chords.length;
    const beat = s % 8;
    const chord = T.chords[bar];
    if (beat === 0) {
      pattern = Math.random() < T.restChance ? null : T.patterns[Math.floor(Math.random() * T.patterns.length)];
      const barLen = stepLen() * 8;
      chord.forEach(m => {                       // soft pad
        voice(a, hz(m), at, barLen + 1.6, { type: 'sine', vol: T.padVol, attack: 1.0, hold: barLen - 0.2 });
        voice(a, hz(m), at, barLen + 1.6, { type: 'triangle', vol: T.padVol * 0.36, attack: 1.2, hold: barLen - 0.2, detune: 6 });
      });
      voice(a, hz(chord[0] - 24), at, 2.4, { type: 'sine', vol: T.bassVol, attack: 0.05 });   // low root
    }
    if (beat === 4) voice(a, hz(chord[0] - 24), at, 1.8, { type: 'sine', vol: T.bassVol * 0.65, attack: 0.05 });
    if (T.drums) {
      if (beat === 0 || beat === 4) kick(a, at);
      if (beat === 6 && Math.random() < 0.5) kick(a, at);
      if (beat % 2 === 1) shaker(a, at, 0.018);
      else shaker(a, at, 0.008);
    }
    if (pattern && pattern[beat] != null) {      // music box / harp
      const i = pattern[beat];
      const m = chord[i % 3] + 12 + (i >= 3 ? 12 : 0);
      voice(a, hz(m), at, T.drums ? 0.6 : 0.9, { type: 'triangle', vol: T.arpVol, attack: 0.008 });
    }
    if (beat % 2 === 1 && Math.random() < T.sparkleRate) {  // the odd sparkle
      voice(a, hz(T.sparkle[Math.floor(Math.random() * T.sparkle.length)]), at, 1.4, { type: 'sine', vol: 0.014, attack: 0.005 });
    }
  }

  function tick() {
    const a = ctx;
    if (!a || !playing) return;
    while (nextAt < a.currentTime + 0.25) {
      schedule(a, step, nextAt);
      nextAt += stepLen();
      step++;
    }
  }

  function start() {
    if (playing || !musicOn) return;
    const a = audio();
    if (!a) return;
    if (!bus) bus = buildBus(a);
    playing = true;
    step = 0;
    nextAt = a.currentTime + 0.1;
    bus.master.gain.cancelScheduledValues(a.currentTime);
    bus.master.gain.setValueAtTime(Math.max(bus.master.gain.value, 0.0001), a.currentTime);
    bus.master.gain.exponentialRampToValueAtTime(0.8, a.currentTime + 2.5);    // gentle fade in
    timer = setInterval(tick, 50);
    tick();
  }

  function stop() {
    if (!playing) return;
    playing = false;
    clearInterval(timer);
    const a = ctx;
    bus.master.gain.cancelScheduledValues(a.currentTime);
    bus.master.gain.setValueAtTime(Math.max(bus.master.gain.value, 0.0001), a.currentTime);
    bus.master.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.8);
  }

  // Browsers only allow sound after a click or key press, so music waits for the first one.
  function firstGesture() {
    document.removeEventListener('pointerdown', firstGesture, true);
    document.removeEventListener('keydown', firstGesture, true);
    if (musicOn) start();
  }
  document.addEventListener('pointerdown', firstGesture, true);
  document.addEventListener('keydown', firstGesture, true);

  // Pause while the tab is hidden, pick back up when it returns.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend();
    else if (playing || soundOn) ctx.resume();
  });

  window.RealmMusic = {
    get on() { return musicOn; },
    setTheme(name) { if (THEMES[name]) theme = THEMES[name]; },
    // Renders the music offline (used to make a preview recording).
    renderPreview(seconds, name) {
      if (name) this.setTheme(name);
      const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      const off = new Off(2, Math.ceil(44100 * seconds), 44100);
      const saved = bus;
      bus = buildBus(off);
      bus.master.gain.setValueAtTime(0.0001, 0);
      bus.master.gain.exponentialRampToValueAtTime(0.8, 2.5);
      for (let s = 0, at = 0.1; at < seconds - 2; s++, at += stepLen()) schedule(off, s, at);
      bus = saved;
      return off.startRendering();
    },
    toggle() {
      musicOn = !musicOn;
      savePref('mathRealm.music', musicOn);
      if (musicOn) start(); else stop();
      return musicOn;
    },
  };
})();
