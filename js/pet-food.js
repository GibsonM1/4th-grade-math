/*
 * Math Realm: Critter Café (fractions with measuring cups, decimals on a kitchen scale)
 *   pet-food.html?skill=g4.frac.build | g4.frac.equiv | g4.frac.mixed | g4.frac.times | g4.frac.kg
 *
 * A line of hungry pets each shows a meal card. The student picks a measuring
 * cup from a shelf (1/2, 1/3, 1/4, 1/6, 1/8, and on some levels the 1 cup),
 * scoops into a clear bowl, and presses Serve. The total isn't shown until
 * they serve, so they reason instead of watching a number go up.
 *
 * What makes them think, not just tap the numerator:
 *   - Choosing the cup. Only cups that split a cup into the right parts work
 *     (3/4 takes the 1/4 or the 1/8 cup, never the 1/3). One cup size per meal,
 *     plus the 1 cup, so nobody adds unlike denominators (5th grade).
 *   - Cards in different forms: numbers, words ("three fourths"), or a shaded
 *     fraction bar.
 *   - Adding it up (4.NF.3): after scooping, the student types how much is in
 *     the bowl (1/4 + 1/4 + 1/4 = 3/4). Released gradually: the first shift on a
 *     level shows the sums, the second shows them for the first 3 meals, then the
 *     student does the adding. Typing 3/12 gets a "don't add the bottoms" note.
 *   - Same amount, different name (4.NF.1): 6/8 for a 3/4 card is right, and the
 *     bowl shows why with fourths lines over the eighths and 3/4 = 3×2 / 4×2 = 6/8.
 *   - Comet helps in the kitchen and sometimes scoops wrong, with the mistakes
 *     students really make. The student checks Comet's bowl before serving it.
 *
 *   build   4.NF.3a/b  k/d = k scoops of 1/d (pick the right cup); later, add the rest
 *   equiv   4.NF.1     the matching cup is in the dishwasher: make 2/4 with 1/8s (or 1/2)
 *   mixed   4.NF.3b/c  more than a cup: 1 3/4 or 7/4 cups, with a 1 cup scoop too
 *   times   4.NF.4     3 kittens each need 2/3 cup: one bowl for all of them
 *   kg      4.NF.5-6, 4.MD.2   35/100 kg = 0.35 kg with 1 kg bags, 0.1 kg scoops, 0.01 kg pinches
 *
 * Recording follows the spec: right on the first try with no help counts toward
 * stars; a hint or a second try earns gems but not stars. After a second miss the
 * game shows the fix and the pet eats anyway. A short demo runs the first time
 * each level is played and can be replayed from the start screen.
 *
 * Cup amounts are whole numbers of 24ths (24 = 1 cup), which every cup divides
 * evenly. Scale amounts are whole numbers of hundredths of a kilogram.
 */
(function () {
  'use strict';
  if (!MathRealm.requireLogin()) return;

  // Guest mode: a banner on every page, so nobody thinks their work is being saved.
  (function () {
    const bar = MathRealm.guestBanner(location.pathname.split('/').pop() + location.search);
    const slot = document.getElementById('guestSlot');
    if (bar && slot) slot.append(bar);
  })();

  const GAME_ID = 'pet-food';
  const C = window.MATH_REALM_CATALOG;
  const $ = s => document.querySelector(s);
  const INK = '#2A1F45';
  const STAR_PATH = 'M14 2.8l3.4 7 7.7 1-5.6 5.3 1.4 7.6L14 19.9l-6.9 3.8 1.4-7.6-5.6-5.3 7.7-1z';
  const U = 24;                          // one cup
  const CUPS = [2, 3, 4, 6, 8];          // the fraction cups on the shelf (1/2 ... 1/8)
  const LEVELS = {
    'g4.frac.build': { kind: 'cups', make: makeBuild,  whole: false },
    'g4.frac.equiv': { kind: 'cups', make: makeEquiv,  whole: false },
    'g4.frac.mixed': { kind: 'cups', make: makeMixed,  whole: true },
    'g4.frac.times': { kind: 'cups', make: makeTimes,  whole: true },
    'g4.frac.kg':    { kind: 'kg',   make: makeKg },
  };
  const DEN_WORD = { 2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['fourth', 'fourths'], 6: ['sixth', 'sixths'],
                     8: ['eighth', 'eighths'], 10: ['tenth', 'tenths'], 100: ['hundredth', 'hundredths'] };

  const session = MathRealm.session;
  const skillId = new URLSearchParams(location.search).get('skill') || '';
  const skill = (session.skills || []).find(k => k.skillId === skillId);
  const L = LEVELS[skillId];
  RealmMusic.setTheme('calm');

  /* ── Helpers ── */

  const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const gcd = (a, b) => b ? gcd(b, a % b) : a;
  const simplestR = d => { let r; do { r = rnd(1, d - 1); } while (gcd(r, d) !== 1); return r; };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function S(tag, attrs) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k]));
    return e;
  }
  function show(id) {
    ['#intro', '#play', '#done', '#missing'].forEach(s => { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  /* ── Writing amounts ── */

  const fits = (u, d) => (u * d) % U === 0;                    // can 1/d scoops make this amount exactly?
  const sameFamily = (a, b) => a % b === 0 || b % a === 0;     // halves/fourths/eighths, or thirds/sixths
  // An amount (in 24ths) written in a denominator: "3/4", "1 3/4", "2". asFrac keeps 4/4 as 4/4.
  function cupText(u, d, asFrac) {
    const k = Math.round(u * d / U), w = Math.floor(k / d), r = k % d;
    if (asFrac && k > 0 && k <= d) return k + '/' + d;
    if (!r) return String(w);
    return (w ? w + ' ' : '') + r + '/' + d;
  }
  const improper = (u, d) => Math.round(u * d / U) + '/' + d;
  const cupWord = u => u > U ? 'cups' : 'cup';
  function kgText(h) {
    if (h % 100 === 0) return String(h / 100);
    return (h / 100).toFixed(h % 10 === 0 ? 1 : 2);
  }
  function kgFrac(h) {
    const den = h % 10 === 0 ? 10 : 100, n = den === 10 ? h / 10 : h;
    const w = Math.floor(n / den), r = n % den;
    if (!r) return String(w);
    return (w ? w + ' ' : '') + r + '/' + den;
  }
  const SMALL = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  function numWords(n) {
    if (n < 20) return SMALL[n];
    return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + SMALL[n % 10] : '');
  }
  function fracWords(n, d) {
    const w = DEN_WORD[d];
    if (!w) return n + ' over ' + d;
    return n + ' ' + (Number(n) === 1 ? w[0] : w[1]);
  }
  // "1 3/4" → "one and three fourths"; "7/4" → "seven fourths"
  function amtWords(text) {
    return String(text).split(' ').map(p => {
      const m = /^(\d+)\/(\d+)$/.exec(p);
      if (!m) return numWords(Number(p));
      const n = Number(m[1]), w = DEN_WORD[m[2]];
      return numWords(n) + ' ' + (n === 1 ? w[0] : w[1]);
    }).join(' and ');
  }

  function fracNode(text, cls) {
    const wrap = el('span', 'mixed' + (cls ? ' ' + cls : ''));
    String(text).split(' ').forEach(part => {
      const m = /^(\d+)\/(\d+)$/.exec(part);
      if (m) {
        const f = el('span', 'sf');
        f.append(el('span', 't', m[1]), el('span', 'b', m[2]));
        wrap.append(f);
      } else {
        wrap.append(el('span', '', part));
      }
    });
    return wrap;
  }
  function mathLine(tokens, cls) {
    const line = el('div', 'line' + (cls ? ' ' + cls : ''));
    tokens.forEach(t => {
      if (t && typeof t === 'object' && t.nodeType) { line.append(t); return; }
      if (t && typeof t === 'object') { line.append(el('span', t.cls || '', t.text)); return; }
      const s = String(t);
      if (/^\d/.test(s)) line.append(fracNode(s));
      else line.append(el('span', '', s));
    });
    return line;
  }

  /* ── Reading aloud (for the newest English learners) ── */

  const canSpeak = 'speechSynthesis' in window && C.readAloud !== false;
  function speakable(t) {
    return String(t)
      .replace(/(\d+) (\d+)\/(\d+)/g, (m, w, n, d) => w + ' and ' + fracWords(n, d))
      .replace(/(\d+)\/(\d+)/g, (m, n, d) => fracWords(n, d))
      .replace(/\b(\d+)\.(\d{1,2})\b/g, (m, w, f) => (w !== '0' ? w + ' and ' : '') + fracWords(Number(f), f.length === 1 ? 10 : 100))
      .replace(/×/g, ' times ').replace(/\bkg\b/g, 'kilograms').replace(/ = /g, ' equals ').replace(/ \+ /g, ' plus ');
  }
  function speak(text) {
    if (!canSpeak) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(speakable(text));
    const voices = speechSynthesis.getVoices().filter(v => /^en[-_]US/i.test(v.lang));
    const v = voices.find(x => x.localService) || voices[0];
    if (v) u.voice = v;
    u.lang = 'en-US';
    u.rate = 0.9;
    speechSynthesis.speak(u);
  }

  /* ── Pets come from js/sprites.js: the starters plus critters adopted in the shop ── */

  const PETS = RealmSprites.cafeCritters(MathRealm.session);
  const COMET = RealmSprites.critter('comet');
  const petSvg = (pet, cls) => RealmSprites.critterSvg(pet, cls);
  const line = { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' };
  const fill = (f, extra) => Object.assign({ fill: f }, line, extra || {});

  /* ── Scoop math ── */

  // The fewest scoops that make `need`: whole cups first (if allowed), then one fraction cup.
  function bestScoops(need, dens, whole) {
    let best = null;
    const W = whole ? Math.floor(need / U) : 0, rem = need - W * U;
    if (rem === 0 && whole) return Array(W).fill(1);
    dens.forEach(d => {
      if (!fits(rem, d)) return;
      const list = Array(W).fill(1).concat(Array(rem * d / U).fill(d));
      if (!best || list.length < best.length) best = list;
    });
    return best;
  }
  // The usual way: whole cups, then the card's own cup if it's on the shelf
  function plainScoops(need, d, dens, whole) {
    const W = whole ? Math.floor(need / U) : 0, rem = need - W * U;
    if (dens.indexOf(d) >= 0 && fits(rem, d)) return Array(W).fill(1).concat(Array(rem * d / U).fill(d));
    return bestScoops(need, dens, whole);
  }
  const amountOf = list => list.reduce((s, d) => s + U / d, 0);
  function describeScoops(list) {
    if (L.kind === 'kg') {
      const c = { bag: 0, scoop: 0, pinch: 0 };
      list.forEach(a => { c[a]++; });
      const parts = [];
      if (c.bag) parts.push(c.bag + (c.bag > 1 ? ' bags' : ' bag'));
      if (c.scoop) parts.push(c.scoop + (c.scoop > 1 ? ' scoops' : ' scoop'));
      if (c.pinch) parts.push(c.pinch + (c.pinch > 1 ? ' pinches' : ' pinch'));
      return parts.join(' and ') || 'nothing';
    }
    const W = list.filter(d => d === 1).length, f = list.filter(d => d !== 1);
    const parts = [];
    if (W) parts.push(W + (W > 1 ? ' whole cups' : ' whole cup'));
    if (f.length) parts.push(f.length + (f.length > 1 ? ' scoops' : ' scoop') + ' of the 1/' + f[0] + ' cup');
    return parts.join(' and ') || 'nothing';
  }

  /* ── Making meal cards ──
   * Cup meals: { pet, crew, target, amt, form ('num' | 'words' | 'bar'), unit, who, food, note, rush,
   *   cups (dens on the shelf), gone (den in the dishwasher), whole, prefill, prefillDen,
   *   cardDen, jars, times, share, hintText, prompt, comet? }
   * Scale meals: { pet, target (hundredths), amt, form, ..., comet? }
   */

  function phase(i, n) { return i < Math.ceil(n / 3) ? 0 : i < Math.ceil(2 * n / 3) ? 1 : 2; }
  const jarsFor = u => Math.min(5, Math.max(1, Math.ceil(u / U) + (u % U === 0 && u > 0 && L.whole ? 1 : 0)));

  function base(pet, extra) {
    return Object.assign({ pet, crew: 1, food: 'of ' + pet.food, note: '', rush: false, prefill: 0, prefillDen: 0,
      cups: CUPS.slice(), gone: 0, whole: !!L.whole, form: 'num', comet: null, showSum: false }, extra);
  }

  function makeBuild(pet, i, n, seen) {
    const ph = phase(i, n);
    let d, k;
    for (let tries = 0; tries < 40; tries++) {
      d = pick(ph === 0 ? [2, 3, 4] : ph === 1 ? [3, 4, 6, 8] : [2, 3, 4, 6, 8]);
      k = Math.random() < 0.1 ? d : d === 2 ? 1 : rnd(2, d - 1);
      if (!seen.has(k + '/' + d)) break;
    }
    seen.add(k + '/' + d);
    const target = k * U / d, amt = k + '/' + d;
    const form = ph === 0 ? 'num' : pick(ph === 1 ? ['num', 'words', 'bar'] : ['num', 'words', 'bar', 'bar']);
    const m = base(pet, { k, d, target, amt, form, unit: cupWord(target), cardDen: d, jars: 1, who: pet.name + ' needs' });
    const dw = DEN_WORD[d][1];
    if (ph === 2 && k >= 3 && Math.random() < 0.5) {
      const p = rnd(1, k - 1);
      m.prefill = p * U / d; m.prefillDen = d;
      m.note = p + '/' + d + ' cup is already in the bowl. Add the rest.';
      m.hintText = 'The bowl already has ' + p + '/' + d + ' cup, and ' + pet.name + ' needs ' + amt + '. How many more ' + dw + ' is that? Look for the goal line.';
    } else {
      m.hintText = amt + ' cup means ' + k + ' parts of a cup split into ' + d + ' equal parts. Pick the cup that makes ' + dw +
        ', then count your scoops. Look for the goal line.';
    }
    m.prompt = pet.name + ': ' + amt + ' cup (' + form + ')' + (m.prefill ? ', ' + cupText(m.prefill, d, true) + ' already in' : '');
    return m;
  }

  function makeEquiv(pet, i, n, seen) {
    const ph = phase(i, n);
    let t, k, target, ok = [];
    for (let tries = 0; tries < 80; tries++) {
      t = pick(ph === 0 ? [2, 3, 4] : [2, 3, 4, 6, 8]);
      k = Math.random() < 0.08 ? t : t === 2 ? 1 : rnd(1, t - 1);
      target = k * U / t;
      ok = CUPS.filter(c => c !== t && fits(target, c));
      if (ok.length && (ph > 0 || ok.some(c => c > t)) && !seen.has(k + '/' + t)) break;
    }
    seen.add(k + '/' + t);
    const amt = k + '/' + t, gone = t;
    const m = base(pet, { k, d: t, target, amt, form: ph === 0 ? 'num' : pick(['num', 'num', 'words']), unit: cupWord(target),
      cardDen: t, gone, jars: 1, who: pet.name + ' needs', note: 'Oh no, the 1/' + t + ' cup is in the dishwasher!' });
    const w = pick(ok);
    if (w > t) {
      m.hintText = 'One 1/' + t + ' cup holds the same as ' + (w / t) + ' scoops of the 1/' + w + ' cup. So ' + amt + ' is ' + k + ' groups of ' + (w / t) + ' scoops.';
    } else {
      m.hintText = (t / w) + '/' + t + ' cup is the same as 1/' + w + ' cup. How many groups of ' + (t / w) + '/' + t + ' make ' + amt + '?';
    }
    m.prompt = pet.name + ': ' + amt + ' cup, no 1/' + t + ' cup';
    return m;
  }

  function makeMixed(pet, i, n, seen) {
    const ph = phase(i, n);
    let d, W, r, key;
    for (let tries = 0; tries < 40; tries++) {
      d = pick(ph === 0 ? [2, 3, 4] : [2, 3, 4, 6, 8]);
      W = ph === 0 ? 1 : rnd(1, 2); r = simplestR(d);
      key = W + '/' + r + '/' + d;
      if (!seen.has(key)) break;
    }
    seen.add(key);
    const k = W * d + r, target = k * U / d;
    const imp = ph > 0 && Math.random() < 0.5;
    const amt = imp ? k + '/' + d : W + ' ' + r + '/' + d;
    const form = ph === 0 ? 'num' : pick(['num', 'num', 'words', 'bar']);
    const m = base(pet, { k, d, W, r, target, amt, form, unit: 'cups', cardDen: d, jars: jarsFor(target), who: pet.name + ' needs', improper: imp });
    if (ph === 2 && Math.random() < 0.35) {
      const pk = Math.random() < 0.5 ? d : rnd(1, d - 1);
      m.prefill = pk * U / d; m.prefillDen = d;
      m.note = cupText(m.prefill, d) + ' ' + cupWord(m.prefill) + ' ' + (m.prefill > U ? 'are' : 'is') + ' already in the bowl. Add the rest.';
    }
    if (m.prefill) {
      m.hintText = 'The bowl already has ' + cupText(m.prefill, d) + ' ' + cupWord(m.prefill) + '. How much more makes ' + amt + ' cups? Count up from there.';
    } else if (imp) {
      m.hintText = d + '/' + d + ' makes 1 whole cup. ' + amt + ' is ' + W + ' whole ' + (W > 1 ? 'cups' : 'cup') + ' and ' + r + '/' + d + ' more: ' + amt + ' = ' + W + ' ' + r + '/' + d + '.';
    } else {
      m.hintText = amt + ' cups is ' + W + ' whole ' + (W > 1 ? 'cups' : 'cup') + ' and ' + r + '/' + d + ' cup more. The 1 cup scoop fills a whole cup at once.';
    }
    m.prompt = pet.name + ': ' + amt + ' cups (' + form + ')' + (m.prefill ? ', ' + cupText(m.prefill, d) + ' already in' : '');
    return m;
  }

  function makeTimes(pet, i, n, seen) {
    const ph = phase(i, n);
    let d, a, crew, N;
    for (let tries = 0; tries < 200; tries++) {
      if (ph === 0) { d = pick([3, 4, 6, 8]); a = 1; crew = rnd(2, 5); }
      else { d = pick(ph === 1 ? [2, 3, 4, 6, 8] : [3, 4, 6, 8]); a = d === 2 ? 1 : simplestR(d); crew = rnd(ph === 1 ? 2 : 3, 6); }
      N = crew * a;
      if (N > 12 || N > 4 * d || N < 2) continue;   // at most 12 scoops of the 1/d cup
      if (ph > 0 && N < d) continue;                 // later on, always at least a whole cup
      if (seen.has(N * U / d)) continue;             // no repeated totals in a shift
      break;
    }
    const target = N * U / d, share = a * U / d;
    seen.add(target);
    const amt = a + '/' + d;
    const m = base(pet, { crew, d, a, N, share, target, amt, unit: cupWord(share), cardDen: d, jars: jarsFor(target),
      who: crew + ' ' + pet.plural + ' each need', times: crew + ' × ' + amt });
    m.note = 'Fill one big bowl with enough for all ' + crew + '.';
    m.hintText = m.times + ' means ' + crew + ' groups of ' + amt + ', which is ' + N + '/' + d + '. Every ' + d + '/' + d +
      ' is 1 whole cup. The colored marks show each ' + pet.species + "'s share.";
    m.prompt = m.times + ' cup (' + pet.plural + ')';
    return m;
  }

  function makeKg(pet, i, n, seen) {
    const ph = phase(i, n);
    let h, form;
    for (let tries = 0; tries < 40; tries++) {
      if (ph === 0) { h = rnd(1, 9) * 10; form = pick(['frac', 'frac', 'dec', 'words']); }
      else if (ph === 1) { do { h = rnd(3, 98); } while (h % 10 === 0 && Math.random() < 0.7); form = pick(['frac', 'dec', 'words']); }
      else if (Math.random() < 0.3) { form = 'sum'; h = rnd(1, 9) * 10 + rnd(1, 9); }
      else { h = rnd(101, 195); form = pick(['frac', 'dec']); }
      if (!seen.has(h)) break;
    }
    seen.add(h);
    const amt = form === 'dec' ? kgText(h) : form === 'sum' ? (Math.floor(h / 10) + '/10 + ' + (h % 10) + '/100') : kgFrac(h);
    const tenths = Math.floor((h % 100) / 10), hund = h % 10, bags = Math.floor(h / 100);
    let hintText;
    if (form === 'sum') {
      hintText = 'Put the parts on one at a time. ' + tenths + '/10 kg is ' + tenths + ' tenths, so use 0.1 kg scoops. ' + hund + '/100 kg is ' + hund + ' hundredths, so use 0.01 kg pinches.';
    } else if (form === 'dec') {
      hintText = 'Look at each place in ' + kgText(h) + '. ' + (bags ? 'The ones place tells how many 1 kg bags. ' : '') +
        'The tenths place tells how many 0.1 kg scoops' + (h % 10 ? ', and the hundredths place tells how many 0.01 kg pinches.' : '.');
    } else if (h % 10 === 0 && h < 100) {
      hintText = kgFrac(h) + ' kg means ' + (h / 10) + ' tenths of a kilogram. Each 0.1 kg scoop is 1/10 kg.';
    } else if (h < 100) {
      hintText = h + '/100 kg is ' + h + ' hundredths. Ten hundredths make one tenth, so each 0.1 kg scoop is 10/100 kg. How many tens are in ' + h + '?';
    } else {
      hintText = 'The whole number tells how many 1 kg bags. Then put on the fraction part: tenths with scoops, hundredths with pinches.';
    }
    return base(pet, { kind: 'kg', target: h, amt, form, unit: 'kg', hintText, cardDen: 0,
      who: pet.name + (form === 'sum' ? "'s vet says:" : ' needs'), food: form === 'sum' ? 'of ' + pet.food + ' in all' : 'of ' + pet.food,
      note: form === 'sum' ? 'Put both amounts on the scale together.' : '', prompt: pet.name + ': ' + amt + ' kg (' + form + ')' });
  }

  /* ── Comet's bowls: the mistakes students really make ── */

  function cometMistakes(m) {
    const out = [], cap = m.jars * U;
    const add = (scoops, why) => { const u = amountOf(scoops); if (u !== m.target && u > 0 && u <= cap) out.push({ scoops, why }); };
    const amt = m.amt;
    if (skillId === 'g4.frac.build') {
      const { k, d } = m, dw = DEN_WORD[d][1];
      if (d * 2 <= 8) add(Array(k).fill(d * 2), 'Comet thought the 1/' + (d * 2) + ' cup was bigger because ' + (d * 2) + ' is bigger than ' + d +
        '. But 1/' + (d * 2) + ' cup is smaller: it takes 2 of them to fill a 1/' + d + ' cup. ' + amt + ' cup is ' + k + ' scoops of 1/' + d + '.');
      CUPS.filter(x => x !== d && x >= k && !fits(m.target, x)).forEach(x => add(Array(k).fill(x),
        'Comet used ' + k + ' scoops, but of the 1/' + x + ' cup. ' + amt + ' means ' + dw + ', so each scoop has to be 1/' + d + ' cup (or two 1/' + (d * 2) + ' scoops).'));
      if (k + 1 <= d) add(Array(k + 1).fill(d), 'Comet lost count. ' + amt + ' cup is ' + k + ' scoops of 1/' + d + ', not ' + (k + 1) + '.');
      if (k > 1) add(Array(k - 1).fill(d), 'Comet lost count. ' + amt + ' cup is ' + k + ' scoops of 1/' + d + ', not ' + (k - 1) + '.');
    } else if (skillId === 'g4.frac.equiv') {
      const { k, d: t } = m;
      CUPS.filter(s => s !== t && sameFamily(s, t)).forEach(s => {
        const K = m.target * s / U;
        if (!Number.isInteger(K)) return;
        add(Array(k).fill(s), 'Comet kept the ' + k + ' from ' + amt + ' but switched to the 1/' + s + ' cup. A 1/' + s + ' scoop is ' +
          (s > t ? 'smaller' : 'bigger') + ' than a 1/' + t + ' scoop, so it takes ' + (s > t ? 'more' : 'fewer') + ' of them: ' + amt + ' = ' + K + '/' + s + '.');
      });
    } else if (skillId === 'g4.frac.mixed') {
      const { W, r, d } = m, wc = W + (W > 1 ? ' whole cups' : ' whole cup');
      add(Array(r).fill(d), m.improper
        ? 'Comet only scooped ' + r + '/' + d + ' cup. But ' + amt + ' has ' + wc + ' in it too: ' + amt + ' = ' + W + ' ' + r + '/' + d + '.'
        : 'Comet scooped the ' + r + '/' + d + ' cup part and forgot the ' + wc + '.');
      add(Array(W + r).fill(d), 'Comet counted each whole cup as just 1/' + d + ' cup. A whole cup is ' + d + '/' + d + ', so ' + amt + ' needs ' + wc + ' and ' + r + '/' + d + ' more.');
    } else if (skillId === 'g4.frac.times') {
      const { crew, a, d, N } = m, mix = cupText(m.target, d);
      add(Array(a).fill(d), 'Comet scooped ' + amt + ' cup, enough for only one ' + m.pet.species + '. There are ' + crew + ': ' + m.times + ' = ' + N + '/' + d + ' = ' + mix + ' cups.');
      add(Array(crew).fill(1).concat(Array(a).fill(d)), 'Comet added instead of multiplying: ' + crew + ' + ' + amt + '. Feeding ' + crew + ' ' + m.pet.plural + ' ' + amt +
        ' cup each is ' + m.times + ' = ' + N + '/' + d + ' = ' + mix + ' cups.');
      const short = bestScoops(m.target - m.share, CUPS, true);
      if (short) add(short, 'Comet fed only ' + (crew - 1) + ' of the ' + crew + ' ' + m.pet.plural + '. ' + m.times + ' = ' + N + '/' + d + ' = ' + mix + ' cups.');
    } else {
      const h = m.target, t = Math.floor((h % 100) / 10), u = h % 10, b = Math.floor(h / 100);
      const kgList = (bb, tt, uu) => Array(bb).fill('bag').concat(Array(tt).fill('scoop'), Array(uu).fill('pinch'));
      const kgAdd = (list, why) => { const v = list.reduce((s, x) => s + (x === 'bag' ? 100 : x === 'scoop' ? 10 : 1), 0); if (v !== h) out.push({ scoops: list, why }); };
      if (t && u && t !== u) kgAdd(kgList(b, u, t), 'Comet mixed up the places. ' + kgText(h) + ' kg has ' + t + ' tenths and ' + u + ' hundredths: ' + t + ' scoops of 0.1 kg and ' + u + ' pinches of 0.01 kg.');
      if (t && !u && h < 100) kgAdd(kgList(0, 0, t), 'Comet used ' + t + ' pinches. But ' + kgText(h) + ' kg is ' + t + ' tenths, and each tenth is a 0.1 kg scoop: ' + t + ' scoops.');
      if (b) kgAdd(kgList(0, t, u), 'Comet forgot the whole kilogram. The ' + b + ' in ' + kgText(h) + ' means ' + b + (b > 1 ? ' bags' : ' bag') + ' of 1 kg.');
      if (u < 9) kgAdd(kgList(b, t, u + 1), 'Comet added one pinch too many. ' + kgText(h) + ' kg is ' + (b ? b + ' kg, ' : '') + t + ' tenths and ' + u + ' hundredths.');
    }
    return out;
  }
  function cometRight(m) {
    if (L.kind === 'kg') {
      const h = m.target;
      return Array(Math.floor(h / 100)).fill('bag').concat(Array(Math.floor((h % 100) / 10)).fill('scoop'), Array(h % 10).fill('pinch'));
    }
    const dens = m.cups.filter(c => c !== m.gone);
    return plainScoops(m.target, m.cardDen, dens, m.whole);
  }
  function giveToComet(m) {
    if (m.prefill) return;
    const wrong = cometMistakes(m);
    if (wrong.length && Math.random() < 0.65) {
      const w = pick(wrong);
      m.comet = { scoops: w.scoops, right: false, why: w.why };
    } else {
      m.comet = { scoops: cometRight(m), right: true, why: '' };
    }
    if (L.kind !== 'kg') m.jars = Math.max(m.jars, jarsFor(amountOf(m.comet.scoops)));
    m.prompt = 'Comet\'s bowl ' + (m.comet.right ? '(right)' : '(wrong)') + ': ' + m.prompt;
  }

  /* ── Top bar ── */

  $('#gemName').textContent = C.pointsName;
  function updateGems() {
    const s = MathRealm.session;
    $('#gemCount').textContent = s ? Number(s.student.points || 0).toLocaleString() : '0';
  }
  updateGems();
  [
    { btn: $('#soundBtn'), label: 'Sounds', get: () => RealmFX.soundOn, flip: () => RealmFX.toggleSound() },
    { btn: $('#musicBtn'), label: 'Music', get: () => RealmMusic.on, flip: () => RealmMusic.toggle() },
  ].forEach(t => {
    const paint = () => { t.btn.textContent = t.label + ': ' + (t.get() ? 'on' : 'off'); t.btn.setAttribute('aria-pressed', String(t.get())); };
    paint();
    t.btn.addEventListener('click', () => { t.flip(); paint(); t.btn.blur(); });
  });

  if (!skill || !L) { show('#missing'); return; }

  function starRow(have, need, mastered, pop) {
    const row = el('div', 'stars' + (mastered ? ' mastered' : '') + (pop ? ' pop' : ''));
    row.setAttribute('role', 'img');
    row.setAttribute('aria-label', mastered ? 'Mastered' : have + ' of ' + need + ' stars');
    for (let i = 0; i < need; i++) {
      const star = S('svg', { viewBox: '0 0 28 28', class: 'star' + (mastered || i < have ? ' on' : ''), 'aria-hidden': 'true' });
      star.style.setProperty('--i', i);
      star.append(S('path', { d: STAR_PATH }));
      row.append(star);
    }
    return row;
  }

  /* ── Intro ── */

  const zone = C.zones.find(z => z.zone === skill.zone);
  $('#zoneName').textContent = zone ? zone.title : skill.zone;
  $('#skillTitle').textContent = skill.name;
  document.title = skill.name;
  PETS.forEach(p => {
    const f = el('figure');
    f.append(petSvg(p), el('figcaption', '', p.name));
    $('#cast').append(f);
  });
  const PETS_PER_SHIFT = clamp(Number(skill.minItems) || 8, 4, 16);
  const mine = session.mastery[skillId] || { status: '', days: 0 };
  $('#introStars').replaceChildren(starRow(Math.min(mine.days || 0, skill.daysNeeded), skill.daysNeeded, mine.status === 'mastered', false));
  (function rules() {
    const box = $('#rules');
    const p = html => { const e = el('p'); e.innerHTML = html; box.append(e); };
    if (L.kind === 'kg') {
      p('<strong>Each pet shows a meal card</strong> in kilograms (kg). Put 1 kg bags, 0.1 kg scoops and 0.01 kg pinches on the scale until it has exactly the right amount, then press <strong>Serve!</strong>');
    } else {
      p('<strong>Each pet shows a meal card.</strong> Pick a measuring cup that fits the amount, scoop into the bowl, then press <strong>Serve!</strong> One cup size per meal' +
        (L.whole ? ' (the 1 cup can join any of them).' : '.'));
      p('<strong>Then add it up:</strong> type how much is in the bowl. Your first shift shows the sums for you.');
    }
    p('<strong>Comet is helping in the kitchen</strong> and sometimes scoops the wrong amount. Check Comet\'s bowls before you serve them!');
    p(mine.status === 'mastered'
      ? 'You already mastered this one! Extra shifts keep it sharp.'
      : "To earn today's star: feed " + PETS_PER_SHIFT + ' pets and get ' + Math.round(skill.minAccuracy * 100) + '% of the meals right on the first try with no hint.');
  })();

  let memory = { v: 3, fed: 0, caught: 0, seen: {}, shifts: {} }, memoryLoaded = false;
  show('#intro');
  MathRealm.loadState(GAME_ID).then(d => {
    if (d.ok) {
      memoryLoaded = true;
      const s = d.state || {};
      const obj = x => x && typeof x === 'object' ? x : {};
      memory = { v: 3, fed: Number(s.fed) || 0, caught: Number(s.caught) || 0, seen: obj(s.seen), shifts: obj(s.shifts) };
    }
    if (memory.fed) { $('#fedCount').textContent = 'Pets you have fed: ' + memory.fed.toLocaleString(); $('#fedCount').hidden = false; }
    const b = $('#startBtn');
    b.disabled = false;
    b.textContent = 'Open the café!';
    $('#demoBtn').disabled = false;
    b.focus();
  });
  $('#startBtn').addEventListener('click', () => { $('#startBtn').blur(); startShift(); });
  $('#againBtn').addEventListener('click', () => { $('#againBtn').blur(); startShift(); });
  $('#demoBtn').addEventListener('click', () => { $('#demoBtn').blur(); runDemo(() => { show('#intro'); $('#startBtn').focus(); }); });
  if (canSpeak) {
    $('#readBtn').hidden = false;
    $('#readBtn').addEventListener('click', () => { $('#readBtn').blur(); speak(cardSentence(meal) + ' ' + $('#caption').textContent); });
  }

  /* ── Shift state ── */

  let queue = [], idx = -1, meal = null, round = null, results = [], happy = 0, caught = 0, cometWrong = 0;
  let added = [];                 // scoops in the bowl: denominators (1 = the 1 cup), or 'bag' | 'scoop' | 'pinch'
  let tries = 0, hinted = false, phaseName = 'idle', fixedComet = false;
  // Adding the scoops, released gradually: the first shift on a level shows the sums,
  // the second shows them for the first 3 meals, and after that the student adds them up.
  let stage = 0, sumIntroDone = false, sumHinted = false;
  const SHOWN_IN_SECOND_SHIFT = 3;

  function buildQueue() {
    const order = [];
    while (order.length < PETS_PER_SHIFT) shuffle(PETS.slice()).forEach(p => { if (order[order.length - 1] !== p) order.push(p); });
    const seen = new Set();
    const q = order.slice(0, PETS_PER_SHIFT).map((p, i) => L.make(p, i, PETS_PER_SHIFT, seen));
    // Comet scoops two of the later meals (never Comet's own dinner)
    const slots = shuffle(q.map((m, i) => i).filter(i => i >= Math.ceil(PETS_PER_SHIFT / 3) && !q[i].prefill)).slice(0, PETS_PER_SHIFT >= 6 ? 2 : 1);
    slots.forEach(i => {
      if (q[i].pet.id === 'comet') {
        const other = PETS.filter(p => p.id !== 'comet');
        if (!other.length) return;
        q[i] = L.make(pick(other), i, PETS_PER_SHIFT, seen);
        if (q[i].prefill) return;
      }
      giveToComet(q[i]);
    });
    return q;
  }

  function startShift() {
    if (!memory.seen[skillId]) { runDemo(() => { memory.seen[skillId] = true; beginShift(); }); return; }
    beginShift();
  }
  function beginShift() {
    queue = buildQueue();
    idx = -1; results = []; happy = 0; caught = 0; cometWrong = 0;
    stage = Math.min(2, Number(memory.shifts[skillId]) || 0);
    sumIntroDone = false;
    queue.forEach((m, i) => { m.showSum = L.kind === 'cups' && (stage === 0 || (stage === 1 && i < SHOWN_IN_SECOND_SHIFT)); });
    round = MathRealm.startRound(GAME_ID, skillId);
    $('#petTotal').textContent = PETS_PER_SHIFT;
    $('#happyCount').textContent = '0';
    show('#play');
    nextPet();
  }

  function cardSentence(m) {
    if (!m) return '';
    let amt;
    if (m.form === 'bar') {
      const W = Math.floor(m.target / U), rest = m.target - W * U;
      amt = 'this much: ' + (W ? W + (W > 1 ? ' whole cups' : ' whole cup') + (rest ? ' and ' : '') : '') + (rest ? (rest * m.cardDen / U) + ' of ' + m.cardDen + ' equal parts of a cup' : '');
      return m.who + ' ' + amt + ', ' + m.food + '. ' + m.note;
    }
    amt = m.form === 'words' ? amtWords(m.amt) : m.amt;
    return m.who + ' ' + amt + ' ' + m.unit + ' ' + m.food + '. ' + m.note;
  }

  function renderQueue() {
    const q = $('#queueLine');
    q.replaceChildren(el('span', 'lbl', idx < 0 ? 'Practice' : idx + 1 < queue.length ? 'Waiting in line:' : 'Last pet!'));
    if (idx < 0) return;
    queue.slice(idx + 1, idx + 8).forEach(m => {
      const c = el('div', 'qpet');
      c.append(petSvg(m.pet));
      if (m.crew > 1) c.append(el('span', 'crew', '×' + m.crew));
      q.append(c);
    });
  }

  // The amount as a picture: fraction strips, one per cup, split into equal parts
  function barSvg(m) {
    const d = m.cardDen, total = Math.round(m.target * d / U), strips = Math.ceil(total / d);
    const W = 220, H = 24, gap = 8;
    const svg = S('svg', { viewBox: '0 0 ' + (W + 4) + ' ' + (strips * (H + gap) - gap + 4), role: 'img', 'aria-label': cardSentence(m) });
    let left = total;
    for (let s = 0; s < strips; s++) {
      for (let p = 0; p < d; p++) {
        const on = left > 0;
        svg.append(S('rect', { x: 2 + p * W / d, y: 2 + s * (H + gap), width: W / d, height: H, fill: on ? m.pet.color : '#FFFFFF', stroke: INK, 'stroke-width': 2 }));
        left--;
      }
    }
    return svg;
  }

  function renderMeal() {
    $('#mealWho').textContent = meal.form === 'bar' ? meal.who + ' this much:' : meal.who;
    const amt = $('#mealAmt');
    amt.replaceChildren();
    if (meal.form === 'sum') {
      const [a, b] = meal.amt.split(' + ');
      amt.append(fracNode(a), el('span', 'unit', 'kg'), el('span', 'plus', '+'), fracNode(b), el('span', 'unit', 'kg'));
    } else if (meal.form === 'words') {
      amt.append(el('span', 'words', L.kind === 'kg' ? amtWords(meal.amt.indexOf('.') >= 0 ? kgFrac(meal.target) : meal.amt) : amtWords(meal.amt)),
        el('span', 'unit', L.kind === 'kg' ? 'kilogram' : meal.unit));
    } else if (meal.form === 'bar') {
      amt.append(barSvg(meal));
    } else {
      amt.append(fracNode(meal.amt), el('span', 'unit', meal.unit));
    }
    $('#mealFood').textContent = meal.form === 'bar' ? meal.food + ' (each bar is 1 cup)' : meal.food;
    const note = $('#mealNote');
    note.textContent = meal.note;
    note.className = 'note' + (meal.rush ? ' rush' : '');
    const pets = $('#pets');
    pets.replaceChildren();
    const size = meal.crew === 1 ? 100 : Math.min(80, Math.floor(250 / meal.crew));
    for (let j = 0; j < meal.crew; j++) {
      const svg = petSvg(meal.pet, 'idle');
      svg.style.width = size + 'px';
      svg.style.height = Math.round(size * 1.05) + 'px';
      pets.append(svg);
    }
    if (meal.comet) {
      const chef = el('div', 'chef');
      chef.append(petSvg(COMET), document.createTextNode('Comet scooped this bowl'));
      pets.append(chef);
    }
  }
  function petMood(mood) {
    document.querySelectorAll('#pets > svg .pet').forEach((g, j) => {
      g.classList.remove('happy', 'unsure', 'idle');
      void g.getBoundingClientRect();
      g.classList.add(mood);
      if (mood === 'happy') g.style.animationDelay = (j * 90) + 'ms';
    });
    if (mood === 'happy') {
      const box = $('#pets');
      for (let j = 0; j < 3; j++) {
        const h = el('span', 'heart-pop', '♥');
        h.style.left = (30 + j * 20 + rnd(-6, 6)) + '%';
        h.style.animationDelay = (j * 180) + 'ms';
        box.append(h);
        setTimeout(() => h.remove(), 1800);
      }
    }
  }

  function caption(text, tone) {
    const c = $('#caption');
    c.textContent = text;
    c.className = 'caption' + (tone ? ' ' + tone : '');
  }
  function tip(text) { $('#tip').textContent = text || ''; }
  let keyActions = {};
  function controls(list) {
    const box = $('#controls');
    box.replaceChildren();
    keyActions = {};
    list.forEach(b => {
      const btn = el('button', 'btn' + (b.soft ? ' btn-soft' : '') + (b.wide ? ' wide' : ''), b.label);
      btn.type = 'button';
      if (b.id) btn.id = b.id;
      btn.disabled = !!b.disabled;
      btn.addEventListener('click', () => { btn.blur(); b.on(); });
      if (b.key && !b.disabled) keyActions[b.key] = b.on;
      box.append(btn);
    });
  }
  function syncData() {
    const d = $('#play').dataset;
    d.phase = phaseName; d.target = meal ? meal.target : ''; d.total = meal ? total() : ''; d.kind = L.kind;
    d.sum = meal && meal.showSum ? 'shown' : 'typed'; d.comet = meal && meal.comet ? (meal.comet.right ? 'right' : 'wrong') : '';
  }

  function setupMeal() {
    renderQueue();
    renderMeal();
    if (L.kind === 'kg') buildScale(); else buildJars();
    buildShelf();
  }

  function nextPet() {
    idx++;
    if (idx >= queue.length) { endShift(); return; }
    meal = queue[idx];
    tries = 0; hinted = false; fixedComet = false; sumHinted = false;
    added = meal.comet ? meal.comet.scoops.slice() : [];
    setupMeal();
    if (meal.comet) {
      phaseName = 'check';
      caption('Comet scooped ' + (meal.crew > 1 ? 'the ' + meal.pet.plural + "'" : meal.pet.name + "'s") + ' dinner: ' + describeScoops(added) +
        '. Is that exactly right? Serve it, or fix it first.', 'comet');
      tip('Check the card, then decide.');
    } else {
      phaseName = 'scoop';
      caption(idx === 0 ? 'Your first customer! Read the meal card, then pick a ' + (L.kind === 'kg' ? 'weight' : 'measuring cup') + '.' :
        pick(['Next customer!', 'Who\'s hungry? Next!', 'Here comes the next pet!']));
      tip(L.kind === 'kg' ? 'Keys: 1 bag, 2 scoop, 3 pinch, Backspace pours one back, Enter serves.' : 'Keys: number keys pick cups, Backspace pours one back, Enter serves.' +
        (meal.showSum ? '' : ' Then you add it up.'));
    }
    refresh();
    round.shown();
  }

  /* ── Amounts ── */

  function total() {
    if (L.kind === 'kg') return added.reduce((s, a) => s + (a === 'bag' ? 100 : a === 'scoop' ? 10 : 1), 0);
    return meal.prefill + amountOf(added);
  }
  function capacity() { return L.kind === 'kg' ? 299 : meal.jars * U; }
  function counts() {
    const c = { bag: 0, scoop: 0, pinch: 0 };
    added.forEach(a => { c[a]++; });
    return c;
  }
  const chosenCup = () => added.find(d => d !== 1) || 0;
  // The denominator the bowl is measured in right now
  function bowlDen() {
    const c = chosenCup(), p = meal.prefillDen;
    if (c && p) return Math.max(c, p);
    return c || p || meal.cardDen;
  }

  /* ── The bowl: one clear jar per cup ── */

  const JW = 92, JH = 156, GAP = 30, TOP = 26, PADX = 34;
  let jarRefs = [];
  function buildJars() {
    const svg = $('#bowlSvg');
    svg.replaceChildren();
    $('#pv').hidden = true; $('#pvNote').hidden = true;
    const n = meal.jars, W = PADX * 2 + n * JW + (n - 1) * GAP, H = TOP + JH + 34;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('aria-label', 'Food bowl, ' + n + (n > 1 ? ' cups' : ' cup') + ' big');
    const defs = S('defs');
    const pat = S('pattern', { id: 'food', width: 14, height: 14, patternUnits: 'userSpaceOnUse' });
    pat.append(S('rect', { width: 14, height: 14, fill: meal.pet.color }), S('circle', { cx: 4, cy: 4, r: 2.3, fill: meal.pet.dot, opacity: 0.8 }), S('circle', { cx: 11, cy: 10, r: 1.8, fill: meal.pet.dot, opacity: 0.8 }));
    const hatch = S('pattern', { id: 'hatch', width: 10, height: 10, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' });
    hatch.append(S('rect', { width: 10, height: 10, fill: meal.pet.color }), S('rect', { width: 4, height: 10, fill: '#FFFFFF', opacity: 0.45 }));
    defs.append(pat, hatch);
    svg.append(defs);
    jarRefs = [];
    for (let j = 0; j < n; j++) {
      const x = PADX + j * (JW + GAP);
      const clip = S('clipPath', { id: 'jar' + j });
      clip.append(S('rect', { x: x, y: TOP, width: JW, height: JH, rx: 14 }));
      defs.append(clip);
      svg.append(S('rect', { x: x, y: TOP, width: JW, height: JH, rx: 14, fill: '#F2F8FF' }));
      const inside = S('g', { 'clip-path': 'url(#jar' + j + ')' });
      const gF = S('g', { class: 'fillg' }), gP = S('g', { class: 'fillg' });
      gF.append(S('rect', { x: x, y: TOP, width: JW, height: JH + 40, fill: 'url(#food)' }));
      gP.append(S('rect', { x: x, y: TOP, width: JW, height: JH + 40, fill: 'url(#hatch)' }));
      inside.append(gF, gP);
      svg.append(inside);
      const ticks = S('g');
      svg.append(ticks);
      svg.append(S('rect', { x: x, y: TOP, width: JW, height: JH, rx: 14, fill: 'none', stroke: INK, 'stroke-width': 3 }));
      svg.append(S('path', { d: 'M' + (x + 13) + ',' + (TOP + 13) + ' L' + (x + 13) + ',' + (TOP + 54), stroke: '#fff', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.7 }));
      const top = S('text', { x: x + JW / 2, y: TOP - 8, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 600, fill: INK, 'font-family': 'Lexend, sans-serif' });
      top.textContent = 'full = 1 cup';
      const bot = S('text', { x: x + JW / 2, y: TOP + JH + 24, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, fill: INK, 'font-family': 'Lexend, sans-serif' });
      bot.textContent = n > 1 ? 'cup ' + (j + 1) : 'the bowl';
      svg.append(top, bot);
      jarRefs.push({ x, gF, gP, ticks });
    }
    svg.append(S('g', { id: 'guide' }));
    tickDen = -1;
    setFill(true);
  }
  // Lines for equal parts appear once a cup is chosen (or food is already in the bowl)
  let tickDen = -1;
  function drawTicks() {
    const d = chosenCup() || meal.prefillDen || 0;
    if (d === tickDen) return;
    tickDen = d;
    jarRefs.forEach(jr => {
      jr.ticks.replaceChildren();
      for (let m = 1; m < d; m++) {
        const y = TOP + JH - m / d * JH;
        jr.ticks.append(S('line', { x1: jr.x, x2: jr.x + JW, y1: y, y2: y, stroke: INK, 'stroke-width': 1.2, opacity: 0.22 }));
        jr.ticks.append(S('line', { x1: jr.x, x2: jr.x + 14, y1: y, y2: y, stroke: INK, 'stroke-width': 2.4 }));
        jr.ticks.append(S('line', { x1: jr.x + JW - 14, x2: jr.x + JW, y1: y, y2: y, stroke: INK, 'stroke-width': 2.4 }));
      }
    });
  }
  function setFill(instant) {
    const t = total();
    jarRefs.forEach((jr, j) => {
      const f = clamp(t - j * U, 0, U) / U, pf = clamp(meal.prefill - j * U, 0, U) / U;
      if (instant) [jr.gF, jr.gP].forEach(g => { g.style.transition = 'none'; void g.getBBox(); });
      jr.gF.style.transform = 'translateY(' + ((1 - f) * JH) + 'px)';
      jr.gP.style.transform = 'translateY(' + ((1 - pf) * JH) + 'px)';
      if (instant) requestAnimationFrame(() => { jr.gF.style.transition = ''; jr.gP.style.transition = ''; });
    });
  }
  function yFor(u) {
    let j = Math.floor(u / U);
    if (u > 0 && u % U === 0) j--;
    j = clamp(j, 0, jarRefs.length - 1);
    return { j, y: TOP + JH - (u - j * U) / U * JH };
  }
  function showGuide() {
    const g = $('#guide');
    if (!g) return;
    g.replaceChildren();
    if (meal.times) {
      const colors = ['#D2448A', '#2D76B5'];
      for (let s = 0; s < meal.crew; s++) {
        const from = s * meal.share, to = (s + 1) * meal.share;
        for (let j = 0; j < jarRefs.length; j++) {
          const a = clamp(from - j * U, 0, U), b = clamp(to - j * U, 0, U);
          if (b <= a) continue;
          const x = jarRefs[j].x + JW + 4;
          const y1 = TOP + JH - b / U * JH, y2 = TOP + JH - a / U * JH;
          g.append(S('rect', { x: x, y: y1 + 1, width: 8, height: Math.max(2, y2 - y1 - 2), rx: 3, fill: colors[s % 2] }));
          if (y2 - y1 > 16) {
            const t = S('text', { x: x + 17, y: (y1 + y2) / 2 + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, fill: colors[s % 2], 'font-family': 'Lexend, sans-serif' });
            t.textContent = String(s + 1);
            g.append(t);
          }
        }
      }
    }
    const { j, y } = yFor(meal.target);
    const x = jarRefs[j].x;
    g.append(S('line', { x1: x - 6, x2: x + JW + 6, y1: y, y2: y, stroke: '#D2448A', 'stroke-width': 4, 'stroke-dasharray': '9 6', 'stroke-linecap': 'round' }));
    g.append(S('rect', { x: x - 32, y: y - 12, width: 44, height: 22, rx: 11, fill: '#FFE9F2', stroke: '#D2448A', 'stroke-width': 2 }));
    const t = S('text', { x: x - 10, y: y + 5, 'text-anchor': 'middle', 'font-size': 13, 'font-weight': 800, fill: '#A8306C', 'font-family': 'Lexend, sans-serif' });
    t.textContent = 'goal';
    g.append(t);
  }

  /* ── The kitchen scale ── */

  function buildScale() {
    const svg = $('#bowlSvg');
    svg.replaceChildren();
    svg.setAttribute('viewBox', '30 44 380 184');
    svg.setAttribute('aria-label', 'Kitchen scale');
    svg.append(S('path', fill('#C9B8F2', { d: 'M70,160 L370,160 L352,224 L88,224 Z', 'stroke-width': 3 })));
    svg.append(S('rect', fill('#B3A0E6', { x: 208, y: 136, width: 24, height: 26, 'stroke-width': 3 })));
    svg.append(S('rect', fill('#20314A', { x: 154, y: 176, width: 132, height: 38, rx: 9, 'stroke-width': 3 })));
    svg.append(S('text', { id: 'readout', x: 220, y: 204, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800, fill: '#7CFFB2', 'font-family': 'Grandstander, Lexend, sans-serif' }));
    svg.append(S('ellipse', fill('#EEF2F8', { cx: 220, cy: 132, rx: 176, ry: 15, 'stroke-width': 3 })));
    svg.append(S('g', { id: 'pile' }));
    $('#pv').hidden = false;
    $('#pvNote').hidden = false;
    const pv = $('#pv');
    pv.replaceChildren();
    const head = (b, s) => { const h = el('div', 'h'); h.append(el('b', '', b), document.createTextNode(s)); return h; };
    pv.append(head('ones', '1 kg bags'), el('div', ''), head('tenths', '0.1 kg scoops'), head('hundredths', '0.01 kg pinches'));
    ['bag', 'pt', 'scoop', 'pinch'].forEach(k => {
      if (k === 'pt') { pv.append(el('div', 'pt', '.')); return; }
      const d = el('div', 'd', '0');
      d.id = 'pv-' + k;
      pv.append(d);
    });
  }
  function drawPile() {
    const c = counts(), g = $('#pile');
    g.replaceChildren();
    for (let i = 0; i < c.bag; i++) {
      const x = 62 + i * 60;
      g.append(S('path', fill('#E7C08A', { d: 'M' + (x + 6) + ',128 L' + (x + 2) + ',70 C' + (x + 8) + ',61 ' + (x + 48) + ',61 ' + (x + 54) + ',70 L' + (x + 50) + ',128 Z' })));
      g.append(S('path', { d: 'M' + (x + 13) + ',67 L' + (x + 28) + ',57 L' + (x + 43) + ',67', fill: 'none', stroke: INK, 'stroke-width': 2 }));
      const t = S('text', { x: x + 28, y: 104, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, fill: INK, 'font-family': 'Lexend, sans-serif' });
      t.textContent = '1 kg';
      g.append(t);
    }
    for (let i = 0; i < c.scoop; i++) {
      const cx = 196 + (i % 5) * 27, b = 129 - Math.floor(i / 5) * 15;
      g.append(S('path', fill(meal.pet.color, { d: 'M' + (cx - 13) + ',' + b + ' Q' + cx + ',' + (b - 26) + ' ' + (cx + 13) + ',' + b + ' Z', 'stroke-width': 1.8 })));
    }
    for (let i = 0; i < c.pinch; i++) {
      const cx = 336 + (i % 5) * 13, cy = 123 - Math.floor(i / 5) * 12;
      g.append(S('circle', fill(meal.pet.color, { cx, cy, r: 5.4, 'stroke-width': 1.5 })));
    }
    $('#readout').textContent = kgText(total()) + ' kg';
    ['bag', 'scoop', 'pinch'].forEach(k => {
      const d = $('#pv-' + k);
      d.textContent = String(c[k]);
      d.classList.toggle('over', c[k] > 9);
    });
    $('#pvNote').textContent = c.pinch > 9 ? c.pinch + ' hundredths! 10 hundredths make 1 tenth.'
      : c.scoop > 9 ? c.scoop + ' tenths! 10 tenths make 1 whole kilogram.' : '';
  }

  /* ── The shelf ── */

  function cupIcon(scale) {
    const svg = S('svg', { viewBox: '0 0 70 54', 'aria-hidden': 'true' });
    const g = S('g', { transform: 'translate(35,50) scale(' + scale + ') translate(-35,-50)' });
    g.append(S('path', fill('#D9CCF6', { d: 'M14,16 L56,16 L51,48 C50,51 47,52 44,52 L26,52 C23,52 20,51 19,48 Z', 'stroke-width': 2.5 })));
    g.append(S('path', { d: 'M56,22 C66,22 68,36 58,38', fill: 'none', stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }));
    g.append(S('ellipse', fill('#EFE9FA', { cx: 35, cy: 16, rx: 21, ry: 4.5, 'stroke-width': 2.5 })));
    svg.append(g);
    return svg;
  }
  function kgIcon(key) {
    const svg = S('svg', { viewBox: '0 0 70 54', 'aria-hidden': 'true' });
    if (key === 'bag') {
      svg.append(S('path', fill('#E7C08A', { d: 'M18,50 L15,14 C20,8 50,8 55,14 L52,50 Z', 'stroke-width': 2.5 })));
      svg.append(S('path', { d: 'M24,12 L35,5 L46,12', fill: 'none', stroke: INK, 'stroke-width': 2.5 }));
    } else if (key === 'scoop') {
      svg.append(S('path', fill(meal.pet.color, { d: 'M14,46 Q35,10 56,46 Z', 'stroke-width': 2.5 })));
    } else {
      [[27, 40], [40, 38], [34, 30]].forEach(([cx, cy]) => svg.append(S('circle', fill(meal.pet.color, { cx, cy, r: 5.5, 'stroke-width': 2 }))));
    }
    return svg;
  }
  let shelfItems = [];
  function buildShelf() {
    const shelf = $('#shelf');
    shelf.replaceChildren();
    shelf.classList.toggle('kg', L.kind === 'kg');
    $('#shelfTitle').textContent = L.kind === 'kg' ? 'Weights' : (meal.whole ? 'Measuring cups: one fraction size per meal' : 'Measuring cups: one size per meal');
    shelfItems = L.kind === 'kg'
      ? [{ key: 'bag', amt: '1 kg', sub: '1 kg bag' }, { key: 'scoop', amt: '0.1 kg', sub: '1/10 kg scoop' }, { key: 'pinch', amt: '0.01 kg', sub: '1/100 kg pinch' }]
      : (meal.whole ? [1] : []).concat(meal.cups).map(d => ({ key: d, amt: d === 1 ? '1' : '1/' + d, sub: 'cup' }));
    shelfItems.forEach((it, i) => {
      const b = el('button', 'scoop');
      b.type = 'button';
      b.dataset.key = String(it.key);
      const amt = el('span', 'amt');
      amt.append(L.kind === 'kg' ? el('span', '', it.amt) : fracNode(it.amt));
      if (L.kind === 'kg' || it.key === 1) amt.append(el('span', 'sub', L.kind === 'kg' ? it.sub : 'cup'));
      b.append(L.kind === 'kg' ? kgIcon(it.key) : cupIcon(it.key === 1 ? 1 : 0.55 + 0.45 / Math.sqrt(it.key)), amt);
      b.setAttribute('aria-label', (it.key === meal.gone ? 'In the dishwasher: ' : 'Add ') + speakable(L.kind === 'kg' ? it.sub : it.amt + ' cup') + ' (key ' + (i + 1) + ')');
      b.addEventListener('click', () => { b.blur(); addScoop(it.key, b); });
      it.btn = b;
      shelf.append(b);
    });
  }
  // Which shelf items can be used right now, and why not
  function cupState(key) {
    if (L.kind === 'kg') return phaseName === 'scoop' ? (counts()[key] >= { bag: 2, scoop: 19, pinch: 19 }[key] ? 'full' : 'ok') : 'off';
    if (key === meal.gone) return 'gone';
    if (phaseName !== 'scoop') return 'off';
    if (key === 1) return 'ok';
    const c = chosenCup();
    if (c && c !== key) return 'locked';
    if (meal.prefillDen && !sameFamily(key, meal.prefillDen)) return 'locked';
    return 'ok';
  }
  function paintShelf() {
    $('#shelf').classList.toggle('off', phaseName !== 'scoop');
    shelfItems.forEach(it => {
      const st = cupState(it.key);
      it.btn.disabled = st !== 'ok';
      it.btn.classList.toggle('locked', st === 'locked');
      it.btn.classList.toggle('full', st === 'full');
      it.btn.classList.toggle('gone', st === 'gone');
      it.btn.classList.toggle('chosen', L.kind !== 'kg' && it.key !== 1 && it.key === chosenCup());
    });
  }

  function addScoop(key, btn) {
    if (phaseName !== 'scoop' || cupState(key) !== 'ok') return;
    if (L.kind !== 'kg' && total() + U / key > capacity()) {
      tip("That scoop won't fit in the bowl. Pour one back, or use a smaller cup.");
      RealmFX.wrong();
      return;
    }
    added.push(key);
    if (btn) { btn.classList.remove('pouring'); void btn.offsetWidth; btn.classList.add('pouring'); }
    if (L.kind !== 'kg' && key !== 1 && added.filter(d => d !== 1).length === 1) {
      tip('You picked the 1/' + key + ' cup. To switch cups, pour all of its scoops back.');
    }
    refresh();
  }
  function undo() {
    if (phaseName !== 'scoop' || !added.length) return;
    added.pop();
    refresh();
  }

  /* ── The math under the bowl ── */

  function scoopTokens() {
    const tok = [];
    if (L.kind === 'kg') {
      describeScoops(added).split(' and ').forEach((p, i) => { if (added.length) { if (i) tok.push('+'); tok.push({ text: p, cls: 'word' }); } });
      return tok;
    }
    if (meal.prefill) tok.push(fracNode(cupText(meal.prefill, meal.prefillDen, true), 'pre'));
    const wholes = added.filter(d => d === 1).length, units = added.filter(d => d !== 1);
    const push = t => { if (tok.length) tok.push('+'); tok.push(t); };
    if (wholes > 3) push(wholes + ' × 1');
    else for (let w = 0; w < wholes; w++) push('1');
    if (units.length > 5) push(units.length + ' × 1/' + units[0]);
    else units.forEach(d => push('1/' + d));
    return tok;
  }
  function refresh() {
    const eq = $('#eq');
    eq.replaceChildren();
    if (meal.times) eq.append(mathLine([meal.crew, '×', meal.amt, '=', '?'], 'small'));
    if (!added.length && !meal.prefill) {
      eq.append(mathLine([{ text: L.kind === 'kg' ? 'The scale is empty.' : 'The bowl is empty.', cls: 'word' }]));
    } else {
      eq.append(mathLine(scoopTokens().concat(L.kind === 'kg' ? [] : ['='].concat(meal.showSum ? sumTokens(total()) : ['?']))));
    }
    if (L.kind === 'kg') drawPile(); else { drawTicks(); setFill(false); }
    paintShelf();
    syncData();
    if (phaseName === 'scoop') {
      controls([
        { label: 'Serve!', id: 'serveBtn', wide: true, disabled: !added.length, key: 'Enter', on: serve },
        { label: 'Pour one back', soft: true, disabled: !added.length, key: 'Backspace', on: undo },
        { label: 'Hint', soft: true, disabled: hinted || tries > 0, on: useHint },
      ]);
    } else if (phaseName === 'check') {
      controls([
        { label: 'Looks right: serve it', id: 'serveBtn', wide: true, on: serve },
        { label: 'Fix it', soft: true, id: 'fixBtn', on: startFix },
        { label: 'Hint', soft: true, disabled: hinted, on: useHint },
      ]);
    }
  }
  // The bowl's total, as the game writes it: "3/4", or "7/4 = 1 3/4"
  function sumTokens(t) {
    const D = bowlDen(), out = [cupText(t, D, true)];
    if (t > U && t % U) out.unshift(improper(t, D), '=');
    return out;
  }
  function startFix() {
    phaseName = 'scoop';
    fixedComet = true;
    caption('Fix Comet\'s bowl: pour scoops back or add more, then serve.', 'comet');
    tip('');
    refresh();
  }
  function useHint() {
    hinted = true;
    caption(meal.hintText);
    if (L.kind !== 'kg') showGuide();
    refresh();
  }

  /* ── Serving ── */

  function servedText() {
    return L.kind === 'kg' ? kgText(total()) : cupText(total(), bowlDen());
  }
  function needText() {
    if (meal.times) return 'The ' + meal.pet.plural + ' need ' + meal.times + ' cups';
    if (L.kind === 'kg') return meal.pet.name + ' needs ' + (meal.form === 'sum' ? meal.amt.replace(' + ', ' kg + ') : meal.amt) + ' kg';
    return meal.pet.name + ' needs ' + meal.amt + ' ' + meal.unit;
  }
  function feedback() {
    const t = total(), diff = Math.abs(t - meal.target), more = t < meal.target;
    if (L.kind === 'kg') {
      let s = 'The scale says ' + kgText(t) + ' kg. ' + needText();
      if (meal.form !== 'dec') s += ', which is ' + kgText(meal.target) + ' kg';
      return s + ". That's " + kgText(diff) + ' kg too ' + (more ? 'little' : 'much') + '.';
    }
    const D = bowlDen();
    let s = 'You served ' + cupText(t, D, true) + ' ' + cupWord(t) + '. ' + needText();
    if (fits(meal.target, D)) {
      const inD = cupText(meal.target, D, true);
      if (inD !== meal.amt) s += ', which is ' + inD + ' ' + cupWord(meal.target);
      return s + ". That's " + cupText(diff, D) + ' ' + cupWord(diff) + ' too ' + (more ? 'little' : 'much') + '.';
    }
    const need = meal.target - meal.prefill, rem = need - (meal.whole ? Math.floor(need / U) * U : 0);
    const work = meal.cups.filter(c => c !== meal.gone && fits(rem, c));
    s += '. ' + cap(DEN_WORD[D][1]) + " can't make that amount exactly.";
    if (work.length) s += ' Try ' + (work.length === 1 ? 'the 1/' + work[0] + ' cup.' : 'a cup like the ' + work.slice(0, 2).map(c => '1/' + c).join(' or the ') + ' cup.');
    return s;
  }
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  // The finished equation, shown once the meal is served
  function revealLines(t) {
    const eq = $('#eq');
    eq.replaceChildren();
    if (L.kind === 'kg') {
      const c = counts(), parts = [];
      if (c.bag) parts.push(c.bag + ' kg');
      if (c.scoop) parts.push(c.scoop + (c.scoop > 1 ? ' tenths' : ' tenth'));
      if (c.pinch) parts.push(c.pinch + (c.pinch > 1 ? ' hundredths' : ' hundredth'));
      const tok = [];
      parts.forEach((p, i) => { if (i) tok.push('+'); tok.push({ text: p, cls: 'word' }); });
      eq.append(mathLine(tok.concat(['=', kgText(t), { text: 'kg', cls: 'word' }])));
      const fr = [kgText(t), { text: 'kg', cls: 'word' }, '=', kgFrac(t), { text: 'kg', cls: 'word' }];
      if (meal.form === 'sum') fr.push('=', Math.floor(meal.target / 10) + '/10', '+', (meal.target % 10) + '/100');
      if (t % 10 === 0 && t < 100) fr.push('=', t + '/100');
      eq.append(mathLine(fr, 'small'));
      return;
    }
    const D = bowlDen();
    const tok = scoopTokens().concat(['=', cupText(t, D, true)]);
    if (t > U && t % U) tok.push('=', improper(t, D));
    if (t === meal.target && !meal.times && meal.cardDen !== D) tok.push('=', meal.amt);
    eq.append(mathLine(tok));
    if (meal.times && t === meal.target) {
      const ln = [meal.times, '=', improper(t, meal.cardDen)];
      if (t % U === 0 || t > U) ln.push('=', cupText(t, meal.cardDen));
      eq.append(mathLine(ln, 'small'));
    } else if (t === meal.target && (meal.form === 'words' || meal.form === 'bar' || (meal.improper && t > U))) {
      eq.append(mathLine([meal.form === 'words' ? { text: amtWords(meal.amt) + ' =', cls: 'word' } : { text: 'the card:', cls: 'word' }, meal.amt,
        meal.improper ? '=' : '', meal.improper ? cupText(t, meal.cardDen) : ''].filter(x => x !== ''), 'small'));
    }
  }

  function serve() {
    if (!(phaseName === 'scoop' || phaseName === 'check') || !added.length) return;
    if (L.kind === 'cups' && !meal.showSum) { askSum(); return; }
    judge(null);
  }

  /* ── Adding it up: the student types how much is in the bowl ── */

  function askSum(again) {
    phaseName = 'sum';
    const eq = $('#eq');
    eq.replaceChildren();
    if (meal.times) eq.append(mathLine([meal.crew, '×', meal.amt, '=', '?'], 'small'));
    const box = el('span', 'sumbox');
    const input = (cls, label) => {
      const i = el('input', cls);
      i.type = 'text'; i.inputMode = 'numeric'; i.autocomplete = 'off'; i.maxLength = 2;
      i.setAttribute('aria-label', label);
      return i;
    };
    const fields = [];
    if (L.whole) { const w = input('sum-whole', 'Whole cups (leave empty if none)'); box.append(w); fields.push(w); }
    const fr = el('span', 'sum-frac');
    const top = input('sum-top', 'Top number'), bot = input('sum-bot', 'Bottom number');
    fr.append(top, el('span', 'sum-bar'), bot);
    box.append(fr);
    fields.push(top, bot);
    fields.forEach((f, i) => f.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); checkSum(); }
      else if (e.key === '/' || e.key === 'ArrowDown' && f === top) { e.preventDefault(); bot.focus(); }
      else if (e.key === 'ArrowUp' && f === bot) { e.preventDefault(); top.focus(); }
      else if (e.key === 'Backspace' && !f.value && i > 0) { e.preventDefault(); fields[i - 1].focus(); }
      else if (e.key.length === 1 && !/\d/.test(e.key)) e.preventDefault();
    }));
    eq.append(mathLine(scoopTokens().concat(['=', box])));
    paintShelf();
    syncData();
    if (!again) {
      const intro = !sumIntroDone;
      sumIntroDone = true;
      caption((intro ? 'Now you add it up! ' : '') + (meal.comet && !fixedComet ? "Add up Comet's scoops. " : '') +
        'How much is in the bowl? Type the fraction' + (L.whole ? ' (put whole cups in the first box)' : '') + ', then press Check.', meal.comet ? 'comet' : '');
    }
    tip('Type the top number, press / for the bottom number, then Enter.');
    controls([
      { label: 'Check', id: 'checkBtn', wide: true, key: 'Enter', on: checkSum },
      { label: 'Back to scooping', soft: true, id: 'backBtn', on: backToScoop },
      { label: 'Hint', soft: true, disabled: sumHinted || tries > 0, on: sumHint },
    ]);
    (L.whole && added.some(d => d === 1) ? fields[0] : top).focus();
  }
  function backToScoop() {
    phaseName = 'scoop';
    if (meal.comet) fixedComet = true;
    caption(meal.comet ? 'Fix Comet\'s bowl: pour scoops back or add more, then serve.' : 'Change your scoops, then serve again.', meal.comet ? 'comet' : '');
    tip('');
    refresh();
  }
  function sumHint() {
    sumHinted = true; hinted = true;
    const c = chosenCup();
    caption('Add the top numbers. The bottom number stays the same, because ' + (c ? 'every scoop is 1/' + c + ' cup' : 'the parts are all the same size') + '.' +
      (added.some(d => d === 1) ? ' Each 1 cup scoop is one whole cup.' : ''));
    askSum(true);
  }

  // How the bowl adds up, in words a 4th grader can follow
  function sumExplain() {
    const t = total(), D = bowlDen(), c = chosenCup();
    const wholes = added.filter(d => d === 1).length;
    const tops = [];
    if (meal.prefill) tops.push(Math.round(meal.prefill * D / U));
    added.filter(d => d !== 1).forEach(d => tops.push(D / d));
    const n = tops.reduce((a, b) => a + b, 0);
    let s = '';
    if (c && c !== D) s += 'Each 1/' + c + ' scoop is ' + (D / c) + '/' + D + '. ';
    if (tops.length === 1) {
      s += 'The fraction part is ' + tops[0] + '/' + D + '. ';
    } else if (tops.length) {
      s += tops.length > 6 ? tops.length + ' scoops of 1/' + D + ' make ' + n + '/' + D + '. '
        : 'Add the top numbers: ' + tops.join(' + ') + ' = ' + n + '. The bottom number stays ' + D + '. ';
    }
    if (wholes) s += 'Plus ' + wholes + (wholes > 1 ? ' whole cups. ' : ' whole cup. ');
    const fracPart = n ? n + '/' + D : '';
    if (wholes && n) s += wholes + ' + ' + fracPart + ' = ' + cupText(t, D) + '. ';
    s += 'The bowl has ' + cupText(t, D, true) + ' ' + cupWord(t) + (t > U && t % U ? ' (that is ' + improper(t, D) + ')' : '') + '.';
    return s;
  }
  function addingMistake(W, n, d) {
    const D = bowlDen(), terms = added.filter(x => x !== 1).length + (meal.prefill ? 1 : 0);
    if (d && d !== D && terms > 1 && (d === D * terms || d === added.filter(x => x !== 1).reduce((a, x) => a + x, 0) + (meal.prefillDen || 0))) {
      return "Watch out: don't add the bottom numbers! When you add " + DEN_WORD[D][1] + ', the parts are still ' + DEN_WORD[D][1] + '. ';
    }
    if (d === D) return 'Count the scoops again. ';
    return '';
  }

  function checkSum() {
    if (phaseName !== 'sum') return;
    const val = cls => { const f = document.querySelector('#eq .' + cls); return f && f.value.trim() !== '' ? Number(f.value) : null; };
    const W = val('sum-whole') || 0, n = val('sum-top'), d = val('sum-bot');
    if (n === null && d === null && !W) { tip('Type how much is in the bowl first.'); return; }
    if ((n !== null && d === null) || d === 0) { tip('Type the bottom number too.'); document.querySelector('#eq .sum-bot').focus(); return; }
    if (n === null && d !== null) { tip('Type the top number too.'); document.querySelector('#eq .sum-top').focus(); return; }
    const t = total();
    const typed = (W ? W + (n ? ' ' : '') : '') + (n !== null && n !== 0 ? n + '/' + d : (W ? '' : '0'));
    const equal = n === null ? W * U === t : (W * d + n) * U === t * d;
    if (equal) { judge(typed || String(W), d || 0); return; }
    // The adding was off
    RealmFX.wrong();
    const why = addingMistake(W, n, d);
    if (tries === 0) {
      tries = 1;
      caption(why + 'That doesn\'t match the bowl. ' + (why ? '' : 'Look at the scoops and add again. ') + 'Try again!', 'bad');
      askSum(true);
      return;
    }
    results.push({ first: false });
    round.record({ prompt: meal.prompt, answer: typed + ' (bowl ' + servedText() + ')', correct: false, hintUsed: true });
    if (meal.comet && !meal.comet.right) cometWrong++;
    if (t === meal.target) {
      feed(false, why + sumExplain() + " That's just right for " + (meal.crew > 1 ? 'the ' + meal.pet.plural : meal.pet.name) + '!');
    } else {
      fixTogether(why + sumExplain() + ' ' + feedback());
    }
  }

  // Judge the amount in the bowl (typed = what the student wrote, if they added it up)
  async function judge(typed, typedDen) {
    const t = total(), right = t === meal.target;
    lastTyped = typed ? { text: typed, den: typedDen || bowlDen() } : null;
    if (right) {
      const first = tries === 0 && !hinted;
      results.push({ first });
      round.record({ prompt: meal.prompt, answer: typed || servedText(), correct: true, hintUsed: !first });
      if (meal.comet && !meal.comet.right) { cometWrong++; if (first) { caught++; memory.caught = (memory.caught || 0) + 1; } }
      await feed(true);
      return;
    }
    RealmFX.wrong();
    petMood('unsure');
    const slipped = meal.comet && !meal.comet.right && !fixedComet;
    const said = typed ? 'Yes, the bowl has ' + typed + ' ' + cupWord(t) + '. ' : '';
    if (tries === 0) {
      tries = 1;
      phaseName = 'scoop';
      caption((slipped ? "Uh-oh, Comet's mistake slipped by! " : '') + said + feedback() + ' ' + meal.hintText + ' Fix the bowl and serve again!', 'bad');
      if (L.kind !== 'kg') showGuide();
      refresh();
      return;
    }
    results.push({ first: false });
    round.record({ prompt: meal.prompt, answer: typed || servedText(), correct: false, hintUsed: true });
    if (meal.comet && !meal.comet.right) cometWrong++;
    await fixTogether(said + feedback());
  }
  async function fixTogether(text) {
    phaseName = 'fixing';
    controls([]);
    paintShelf();
    caption(text + " Let's fix it together.", 'bad');
    await wait(1900);
    added = fixScoops();
    lastTyped = null;
    refresh();
    await feed(false);
  }
  let lastTyped = null;

  function fixScoops() {
    if (L.kind === 'kg') return cometRight(meal);
    const need = meal.target - meal.prefill;
    const dens = meal.cups.filter(c => c !== meal.gone && (!meal.prefillDen || sameFamily(c, meal.prefillDen)));
    return plainScoops(need, meal.cardDen, dens, meal.whole);
  }
  function fixSentence() {
    if (L.kind === 'kg') {
      return (meal.form === 'sum' ? meal.amt.replace(' + ', ' kg + ') : meal.amt) + ' kg = ' + kgText(meal.target) + ' kg, so use ' + describeScoops(cometRight(meal)) + '.';
    }
    let start = meal.times ? meal.times + ' = ' + improper(meal.target, meal.cardDen) + ' = ' + cupText(meal.target, meal.cardDen) + ' cups' : meal.amt + ' ' + meal.unit;
    if (meal.improper) start += ' = ' + cupText(meal.target, meal.cardDen) + ' cups';
    const c = fixScoops().find(d => d !== 1);
    if (!meal.times && !meal.improper && c && c !== meal.cardDen && fits(meal.target, c) && meal.target <= U) start += ' = ' + cupText(meal.target, c, true) + ' cup';
    return start + (meal.prefill ? '. With ' + cupText(meal.prefill, meal.prefillDen) + ' already in the bowl, add ' : ', so use ') + describeScoops(fixScoops()) + '.';
  }

  // Served 6/8 for a 3/4 card? Same amount, different name: show why (4.NF.1).
  function equivAssist() {
    if (L.kind !== 'cups') return null;
    const D = lastTyped && lastTyped.den ? lastTyped.den : bowlDen(), C = meal.cardDen, t = meal.target;
    if (!D || D === C || !sameFamily(D, C) || !fits(t, D) || !fits(t, C)) return null;
    const lo = Math.min(D, C), hi = Math.max(D, C), f = hi / lo;
    const kLo = Math.round(t * lo / U), kHi = Math.round(t * hi / U);
    const served = cupText(t, D, true), card = meal.times ? cupText(t, C, true) : meal.amt;
    const sentence = served + ' = ' + card + '! The same amount, with a different name: every ' +
      (f === 2 ? 'two' : f === 3 ? 'three' : f === 4 ? 'four' : f) + ' ' + DEN_WORD[hi][1] + ' fill the same space as 1 ' + DEN_WORD[lo][0] + '.';
    return { lo, hi, f, kLo, kHi, sentence };
  }
  function fracBox(top, bot) {
    const f = el('span', 'sf');
    f.append(el('span', 't', top), el('span', 'b', bot));
    return f;
  }
  function showEquiv(a) {
    $('#eq').append(mathLine([a.kLo + '/' + a.lo, '=', fracBox(a.kLo + ' × ' + a.f, a.lo + ' × ' + a.f), '=', a.kHi + '/' + a.hi], 'small'));
    const g = $('#guide');
    if (!g) return;
    g.replaceChildren();
    const other = tickDen === a.hi ? a.lo : a.hi;          // draw the lines the bowl isn't showing yet
    jarRefs.forEach(jr => {
      for (let m = 1; m < other; m++) {
        const y = TOP + JH - m / other * JH;
        g.append(S('line', { x1: jr.x - 5, x2: jr.x + JW + 5, y1: y, y2: y, stroke: '#D2448A', 'stroke-width': 3.5, 'stroke-dasharray': other === a.lo ? '' : '6 5', 'stroke-linecap': 'round' }));
      }
    });
    const lbl = S('text', { x: jarRefs[0].x + JW / 2, y: TOP + JH + 24, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, fill: '#A8306C', 'font-family': 'Lexend, sans-serif' });
    lbl.textContent = 'pink lines: ' + DEN_WORD[other][1];
    g.append(S('rect', { x: jarRefs[0].x - 14, y: TOP + JH + 8, width: JW + 28, height: 24, fill: '#FFFFFF' }), lbl);
  }

  async function feed(firstRight, message) {
    phaseName = 'eating';
    controls([]);
    paintShelf();
    revealLines(meal.target);
    const eqv = equivAssist();
    if (eqv) showEquiv(eqv);
    syncData();
    happy++;
    $('#happyCount').textContent = String(happy);
    const who = meal.crew > 1 ? 'The ' + meal.pet.plural + ' are' : meal.pet.name + ' is';
    if (firstRight) {
      RealmFX.correct();
      let msg;
      if (meal.comet && !meal.comet.right && tries === 0 && !hinted) { msg = 'You caught Comet\'s mistake! ' + meal.comet.why; RealmFX.fanfare(); }
      else if (meal.comet && meal.comet.right && !fixedComet && !hinted) msg = 'Comet got it right this time, and you checked carefully.';
      else msg = hinted || tries ? 'Yes! You fixed it.' : pick(['Perfect portion!', 'Exactly right!', 'Yum, just right!', 'Chef-level measuring!']);
      caption(msg + ' ' + (eqv ? eqv.sentence + ' ' : '') + who + ' happy and full.', 'good');
    } else if (message) {
      caption(message + (eqv ? ' ' + eqv.sentence : ''), 'good');
    } else {
      caption('Here is the right amount: ' + fixSentence() + (meal.comet && !meal.comet.right ? ' ' + meal.comet.why : '') + ' Nobody goes hungry here!', 'good');
    }
    petMood('happy');
    await wait(firstRight ? 900 : 1400);
    if (L.kind !== 'kg' && !eqv) {      // keep the food in the bowl while the pink lines are showing
      const g = $('#guide'); if (g) g.replaceChildren();
      jarRefs.forEach(jr => { jr.gF.classList.add('slow'); jr.gP.classList.add('slow'); jr.gF.style.transform = jr.gP.style.transform = 'translateY(' + JH + 'px)'; });
    }
    phaseName = 'fed';
    syncData();
    tip('Press Enter for the next pet.');
    controls([{ label: idx + 1 < queue.length ? 'Next pet' : 'Close the café', id: 'nextBtn', wide: true, key: 'Enter', on: nextPet }]);
  }

  /* ── Keyboard: number keys pick cups, Backspace pours back, Enter serves or continues ── */

  document.addEventListener('keydown', e => {
    if ($('#play').hidden || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target && e.target.tagName === 'BUTTON' && (e.key === 'Enter' || e.key === ' ')) return;   // let the focused button work
    if (e.target && e.target.tagName === 'INPUT') return;                                             // the sum boxes handle their own keys
    if (/^[1-9]$/.test(e.key) && phaseName === 'scoop') {
      const it = shelfItems[Number(e.key) - 1];
      if (it) { e.preventDefault(); addScoop(it.key, it.btn); }
      return;
    }
    const act = keyActions[e.key === 'Delete' ? 'Backspace' : e.key];
    if (act) { e.preventDefault(); act(); }
  });

  /* ── Demos: shown the first time, replayable from the start screen ── */

  function demoScript() {
    const P = id => RealmSprites.critter(id) || PETS[0];
    const m = (pet, extra) => base(pet, Object.assign({ food: 'of ' + pet.food, showSum: true }, extra));
    const s = (say, act) => ({ say, act });
    if (skillId === 'g4.frac.build') {
      const pet = P('bunbun');
      return { meal: m(pet, { k: 3, d: 4, target: 18, amt: '3/4', unit: 'cup', cardDen: 4, jars: 1, who: pet.name + ' needs' }), steps: [
        s('Bun-bun needs 3/4 cup. The bottom number, 4, means a cup split into 4 equal parts. The top number, 3, means 3 of those parts.', () => showGuide()),
        s('Pick the cup that makes fourths: the 1/4 cup. Each scoop fills exactly one part. (The 1/3 cup makes thirds, which are the wrong size.)', () => glow(4)),
        s('One scoop: 1/4 cup.', () => demoAdd(4)),
        s('Two scoops: 2/4 cup.', () => demoAdd(4)),
        s('Three scoops: 3/4 cup. That reaches the goal line!', () => demoAdd(4)),
        s('Add it up: 1/4 + 1/4 + 1/4. Add the top numbers: 1 + 1 + 1 = 3. The bottom number stays 4, because every scoop is a fourth. So the bowl has 3/4!', () => {}),
        s('Serve! Soon you will add up the scoops and type the answer yourself. Cards will show amounts in words or pictures too, and Comet will scoop some bowls for you to check.', () => demoServe()),
      ] };
    }
    if (skillId === 'g4.frac.equiv') {
      const pet = P('pip');
      return { meal: m(pet, { k: 2, d: 4, target: 12, amt: '2/4', unit: 'cup', cardDen: 4, gone: 4, jars: 1, who: pet.name + ' needs', note: 'Oh no, the 1/4 cup is in the dishwasher!' }), steps: [
        s('Pip needs 2/4 cup, but the 1/4 cup is in the dishwasher. Which other cup can make 2/4?', () => showGuide()),
        s('Two 1/8 scoops fill the same space as one 1/4 scoop. So 2/4 is 2 groups of two eighths: 4/8.', () => glow(8)),
        s('Scoop, scoop…', () => { demoAdd(8); demoAdd(8); }),
        s('…scoop, scoop. Four scoops of 1/8 cup.', () => { demoAdd(8); demoAdd(8); }),
        s('Add the top numbers: 1 + 1 + 1 + 1 = 4. They are eighths, so the bowl has 4/8. And 4/8 = 2/4, the same amount!', () => {}),
        s('Serve! The 1/2 cup would work too, in one scoop, because 2/4 = 1/2. Any cup that makes the right amount is fine.', () => demoServe()),
      ] };
    }
    if (skillId === 'g4.frac.mixed') {
      const pet = P('miso');
      return { meal: m(pet, { k: 7, d: 4, W: 1, r: 3, target: 42, amt: '7/4', unit: 'cups', cardDen: 4, jars: 2, improper: true,
        who: pet.name + ' needs' }), steps: [
        s('Miso needs 7/4 cups. That is 7 fourths, more than 1 whole cup!', () => showGuide()),
        s('4 fourths fill 1 whole cup. So 7/4 = 4/4 + 3/4 = 1 3/4 cups.', () => glow(4)),
        s('Scoop 4 fourths: 1/4 + 1/4 + 1/4 + 1/4 = 4/4. The first cup is full!', () => { for (let i = 0; i < 4; i++) demoAdd(4); }),
        s('3 more fourths: 7 fourths in all. 7/4 = 1 3/4.', () => { for (let i = 0; i < 3; i++) demoAdd(4); }),
        s('Serve! The 1 cup scoop is a shortcut: 1 + 1/4 + 1/4 + 1/4 is the same amount. Either way works.', () => demoServe()),
      ] };
    }
    if (skillId === 'g4.frac.times') {
      const pet = P('miso');
      return { meal: m(pet, { crew: 3, d: 3, a: 2, N: 6, share: 16, target: 48, amt: '2/3', unit: 'cup', cardDen: 3, jars: 3, times: '3 × 2/3',
        who: '3 ' + pet.plural + ' each need', note: 'Fill one big bowl with enough for all 3.' }), steps: [
        s('3 kittens each need 2/3 cup. That is 3 × 2/3: three groups of 2/3.', () => showGuide()),
        s('2/3 + 2/3 + 2/3 = 6/3. The colored marks show each kitten\'s share.', () => {}),
        s('So we need 6 scoops of the 1/3 cup.', () => { glow(3); for (let i = 0; i < 6; i++) demoAdd(3); }),
        s('6/3 is 6 thirds. 3 thirds fill 1 whole cup, so 6/3 = 2 cups.', () => {}),
        s('Serve! 3 × 2/3 = 6/3 = 2 cups.', () => demoServe()),
      ] };
    }
    const pet = P('shelly');
    return { meal: m(pet, { kind: 'kg', target: 35, amt: '35/100', form: 'frac', unit: 'kg', cardDen: 0, who: pet.name + ' needs' }), steps: [
      s('Shelly needs 35/100 kg. That is 35 hundredths of a kilogram.', () => {}),
      s('10 hundredths make 1 tenth. So 35 hundredths is 3 tenths and 5 hundredths.', () => glow('scoop')),
      s('3 scoops of 0.1 kg. Watch the tenths place.', () => { demoAdd('scoop'); demoAdd('scoop'); demoAdd('scoop'); }),
      s('5 pinches of 0.01 kg. Watch the hundredths place.', () => { for (let i = 0; i < 5; i++) demoAdd('pinch'); }),
      s('Serve! 3 tenths + 5 hundredths = 0.35 kg = 35/100 kg.', () => demoServe()),
    ] };
  }
  function glow(key) { shelfItems.forEach(it => it.btn.classList.toggle('glow', it.key === key)); }
  function demoAdd(key) { added.push(key); refresh(); }
  function demoServe() { glow(null); revealLines(meal.target); petMood('happy'); RealmFX.correct(); }

  function runDemo(done) {
    const d = demoScript();
    meal = d.meal; added = []; idx = -1; hinted = false; tries = 0; tickDen = -1;
    phaseName = 'demo';
    show('#play');
    $('#petTotal').textContent = PETS_PER_SHIFT;
    $('#happyCount').textContent = '0';
    setupMeal();
    refresh();
    tip('This is a demo. Watch, then it\'s your turn.');
    let i = 0;
    const finish = () => { glow(null); done(); };
    const step = () => {
      if (i >= d.steps.length) { finish(); return; }
      const st = d.steps[i++];
      st.act();
      caption(st.say);
      syncData();
      controls([
        { label: i < d.steps.length ? 'Next' : "I'm ready!", id: 'demoNext', wide: true, key: 'Enter', on: step },
        { label: 'Skip demo', soft: true, id: 'demoSkip', on: finish },
      ]);
    };
    step();
  }

  /* ── Closing time ── */

  async function endShift() {
    phaseName = 'over';
    syncData();
    RealmFX.fanfare();
    const firsts = results.filter(x => x.first).length;
    memory.fed = (memory.fed || 0) + queue.length;
    memory.seen[skillId] = true;
    memory.shifts[skillId] = (Number(memory.shifts[skillId]) || 0) + 1;
    $('#resTitle').textContent = firsts === results.length ? 'A perfect shift!' : 'The café is closed!';
    $('#resRight').textContent = firsts + ' of ' + results.length;
    $('#resCaught').textContent = cometWrong ? caught + ' of ' + cometWrong : 'none';
    $('#resCaught').nextElementSibling.textContent = cometWrong ? "of Comet's mistakes caught" : 'Comet made no mistakes this shift';
    $('#resGems').textContent = '…';
    $('#resGemsLabel').textContent = 'saving your shift';
    $('#resStars').replaceChildren();
    $('#resMsg').hidden = true;
    $('#resTicket').hidden = true;
    $('#againBtn').disabled = true;
    show('#done');
    const saves = [results.length ? round.finish() : Promise.resolve({ ok: false, error: 'no_attempts' })];
    if (memoryLoaded) saves.push(MathRealm.saveState(GAME_ID, memory));
    const [res] = await Promise.all(saves);
    showResult(res);
    $('#againBtn').disabled = false;
    $('#againBtn').focus();
  }

  function showResult(res) {
    const msg = $('#resMsg');
    msg.replaceChildren();
    const lineP = t => msg.append(el('p', '', t));
    if (res.guest) {
      // Guest mode: the shift was scored on this computer only.
      $('#resGems').textContent = '—';
      $('#resGemsLabel').textContent = 'guest mode';
      $('#resStars').replaceChildren();
      lineP('Nice work! Nothing is saved in guest mode, so no ' + C.pointsName + ' or stars yet.');
      lineP('Log in with your class code to start earning ' + C.pointsName + ', stars and golden tickets.');
      msg.hidden = false;
      return;
    }
    lineP('You have fed ' + memory.fed.toLocaleString() + ' pets at the Critter Café' + (memory.caught ? ' and caught ' + memory.caught + ' of Comet\'s mistakes.' : '.'));
    if (res.ok) {
      $('#resGems').textContent = '+' + res.points.total;
      $('#resGemsLabel').textContent = C.pointsName + ' (you have ' + Number(res.points.balance).toLocaleString() + ')';
      updateGems();
      const m = res.mastery, mastered = m.status === 'mastered';
      $('#resStars').replaceChildren(starRow(Math.min(m.days, m.daysNeeded), m.daysNeeded, mastered, m.newlyMastered || res.round.qualifies));
      if (m.newlyMastered) { lineP('You mastered ' + skill.name + '!'); RealmFX.confetti(); }
      else if (mastered) lineP('You already mastered this one. Great shift!');
      else if (res.round.qualifies) { lineP("This shift earned today's star!"); RealmFX.confetti(); }
      else lineP("For today's star, get " + Math.round(skill.minAccuracy * 100) + '% of the meals right on the first try with no hint.');
      if (res.ticket) {
        const wrap = $('#resTicket');
        const stub = el('div', 'ticket');
        stub.append(el('strong', '', res.ticket.code), el('span', '', res.ticket.skillName));
        wrap.replaceChildren(stub, el('p', '', 'A golden ticket! Show this code to your teacher to trade it for a prize.'));
        wrap.hidden = false;
        RealmFX.confetti();
      }
    } else if (res.queued) {
      $('#resGems').textContent = 'Saved';
      $('#resGemsLabel').textContent = 'on this computer';
      lineP('The internet dropped, so your shift is saved on this computer. It will send by itself when the internet is back.');
    } else {
      $('#resGems').textContent = '—';
      $('#resGemsLabel').textContent = 'not saved';
      lineP(MathRealm.errorMessage(res.error, true));
    }
    msg.hidden = !msg.childNodes.length;
  }
})();
