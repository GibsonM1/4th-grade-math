/*
 * Math Realm: Critter Café (fractions with measuring cups, decimals on a kitchen scale)
 *   pet-food.html?skill=g4.frac.build | g4.frac.equiv | g4.frac.mixed | g4.frac.times | g4.frac.kg
 *
 * A line of hungry pets each shows a meal card ("Bun-bun needs 3/4 cup of
 * berries"). The student scoops with measuring cups into a clear bowl marked
 * in equal parts, then presses Serve. The sum isn't shown until they serve,
 * so they have to reason about it rather than watch a number go up.
 *
 *   build   4.NF.3a/b  unit-fraction scoops make a fraction (3/4 = 1/4 + 1/4 + 1/4);
 *                      later cards have food already in the bowl (add the rest)
 *   equiv   4.NF.1     the matching cup is "in the dishwasher", so make 2/4 with 1/8 scoops
 *                      (or 6/8 with 1/4 scoops)
 *   mixed   4.NF.3b/c  more than a cup: 1 3/4 or 7/4 cups, with a 1 cup scoop
 *   times   4.NF.4     3 bunnies each need 2/3 cup: fill one bowl for all of them
 *   kg      4.NF.5-6, 4.MD.2   a kitchen scale: 35/100 kg = 0.35 kg, using
 *                      1 kg bags, 0.1 kg scoops and 0.01 kg pinches
 *
 * Every card stays on grade: one scoop size per fraction (plus the 1 cup), so
 * students never add unlike denominators (that's 5th grade). The equivalence
 * level converts between two sizes in the same family, which is 4.NF.1.
 *
 * Like the other games: right on the first try counts toward stars; right after
 * a hint (or the Hint button) earns gems but not stars. A second miss gets a
 * worked fix, and the pet eats anyway. Nobody goes hungry in the Critter Café.
 *
 * Cup amounts are whole numbers of 24ths (24 = 1 cup), which every scoop size
 * divides evenly. Scale amounts are whole numbers of hundredths of a kilogram.
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
  const U = 24;                     // one cup
  const LEVELS = {
    'g4.frac.build':  { kind: 'cups', make: makeBuild },
    'g4.frac.equiv':  { kind: 'cups', make: makeEquiv },
    'g4.frac.mixed':  { kind: 'cups', make: makeMixed },
    'g4.frac.times':  { kind: 'cups', make: makeTimes },
    'g4.frac.kg':     { kind: 'kg',   make: makeKg },
  };
  const DEN_WORD = { 2: ['half', 'halves'], 3: ['third', 'thirds'], 4: ['fourth', 'fourths'], 6: ['sixth', 'sixths'],
                     8: ['eighth', 'eighths'], 10: ['tenth', 'tenths'], 100: ['hundredth', 'hundredths'] };

  const session = MathRealm.session;
  const skillId = new URLSearchParams(location.search).get('skill') || '';
  const skill = (session.skills || []).find(k => k.skillId === skillId);
  const L = LEVELS[skillId];

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

  // An amount of food (in 24ths) written in a given denominator: "3/4", "1 3/4", "2", "0"
  // asFrac keeps a single cup as a fraction (4/4, not 1), for comparing with 8/8.
  function cupText(u, d, asFrac) {
    const k = Math.round(u * d / U), w = Math.floor(k / d), r = k % d;
    if (asFrac && k > 0 && k <= d) return k + '/' + d;
    if (!r) return String(w);
    return (w ? w + ' ' : '') + r + '/' + d;
  }
  const cupWord = u => u > U ? 'cups' : 'cup';
  // Kilograms from hundredths: 35 → "0.35", 40 → "0.4", 125 → "1.25"
  function kgText(h) {
    if (h % 100 === 0) return String(h / 100);
    return (h / 100).toFixed(h % 10 === 0 ? 1 : 2);
  }
  // Kilograms as a fraction: 35 → "35/100", 40 → "4/10", 125 → "1 25/100"
  function kgFrac(h) {
    const den = h % 10 === 0 ? 10 : 100, n = den === 10 ? h / 10 : h;
    const w = Math.floor(n / den), r = n % den;
    if (!r) return String(w);
    return (w ? w + ' ' : '') + r + '/' + den;
  }

  // "1 3/4" → stacked fractions on screen
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
  // A line of math: tokens are fractions/numbers (stacked) or plain symbols
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

  /* ── Reading aloud (helps the newest English learners) ── */

  const canSpeak = 'speechSynthesis' in window && C.readAloud !== false;
  function fracWords(n, d) {
    const w = DEN_WORD[d];
    if (!w) return n + ' over ' + d;
    return n + ' ' + (Number(n) === 1 ? w[0] : w[1]);
  }
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

  /* ── The pets: drawings live in js/sprites.js (shared with the Sprite Shop).
   *    Everyone has the five starters; critters adopted in the shop come to eat too. ── */

  const PETS = RealmSprites.cafeCritters(MathRealm.session);
  const petSvg = (pet, cls) => RealmSprites.critterSvg(pet, cls);
  // outline style for the bowls, scoops and scale drawn below
  const line = { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' };
  const fill = (f, extra) => Object.assign({ fill: f }, line, extra || {});

  /* ── Making meal cards ── */
  // Each card: { pet, crew, unit, amt (text), who, food, note, scoops [denominators; 1 = the 1 cup],
  //   tick, jars, prefill, target, hintText, prompt } (cups)
  // or { pet, unit: 'kg', amt, ..., target (hundredths), form, hintText, prompt } (kg)

  function phase(i, n) { return i < Math.ceil(n / 3) ? 0 : i < Math.ceil(2 * n / 3) ? 1 : 2; }

  function makeBuild(pet, i, n) {
    const ph = phase(i, n);
    const d = pick(ph === 0 ? [2, 4] : ph === 1 ? [3, 4, 6, 8] : [2, 3, 4, 6, 8]);
    // Mostly less than a cup; a full cup (4/4) now and then
    const k = Math.random() < 0.12 ? d : d === 2 ? 1 : rnd(2, d - 1);
    const target = k * U / d;
    let prefill = 0, note = '', hintText;
    if (ph === 2 && k >= 3 && Math.random() < 0.5) {
      const p = rnd(1, k - 1);
      prefill = p * U / d;
      note = p + '/' + d + ' cup is already in the bowl. Add the rest.';
      hintText = 'The bowl already has ' + p + '/' + d + ' cup. Count up by 1/' + d + ' from ' + p + '/' + d + ' until you reach ' + k + '/' + d + '.';
    } else {
      hintText = k + '/' + d + ' means ' + k + ' parts of a cup cut into ' + d + ' equal parts. Each 1/' + d + ' scoop fills one part. Look for the goal line.';
    }
    return { pet, crew: 1, unit: cupWord(target), amt: k + '/' + d, who: pet.name + ' needs', food: 'of ' + pet.food, note,
      scoops: [d], tick: d, jars: 1, prefill, target, cardDen: d, hintText,
      prompt: pet.name + ': ' + k + '/' + d + ' cup, 1/' + d + ' scoops' + (prefill ? ', ' + cupText(prefill, d) + ' already in' : '') };
  }

  function makeEquiv(pet, i, n) {
    const finer = [[2, 4], [2, 8], [4, 8], [3, 6], [2, 6]];
    const coarser = [[4, 2], [8, 4], [8, 2], [6, 3], [6, 2]];
    const useCoarse = i >= Math.ceil(n / 2) && Math.random() < 0.5;
    const [t, s] = pick(useCoarse ? coarser : finer);
    let k;
    if (useCoarse) {
      const f = t / s;
      k = f * (Math.random() < 0.1 ? s : rnd(1, Math.max(1, s - 1)));
    } else {
      k = Math.random() < 0.1 ? t : rnd(1, Math.max(1, t - 1));
    }
    const target = k * U / t;
    let hintText;
    if (useCoarse) {
      const f = t / s;
      hintText = f + '/' + t + ' cup is the same as 1/' + s + ' cup. How many groups of ' + f + '/' + t + ' make ' + k + '/' + t + '? Look for the goal line.';
    } else {
      const f = s / t;
      hintText = 'One 1/' + t + ' cup holds the same as ' + f + ' scoops of 1/' + s + ' cup. So ' + k + '/' + t + ' cup is ' + k + ' groups of ' + f + ' scoops.';
    }
    return { pet, crew: 1, unit: cupWord(target), amt: k + '/' + t, who: pet.name + ' needs', food: 'of ' + pet.food,
      note: 'Oh no, the 1/' + t + ' cup is in the dishwasher! Use the 1/' + s + ' cup.',
      scoops: [s], tick: s, jars: 1, prefill: 0, target, cardDen: t, hintText,
      prompt: pet.name + ': ' + k + '/' + t + ' cup using 1/' + s + ' scoops' };
  }

  function makeMixed(pet, i, n) {
    const ph = phase(i, n);
    const d = pick(ph === 0 ? [2, 4] : [2, 3, 4, 6, 8]);
    const W = ph === 0 ? 1 : rnd(1, 2), r = simplestR(d);    // 1 3/4, not 1 2/4
    const k = W * d + r, target = k * U / d;
    const improper = ph > 0 && k <= 20 && Math.random() < 0.4;
    const amt = improper ? k + '/' + d : W + ' ' + r + '/' + d;
    let prefill = 0, note = '', hintText;
    if (ph === 2 && Math.random() < 0.4) {
      const pk = Math.random() < 0.5 ? d : rnd(1, d - 1);
      prefill = pk * U / d;
      const pTxt = cupText(prefill, d);
      note = pTxt + ' ' + cupWord(prefill) + ' ' + (prefill > U ? 'are' : 'is') + ' already in the bowl. Add the rest.';
      hintText = 'The bowl already has ' + pTxt + ' ' + cupWord(prefill) + '. How much more makes ' + amt + ' cups? Count up from ' + pTxt + '.';
    } else if (improper) {
      hintText = d + '/' + d + ' makes 1 whole cup. ' + k + '/' + d + ' is ' + W + ' whole ' + (W > 1 ? 'cups' : 'cup') + ' and ' + r + '/' + d + ' more, so ' + k + '/' + d + ' = ' + W + ' ' + r + '/' + d + '.';
    } else {
      hintText = amt + ' cups is ' + W + ' whole ' + (W > 1 ? 'cups' : 'cup') + ' and ' + r + '/' + d + ' cup more. Use the 1 cup scoop for the wholes, then the 1/' + d + ' scoop.';
    }
    return { pet, crew: 1, unit: 'cups', amt, who: pet.name + ' needs', food: 'of ' + pet.food, note,
      scoops: [1, d], tick: d, jars: W + 1, prefill, target, cardDen: d, hintText,
      prompt: pet.name + ': ' + amt + ' cups' + (prefill ? ', ' + cupText(prefill, d) + ' already in' : '') };
  }

  function makeTimes(pet, i, n) {
    const ph = phase(i, n);
    let d, a, crew;
    for (let tries = 0; tries < 50; tries++) {
      d = pick(ph === 0 ? [2, 3, 4] : [2, 3, 4, 6, 8]);
      a = ph === 0 ? 1 : simplestR(d);
      crew = ph === 0 ? rnd(2, 5) : rnd(2, 6);
      if (crew * a <= 4 * d && crew * a >= 2) break;
    }
    const target = crew * a * U / d;
    const shares = [];
    for (let j = 0; j < crew; j++) shares.push(a + '/' + d);
    return { pet, crew, share: a * U / d, unit: cupWord(a * U / d), amt: a + '/' + d, who: crew + ' ' + pet.plural + ' each need', food: 'of ' + pet.food,
      note: 'Fill one big bowl with enough for all ' + crew + '.',
      scoops: [1, d], tick: d, jars: Math.min(5, Math.floor(crew * a / d) + 1), prefill: 0, target, cardDen: d,
      times: crew + ' × ' + a + '/' + d,
      hintText: crew + ' × ' + a + '/' + d + ' means ' + crew + ' groups of ' + a + '/' + d + ': ' + shares.join(' + ') + '. The colored marks show each ' + pet.species + "'s share.",
      prompt: crew + ' ' + pet.plural + ' × ' + a + '/' + d + ' cup' };
  }

  function makeKg(pet, i, n) {
    const ph = phase(i, n);
    let h, form;
    if (ph === 0) {
      h = rnd(1, 9) * 10;
      form = pick(['frac', 'frac', 'dec']);
    } else if (ph === 1) {
      do { h = rnd(3, 98); } while (h % 10 === 0 && Math.random() < 0.7);
      form = pick(['frac', 'dec']);
    } else {
      const r = Math.random();
      if (r < 0.3) { form = 'sum'; h = rnd(1, 9) * 10 + rnd(1, 9); }
      else { h = rnd(101, 195); form = pick(['frac', 'dec']); }
    }
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
    return { pet, crew: 1, unit: 'kg', amt, form, who: pet.name + (form === 'sum' ? "'s vet says:" : ' needs'), food: (form === 'sum' ? 'of ' + pet.food + ' in all' : 'of ' + pet.food),
      note: form === 'sum' ? 'Put both amounts on the scale together.' : '', target: h, hintText,
      prompt: pet.name + ': ' + amt + ' kg' };
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
      p('<strong>Each pet shows a meal card</strong> in kilograms (kg). Put 1 kg bags, 0.1 kg scoops and 0.01 kg pinches on the scale until it has exactly the right amount. Then press <strong>Serve!</strong>');
    } else {
      p('<strong>Each pet shows a meal card.</strong> Tap a measuring cup to scoop food into the bowl. When you think the bowl has exactly the right amount, press <strong>Serve!</strong>');
      p("The bowl doesn't tell you the total until you serve, so count your scoops carefully.");
    }
    p('<strong>Too much?</strong> Press <strong>Pour one back</strong>. <strong>Stuck?</strong> Press <strong>Hint</strong>. Meals served after a hint earn gems but don\'t count toward a star.');
    p(mine.status === 'mastered'
      ? 'You already mastered this one! Extra shifts keep it sharp.'
      : "To earn today's star: feed " + PETS_PER_SHIFT + ' pets and get ' + Math.round(skill.minAccuracy * 100) + '% of the meals right on the first try with no hint.');
  })();

  let memory = { v: 1, fed: 0 }, memoryLoaded = false;
  show('#intro');
  MathRealm.loadState(GAME_ID).then(d => {
    if (d.ok) { memoryLoaded = true; if (d.state && typeof d.state.fed === 'number') memory = d.state; }
    if (memory.fed) { $('#fedCount').textContent = 'Pets you have fed so far: ' + memory.fed.toLocaleString(); $('#fedCount').hidden = false; }
    const b = $('#startBtn');
    b.disabled = false;
    b.textContent = 'Open the café!';
    b.focus();
  });
  $('#startBtn').addEventListener('click', startShift);
  $('#againBtn').addEventListener('click', startShift);
  if (canSpeak) {
    $('#readBtn').hidden = false;
    $('#readBtn').addEventListener('click', () => speak(cardSentence(meal) + ' ' + $('#caption').textContent));
  }

  /* ── Shift state ── */

  let queue = [], idx = -1, meal = null, round = null, results = [], happy = 0;
  let added = [];                   // scoops added this meal: denominators (1 = the 1 cup), or 'bag' | 'scoop' | 'pinch'
  let tries = 0, hinted = false, phaseName = 'idle';

  function startShift() {
    const order = [];
    while (order.length < PETS_PER_SHIFT) {
      shuffle(PETS.slice()).forEach(p => { if (order[order.length - 1] !== p) order.push(p); });
    }
    queue = order.slice(0, PETS_PER_SHIFT).map((p, i) => L.make(p, i, PETS_PER_SHIFT));
    idx = -1; results = []; happy = 0;
    round = MathRealm.startRound(GAME_ID, skillId);
    $('#petTotal').textContent = PETS_PER_SHIFT;
    $('#happyCount').textContent = '0';
    show('#play');
    nextPet();
  }

  function cardSentence(m) {
    if (!m) return '';
    if (m.unit === 'kg') return m.who + ' ' + m.amt + ' kg ' + m.food + '. ' + m.note;
    return m.who + ' ' + m.amt + ' ' + m.unit + ' ' + m.food + '. ' + m.note;
  }

  function renderQueue() {
    const q = $('#queueLine');
    q.replaceChildren(el('span', 'lbl', idx + 1 < queue.length ? 'Waiting in line:' : 'Last pet!'));
    queue.slice(idx + 1, idx + 6).forEach(m => {
      const c = el('div', 'qpet');
      c.append(petSvg(m.pet));
      if (m.crew > 1) c.append(el('span', 'crew', '×' + m.crew));
      q.append(c);
    });
  }

  function renderMeal() {
    $('#mealWho').textContent = meal.who;
    const amt = $('#mealAmt');
    amt.replaceChildren();
    if (meal.form === 'sum') {
      const [a, b] = meal.amt.split(' + ');
      amt.append(fracNode(a), el('span', 'unit', 'kg'), el('span', 'plus', '+'), fracNode(b), el('span', 'unit', 'kg'));
    } else {
      amt.append(fracNode(meal.amt), el('span', 'unit', meal.unit));
    }
    $('#mealFood').textContent = meal.food;
    $('#mealNote').textContent = meal.note;
    const pets = $('#pets');
    pets.replaceChildren();
    pets.classList.toggle('crew', meal.crew > 1);
    const size = meal.crew === 1 ? 170 : meal.crew <= 3 ? 92 : meal.crew === 4 ? 68 : 84;
    pets.style.maxWidth = meal.crew > 4 ? '280px' : '';
    for (let j = 0; j < meal.crew; j++) {
      const svg = petSvg(meal.pet, 'idle');
      svg.style.width = size + 'px';
      svg.style.height = Math.round(size * 1.03) + 'px';
      pets.append(svg);
    }
  }
  function petMood(mood) {
    document.querySelectorAll('#pets .pet').forEach((g, j) => {
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
  function controls(list) {
    const box = $('#controls');
    box.replaceChildren();
    list.forEach(b => {
      const btn = el('button', 'btn' + (b.soft ? ' btn-soft' : ''), b.label);
      btn.type = 'button';
      if (b.id) btn.id = b.id;
      btn.disabled = !!b.disabled;
      btn.addEventListener('click', () => { btn.blur(); b.on(); });
      box.append(btn);
    });
    if (list.some(b => b.focus)) { const f = box.querySelector('button:not([disabled])'); if (f) f.focus(); }
  }
  function syncData() {
    const d = $('#play').dataset;
    d.phase = phaseName; d.target = meal ? meal.target : ''; d.total = meal ? total() : ''; d.kind = L.kind;
  }

  function nextPet() {
    idx++;
    if (idx >= queue.length) { endShift(); return; }
    meal = queue[idx];
    added = []; tries = 0; hinted = false; phaseName = 'scoop';
    renderQueue();
    renderMeal();
    if (L.kind === 'kg') buildScale(); else buildJars();
    buildShelf();
    refresh();
    caption(idx === 0 ? 'Your first customer! Read the meal card, then start measuring.' : pick(['Next customer!', 'Who\'s hungry? Next!', 'Here comes the next pet!']));
    tip(L.kind === 'kg' ? 'Tap the bag, scoop, or pinch to put it on the scale.' : 'Tap a measuring cup to add a scoop.');
    round.shown();
  }

  /* ── Amounts ── */

  function total() {
    if (L.kind === 'kg') return added.reduce((s, a) => s + (a === 'bag' ? 100 : a === 'scoop' ? 10 : 1), 0);
    return meal.prefill + added.reduce((s, d) => s + U / d, 0);
  }
  function capacity() { return L.kind === 'kg' ? 299 : meal.jars * U; }
  function counts() {
    const c = { bag: 0, scoop: 0, pinch: 0 };
    added.forEach(a => { c[a]++; });
    return c;
  }

  /* ── The bowl: one clear jar per cup, marked in equal parts ── */

  const JW = 100, JH = 170, GAP = 40, TOP = 34, PADX = 34;
  let jarRefs = [];
  function buildJars() {
    const svg = $('#bowlSvg');
    svg.replaceChildren();
    svg.style.maxHeight = '';
    const n = meal.jars, W = PADX * 2 + n * JW + (n - 1) * GAP, H = TOP + JH + 44;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    svg.setAttribute('aria-label', 'Food bowl: ' + n + (n > 1 ? ' cups' : ' cup') + ' big, each cup marked in ' + DEN_WORD[meal.tick][1]);
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
      clip.append(S('rect', { x: x, y: TOP, width: JW, height: JH, rx: 16 }));
      defs.append(clip);
      svg.append(S('rect', { x: x, y: TOP, width: JW, height: JH, rx: 16, fill: '#F2F8FF' }));
      const inside = S('g', { 'clip-path': 'url(#jar' + j + ')' });
      const gF = S('g', { class: 'fillg' });
      gF.append(S('rect', { x: x, y: TOP, width: JW, height: JH + 40, fill: 'url(#food)' }));
      gF.style.transform = 'translateY(' + JH + 'px)';
      const gP = S('g', { class: 'fillg' });
      gP.append(S('rect', { x: x, y: TOP, width: JW, height: JH + 40, fill: 'url(#hatch)' }));
      gP.style.transform = 'translateY(' + JH + 'px)';
      inside.append(gF, gP);
      svg.append(inside);
      for (let m = 1; m < meal.tick; m++) {
        const y = TOP + JH - m / meal.tick * JH;
        svg.append(S('line', { x1: x, x2: x + JW, y1: y, y2: y, stroke: INK, 'stroke-width': 1.2, opacity: 0.22 }));
        svg.append(S('line', { x1: x, x2: x + 16, y1: y, y2: y, stroke: INK, 'stroke-width': 2.4 }));
        svg.append(S('line', { x1: x + JW - 16, x2: x + JW, y1: y, y2: y, stroke: INK, 'stroke-width': 2.4 }));
      }
      svg.append(S('rect', { x: x, y: TOP, width: JW, height: JH, rx: 16, fill: 'none', stroke: INK, 'stroke-width': 3 }));
      svg.append(S('path', { d: 'M' + (x + 14) + ',' + (TOP + 14) + ' L' + (x + 14) + ',' + (TOP + 60), stroke: '#fff', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0.7 }));
      const top = S('text', { x: x + JW / 2, y: TOP - 10, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 600, fill: INK, 'font-family': 'Lexend, sans-serif' });
      top.textContent = 'full = 1 cup';
      const bot = S('text', { x: x + JW / 2, y: TOP + JH + 30, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, fill: INK, 'font-family': 'Lexend, sans-serif' });
      bot.textContent = n > 1 ? 'cup ' + (j + 1) : 'the bowl';
      svg.append(top, bot);
      jarRefs.push({ x, gF, gP });
    }
    const guide = S('g', { id: 'guide' });
    svg.append(guide);
    setFill(true);
  }
  function setFill(instant) {
    const t = total();
    jarRefs.forEach((jr, j) => {
      const f = clamp(t - j * U, 0, U) / U, pf = clamp(meal.prefill - j * U, 0, U) / U;
      [jr.gF, jr.gP].forEach(g => { if (instant) { g.style.transition = 'none'; void g.getBBox(); } });
      jr.gF.style.transform = 'translateY(' + ((1 - f) * JH) + 'px)';
      jr.gP.style.transform = 'translateY(' + ((1 - pf) * JH) + 'px)';
      if (instant) requestAnimationFrame(() => { jr.gF.style.transition = ''; jr.gP.style.transition = ''; });
    });
  }
  function yFor(u) {   // where an amount reaches in its jar
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
          const x = jarRefs[j].x + JW + 5;
          const y1 = TOP + JH - b / U * JH, y2 = TOP + JH - a / U * JH;
          g.append(S('rect', { x: x, y: y1 + 1, width: 9, height: Math.max(2, y2 - y1 - 2), rx: 3, fill: colors[s % 2] }));
          if (y2 - y1 > 18) {
            const t = S('text', { x: x + 20, y: (y1 + y2) / 2 + 6, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, fill: colors[s % 2], 'font-family': 'Lexend, sans-serif' });
            t.textContent = String(s + 1);
            g.append(t);
          }
        }
      }
    }
    const { j, y } = yFor(meal.target);
    const x = jarRefs[j].x;
    g.append(S('line', { x1: x - 8, x2: x + JW + 8, y1: y, y2: y, stroke: '#D2448A', 'stroke-width': 4, 'stroke-dasharray': '9 6', 'stroke-linecap': 'round' }));
    g.append(S('rect', { x: x - 30, y: y - 13, width: 46, height: 24, rx: 12, fill: '#FFE9F2', stroke: '#D2448A', 'stroke-width': 2 }));
    const t = S('text', { x: x - 7, y: y + 5, 'text-anchor': 'middle', 'font-size': 14, 'font-weight': 800, fill: '#A8306C', 'font-family': 'Lexend, sans-serif' });
    t.textContent = 'goal';
    g.append(t);
  }

  /* ── The kitchen scale ── */

  function buildScale() {
    const svg = $('#bowlSvg');
    svg.replaceChildren();
    svg.setAttribute('viewBox', '30 40 380 190');
    svg.setAttribute('aria-label', 'Kitchen scale');
    svg.style.maxHeight = '250px';
    svg.append(S('path', fill('#C9B8F2', { d: 'M70,160 L370,160 L352,224 L88,224 Z', 'stroke-width': 3 })));
    svg.append(S('rect', fill('#B3A0E6', { x: 208, y: 136, width: 24, height: 26, 'stroke-width': 3 })));
    svg.append(S('rect', fill('#20314A', { x: 154, y: 176, width: 132, height: 38, rx: 9, 'stroke-width': 3 })));
    const read = S('text', { id: 'readout', x: 220, y: 204, 'text-anchor': 'middle', 'font-size': 26, 'font-weight': 800, fill: '#7CFFB2', 'font-family': 'Grandstander, Lexend, sans-serif' });
    svg.append(read);
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
      const cx = 196 + (i % 5) * 27, base = 129 - Math.floor(i / 5) * 15;
      g.append(S('path', fill(meal.pet.color, { d: 'M' + (cx - 13) + ',' + base + ' Q' + cx + ',' + (base - 26) + ' ' + (cx + 13) + ',' + base + ' Z', 'stroke-width': 1.8 })));
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

  /* ── Scoop shelf ── */

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
  function buildShelf() {
    const shelf = $('#shelf');
    shelf.replaceChildren();
    const items = L.kind === 'kg'
      ? [{ key: 'bag', amt: '1', unit: 'kg', sub: '1 kg bag', scale: 1 },
         { key: 'scoop', amt: '0.1', unit: 'kg', sub: '1/10 kg scoop', scale: 0.78 },
         { key: 'pinch', amt: '0.01', unit: 'kg', sub: '1/100 kg pinch', scale: 0.58 }]
      : meal.scoops.map(d => ({ key: d, amt: d === 1 ? '1' : '1/' + d, unit: '', sub: 'cup', scale: d === 1 ? 1 : 0.55 + 0.45 / Math.sqrt(d) }));
    items.forEach(it => {
      const b = el('button', 'scoop');
      b.type = 'button';
      b.dataset.key = String(it.key);
      const amt = el('span', 'amt');
      amt.append(it.amt.indexOf('/') > 0 ? fracNode(it.amt) : el('span', '', it.amt));
      if (it.unit) amt.append(document.createTextNode(' ' + it.unit));
      b.append(L.kind === 'kg' ? kgIcon(it.key) : cupIcon(it.scale), amt, el('span', 'sub', it.sub));
      b.setAttribute('aria-label', 'Add ' + speakable(L.kind === 'kg' ? it.sub : it.amt + ' cup'));
      b.addEventListener('click', () => addScoop(it.key, b));
      shelf.append(b);
    });
  }
  function shelfEnabled(on) { document.querySelectorAll('#shelf .scoop').forEach(b => { b.disabled = !on; }); }

  function addScoop(key, btn) {
    if (phaseName !== 'scoop') return;
    if (L.kind === 'kg') {
      const c = counts();
      const max = { bag: 2, scoop: 19, pinch: 19 }[key];
      if (c[key] >= max) { tip('That\'s a lot! Try a different size, or pour one back.'); return; }
    } else if (total() + U / key > capacity()) {
      tip("That scoop won't fit in the bowl. Pour one back, or try a smaller cup.");
      RealmFX.wrong();
      return;
    }
    added.push(key);
    btn.classList.remove('pouring'); void btn.offsetWidth; btn.classList.add('pouring');
    tip('');
    refresh();
  }
  function undo() {
    if (phaseName !== 'scoop' || !added.length) return;
    added.pop();
    tip('');
    refresh();
  }

  /* ── The equation under the bowl ── */

  // What's been scooped, as math: "2/8 + 1/8 + 1/8", "1 + 1 + 1/4 + 1/4", "1 + 9 × 1/8"
  function scoopTokens() {
    const tok = [];
    if (L.kind === 'kg') {
      const c = counts();
      const parts = [];
      if (c.bag) parts.push(c.bag + (c.bag > 1 ? ' bags' : ' bag'));
      if (c.scoop) parts.push(c.scoop + (c.scoop > 1 ? ' scoops' : ' scoop'));
      if (c.pinch) parts.push(c.pinch + (c.pinch > 1 ? ' pinches' : ' pinch'));
      parts.forEach((p, i) => { if (i) tok.push('+'); tok.push({ text: p, cls: 'word' }); });
      return tok;
    }
    if (meal.prefill) tok.push(fracNode(cupText(meal.prefill, meal.tick), 'pre'));
    const wholes = added.filter(d => d === 1).length, units = added.filter(d => d !== 1);
    const push = t => { if (tok.length) tok.push('+'); tok.push(t); };
    if (wholes > 3) push(wholes + ' × 1');
    else for (let w = 0; w < wholes; w++) push('1');
    if (units.length > 6) push(units.length + ' × 1/' + units[0]);
    else units.forEach(d => push('1/' + d));
    return tok;
  }
  function refresh() {
    const eq = $('#eq');
    eq.replaceChildren();
    if (meal.times) eq.append(mathLine([meal.crew, '×', meal.amt, '=', '?'], 'small'));
    const tok = scoopTokens();
    if ((L.kind === 'kg' && !added.length) || (L.kind !== 'kg' && !added.length && !meal.prefill)) {
      eq.append(mathLine([{ text: L.kind === 'kg' ? 'The scale is empty.' : 'The bowl is empty.', cls: 'word' }]));
    } else {
      eq.append(mathLine(tok.concat(L.kind === 'kg' ? [] : ['=', '?'])));
    }
    if (L.kind === 'kg') drawPile(); else setFill(false);
    syncData();
    if (phaseName !== 'scoop') return;
    controls([
      { label: 'Pour one back', soft: true, disabled: !added.length, on: undo },
      { label: 'Hint', soft: true, disabled: hinted || tries > 0, on: useHint },
      { label: 'Serve!', id: 'serveBtn', disabled: !added.length, on: serve },
    ]);
    syncData();
  }

  function useHint() {
    hinted = true;
    caption(meal.hintText);
    if (L.kind !== 'kg') showGuide();
    refresh();
  }

  /* ── Serving ── */

  function servedText() {
    return L.kind === 'kg' ? kgText(total()) : cupText(total(), meal.tick);
  }
  function feedback() {
    const t = total(), diff = Math.abs(t - meal.target), more = t < meal.target;
    if (L.kind === 'kg') {
      let s = 'The scale says ' + kgText(t) + ' kg. ' + meal.pet.name + ' needs ' + (meal.form === 'sum' ? meal.amt.replace(' + ', ' kg + ') : meal.amt) + ' kg';
      if (meal.form !== 'dec') s += ', which is ' + kgText(meal.target) + ' kg';
      return s + ". That's " + kgText(diff) + ' kg too ' + (more ? 'little' : 'much') + '.';
    }
    const served = cupText(t, meal.tick, true);
    let s = 'You served ' + served + ' ' + cupWord(t) + '. ';
    if (meal.times) s += 'The ' + meal.pet.plural + ' need ' + meal.times + ' ' + cupWord(meal.target);
    else s += meal.pet.name + ' needs ' + meal.amt + ' ' + meal.unit;
    const inTick = cupText(meal.target, meal.tick, true);
    if (inTick !== meal.amt) s += ', which is ' + inTick + ' ' + cupWord(meal.target);
    return s + ". That's " + cupText(diff, meal.tick) + ' ' + cupWord(diff) + ' too ' + (more ? 'little' : 'much') + '.';
  }

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
      if (t % 10 === 0 && t < 100) fr.push('=', t + '/100', { text: 'kg', cls: 'word' });
      eq.append(mathLine(fr, 'small'));
      return;
    }
    const tok = scoopTokens().concat(['=', cupText(t, meal.tick, true)]);
    if (t % U !== 0 && t > U) tok.push('=', Math.round(t * meal.tick / U) + '/' + meal.tick);
    if (meal.cardDen !== meal.tick && t === meal.target) tok.push('=', cupText(t, meal.cardDen, true));
    eq.append(mathLine(tok));
    if (meal.times && t === meal.target) {
      const k = Math.round(t * meal.tick / U);
      const ln = [meal.times, '=', k + '/' + meal.tick];
      if (cupText(t, meal.tick) !== k + '/' + meal.tick) ln.push('=', cupText(t, meal.tick));
      eq.append(mathLine(ln, 'small'));
    }
  }

  async function serve() {
    if (phaseName !== 'scoop' || !added.length) return;
    const t = total(), right = t === meal.target;
    if (right) {
      const first = tries === 0 && !hinted;
      results.push({ first });
      round.record({ prompt: meal.prompt, answer: servedText(), correct: true, hintUsed: !first });
      await feed(true);
      return;
    }
    RealmFX.wrong();
    petMood('unsure');
    if (tries === 0) {
      tries = 1;
      caption(feedback() + ' ' + meal.hintText + ' Fix the bowl and serve again!', 'bad');
      if (L.kind !== 'kg') showGuide();
      refresh();
      return;
    }
    results.push({ first: false });
    round.record({ prompt: meal.prompt, answer: servedText(), correct: false, hintUsed: true });
    phaseName = 'fixing';
    shelfEnabled(false);
    controls([]);
    caption(feedback() + " Let's fix it together.", 'bad');
    await wait(1600);
    added = fixScoops();
    refresh();
    await feed(false);
  }

  // The right scoops for this meal: wholes with the big scoop, the rest with the small one
  function fixScoops() {
    if (L.kind === 'kg') {
      const h = meal.target, out = [];
      for (let i = 0; i < Math.floor(h / 100); i++) out.push('bag');
      for (let i = 0; i < Math.floor((h % 100) / 10); i++) out.push('scoop');
      for (let i = 0; i < h % 10; i++) out.push('pinch');
      return out;
    }
    const need = meal.target - meal.prefill, out = [];
    const small = meal.scoops.find(d => d !== 1);
    let left = need;
    if (meal.scoops.indexOf(1) >= 0) while (left >= U) { out.push(1); left -= U; }
    while (left > 0) { out.push(small); left -= U / small; }
    return out;
  }

  async function feed(firstRight) {
    phaseName = 'eating';
    shelfEnabled(false);
    controls([]);
    revealLines(meal.target);
    syncData();
    happy++;
    $('#happyCount').textContent = String(happy);
    if (firstRight) {
      RealmFX.correct();
      const cheer = hinted || tries ? 'Yes! You fixed it.' : pick(['Perfect portion!', 'Exactly right!', 'Yum, just right!', 'Chef-level measuring!']);
      caption(cheer + ' ' + (meal.crew > 1 ? 'The ' + meal.pet.plural + ' are' : meal.pet.name + ' is') + ' happy and full.', 'good');
    } else {
      caption('Here is the right amount: ' + fixSentence() + ' ' + (meal.crew > 1 ? 'The ' + meal.pet.plural + ' eat' : meal.pet.name + ' eats') + ' anyway. Nobody goes hungry here!', 'good');
    }
    petMood('happy');
    await wait(firstRight ? 900 : 1400);
    if (L.kind !== 'kg') {
      const g = $('#guide'); if (g) g.replaceChildren();
      jarRefs.forEach(jr => { jr.gF.classList.add('slow'); jr.gP.classList.add('slow'); jr.gF.style.transform = jr.gP.style.transform = 'translateY(' + JH + 'px)'; });
    }
    phaseName = 'fed';
    syncData();
    controls([{ label: idx + 1 < queue.length ? 'Next pet' : 'Close the café', id: 'nextBtn', focus: true, on: nextPet }]);
  }
  function fixSentence() {
    if (L.kind === 'kg') {
      const h = meal.target, b = Math.floor(h / 100), te = Math.floor((h % 100) / 10), hu = h % 10;
      const parts = [];
      if (b) parts.push(b + (b > 1 ? ' bags' : ' bag'));
      if (te) parts.push(te + (te > 1 ? ' scoops' : ' scoop'));
      if (hu) parts.push(hu + (hu > 1 ? ' pinches' : ' pinch'));
      return (meal.form === 'sum' ? meal.amt.replace(' + ', ' kg + ') : meal.amt) + ' kg = ' + kgText(h) + ' kg, so use ' + parts.join(' and ') + '.';
    }
    const s = fixScoops(), wholes = s.filter(d => d === 1).length, units = s.length - wholes, small = meal.scoops.find(d => d !== 1);
    const parts = [];
    if (wholes) parts.push(wholes + (wholes > 1 ? ' whole cups' : ' whole cup'));
    if (units) parts.push(units + (units > 1 ? ' scoops' : ' scoop') + ' of 1/' + small + ' cup');
    let start = meal.times ? meal.times + ' = ' + cupText(meal.target, meal.tick) + ' ' + cupWord(meal.target) : meal.amt + ' ' + meal.unit;
    if (!meal.times && cupText(meal.target, meal.tick, true) !== meal.amt) start += ' = ' + cupText(meal.target, meal.tick, true) + ' ' + cupWord(meal.target);
    return start + (meal.prefill ? '. With ' + cupText(meal.prefill, meal.tick) + ' already in the bowl, add ' : ', so use ') + parts.join(' and ') + '.';
  }

  /* ── Closing time ── */

  async function endShift() {
    phaseName = 'over';
    syncData();
    RealmFX.fanfare();
    const firsts = results.filter(x => x.first).length;
    memory.fed = (memory.fed || 0) + queue.length;
    $('#resTitle').textContent = firsts === results.length ? 'A perfect shift!' : 'The café is closed!';
    $('#resRight').textContent = firsts + ' of ' + results.length;
    $('#resFed').textContent = String(happy);
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
      // Guest mode: the round was scored on this computer only.
      $('#resGems').textContent = '—';
      $('#resGemsLabel').textContent = 'guest mode';
      $('#resStars').replaceChildren();
      lineP('Nice work! Nothing is saved in guest mode, so no ' + C.pointsName + ' or stars yet.');
      lineP('Log in with your class code to start earning ' + C.pointsName + ', stars and golden tickets.');
      msg.hidden = false;
      return;
    }
    lineP('You have fed ' + memory.fed.toLocaleString() + ' pets at the Critter Café.');
    if (res.ok) {
      $('#resGems').textContent = '+' + res.points.total;
      $('#resGemsLabel').textContent = C.pointsName + ' (you have ' + Number(res.points.balance).toLocaleString() + ')';
      updateGems();
      const m = res.mastery, mastered = m.status === 'mastered';
      $('#resStars').replaceChildren(starRow(Math.min(m.days, m.daysNeeded), m.daysNeeded, mastered, m.newlyMastered || res.round.qualifies));
      if (m.newlyMastered) { lineP('You mastered ' + skill.name + '!'); RealmFX.confetti(); }
      else if (mastered) lineP('You already mastered this one. Great shift!');
      else if (res.round.qualifies) lineP("This shift earned today's star!");
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
