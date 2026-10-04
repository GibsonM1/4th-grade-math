/*
 * Math Realm: voice answers (shared)
 *
 * Uses the browser's built-in speech recognition (Chrome, Edge, Safari).
 * In Chrome the audio is sent to Google's speech service to be turned into
 * text, which is why voice answers are switched off in catalog.js until the
 * district says it's OK.
 *
 *   RealmVoice.supported                  true if this browser can do it
 *   RealmVoice.numbersIn('fifty six')     → [56]
 *   const ear = RealmVoice.create({
 *     onSpeech(alternatives, isFinal) {},  // what it thinks it heard (best guess first)
 *     onState(state) {},                   // 'listening' | 'off' | 'blocked' | 'network'
 *   });
 *   ear.start(); ear.stop();
 *   ear.clear();                           // ignore anything heard so far (call on each new card)
 */
(function () {
  'use strict';
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  // Sound-alikes the recognizer sometimes writes instead of the number
  const SMALL = {
    zero: 0, oh: 0, one: 1, won: 1, two: 2, to: 2, too: 2, three: 3, tree: 3, free: 3,
    four: 4, for: 4, fore: 4, five: 5, six: 6, sex: 6, seven: 7, eight: 8, ate: 8, nine: 9,
    ten: 10, tin: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
    sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  };
  const TENS = { twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

  function numbersIn(text) {
    const words = String(text || '').toLowerCase().replace(/,/g, '').replace(/-/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
    const out = [];
    let cur = null;
    const flush = () => { if (cur !== null) { out.push(cur); cur = null; } };
    words.forEach(w => {
      if (/^\d+$/.test(w)) { flush(); out.push(Number(w)); return; }
      if (w === 'hundred') { cur = (cur === null ? 1 : cur) * 100; return; }
      if (w === 'and' && cur !== null && cur >= 100) return;
      if (w in TENS) {
        if (cur !== null && cur % 100 !== 0) flush();
        cur = (cur || 0) + TENS[w];
        return;
      }
      if (w in SMALL) {
        const v = SMALL[w];
        if (cur === null) cur = v;
        else if (cur >= 100 && cur % 100 === 0) cur += v;                 // one hundred four
        else if (cur >= 20 && cur % 10 === 0 && v < 10) cur += v;          // fifty six
        else { flush(); cur = v; }
        return;
      }
      flush();
    });
    flush();
    return out;
  }

  function create(handlers) {
    let rec = null, active = false, fromIndex = 0, lastLen = 0, netErrors = 0;

    function build() {
      rec = new SR();
      rec.lang = 'en-US';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 3;
      rec.onstart = () => handlers.onState && handlers.onState('listening');
      rec.onresult = e => {
        netErrors = 0;
        lastLen = e.results.length;
        for (let i = Math.max(fromIndex, e.resultIndex); i < e.results.length; i++) {
          const r = e.results[i];
          const alts = [];
          for (let k = 0; k < r.length; k++) alts.push(r[k].transcript);
          handlers.onSpeech && handlers.onSpeech(alts, r.isFinal);
        }
      };
      rec.onerror = e => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
          active = false;
          handlers.onState && handlers.onState('blocked');
        } else if (e.error === 'network') {
          if (++netErrors >= 3) { active = false; handlers.onState && handlers.onState('network'); }
        }
      };
      rec.onend = () => {
        fromIndex = 0;
        lastLen = 0;
        if (active) setTimeout(() => { if (active) { try { rec.start(); } catch (err) { /* already starting */ } } }, 150);
        else handlers.onState && handlers.onState('off');
      };
    }

    return {
      start() {
        if (!SR) return;
        if (!rec) build();
        active = true;
        try { rec.start(); } catch (err) { /* already listening */ }
      },
      stop() {
        active = false;
        if (rec) { try { rec.abort(); } catch (err) { /* fine */ } }
      },
      clear() { fromIndex = lastLen; },
    };
  }

  window.RealmVoice = { supported: !!SR, numbersIn: numbersIn, create: create };
})();
