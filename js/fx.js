/*
 * Math Realm: sound effects and confetti, shared by every game.
 * Sound starts OFF (it's a classroom). A student's choice is remembered on that computer.
 *   RealmFX.correct()  RealmFX.wrong()  RealmFX.fanfare()  RealmFX.confetti()
 *   RealmFX.soundOn    RealmFX.toggleSound()
 */
window.RealmFX = (function () {
  'use strict';
  const KEY = 'mathRealm.sound';
  let soundOn = false;
  try { soundOn = localStorage.getItem(KEY) === 'on'; } catch (e) { /* storage blocked */ }
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

  function reducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  return {
    get soundOn() { return soundOn; },
    toggleSound() {
      soundOn = !soundOn;
      try { localStorage.setItem(KEY, soundOn ? 'on' : 'off'); } catch (e) { /* fine */ }
      if (soundOn) this.correct();
      return soundOn;
    },
    correct() {
      if (!soundOn) return;
      note(1046.5, 0, 0.18, 'triangle');      // C6
      note(1318.5, 0.07, 0.22, 'triangle');   // E6
    },
    wrong() {
      if (!soundOn) return;
      note(311, 0, 0.22, 'sine', 0.08);
      note(262, 0.12, 0.3, 'sine', 0.08);
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
        const x = Math.random() * 100;
        const drift = (Math.random() - 0.5) * 30;
        const dur = 1.6 + Math.random() * 1.4;
        p.style.cssText = 'position:absolute;top:-20px;left:' + x + 'vw;width:' + size + 'px;height:' + (size * 0.6) + 'px;' +
          'background:' + colors[i % colors.length] + ';border-radius:2px;opacity:.95';
        p.animate(
          [{ transform: 'translate(0,0) rotate(0deg)' }, { transform: 'translate(' + drift + 'vw,105vh) rotate(' + (360 + Math.random() * 540) + 'deg)' }],
          { duration: dur * 1000, delay: Math.random() * 400, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' }
        );
        layer.appendChild(p);
      }
      document.body.appendChild(layer);
      setTimeout(() => layer.remove(), 3600);
    },
  };
})();
