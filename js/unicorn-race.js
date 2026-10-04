/*
 * Math Realm: Unicorn Racetrack (decimals on the number line)
 *   unicorn-race.html?skill=g4.dec.tenths | g4.dec.hundredths | g4.dec.mixed
 *
 * The student and Comet (the computer) take turns. On a turn you spin a
 * decimal and mark where you'll land on the number line. Every move is also
 * shown as fractions (7/10 + 6/10 = 1 3/10), because adding like fractions is
 * the 4th grade standard (4.NF.3); adding decimals as decimals is 5th grade.
 *
 * Comet sometimes makes the mistakes students really make (0.7 + 0.6 = 0.13,
 * forgetting to regroup, treating 0.4 as 0.04). Catching one earns a boost.
 * Comet gets better when the student wins and eases off when they lose, so
 * races stay close. Each of the student's moves counts toward stars:
 * right on the first try counts; right after a hint earns gems but not stars.
 *
 * All positions are whole numbers of hundredths (130 means 1.30) to avoid
 * rounding trouble.
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

  const GAME_ID = 'unicorn-race';
  const C = window.MATH_REALM_CATALOG;
  const $ = s => document.querySelector(s);
  const INK = '#2A1F45';
  const STAR_PATH = 'M14 2.8l3.4 7 7.7 1-5.6 5.3 1.4 7.6L14 19.9l-6.9 3.8 1.4-7.6-5.6-5.3 7.7-1z';
  const LEVELS = {
    'g4.dec.tenths':     { kind: 'tenths',     step: 10, finish: 400, view: 200, places: 1, boost: 10 },
    'g4.dec.hundredths': { kind: 'hundredths', step: 1,  finish: 300, view: 100, places: 2, boost: 5 },
    'g4.dec.mixed':      { kind: 'mixed',      step: 1,  finish: 300, view: 100, places: 2, boost: 5 },
  };
  // The student's unicorn wears the style they picked in the Sprite Shop.
  const ME = RealmSprites.unicornStyle(((MathRealm.session || {}).shop || {}).equipped ? MathRealm.session.shop.equipped.unicorn : null);
  const CPU = { body: '#EAF4FF', mane: '#4FD1AB', mane2: '#7CC8FF' };

  const session = MathRealm.session;
  const skillId = new URLSearchParams(location.search).get('skill') || '';
  const skill = (session.skills || []).find(k => k.skillId === skillId);
  const L = LEVELS[skillId];

  /* ── Helpers ── */

  const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
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
    ['#intro', '#race', '#done', '#missing'].forEach(s => { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const fmt = h => h === 0 ? '0' : (h / 100).toFixed(L.places);   // a position, like 1.3 or 1.30
  const fmtT = h => (h / 100).toFixed(1);                  // tenths, like 0.2
  const fmtH = h => (h / 100).toFixed(2);                  // hundredths, like 0.05
  // Comet's answers can be off the grid on purpose (0.7 + 0.6 = "0.13"), so show every digit.
  const fmtC = h => (L && L.kind === 'tenths' && h % 10 !== 0) ? fmtH(h) : fmt(h);

  function updateGems() {
    const s = MathRealm.session;
    $('#gemCount').textContent = s ? Number(s.student.points || 0).toLocaleString() : '0';
  }
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

  // Fractions drawn stacked. denom is 10 or 100. Shows mixed numbers like 1 3/10.
  function fracEl(h, denom) {
    if (h === 0) return el('span', 'mixed', '0');
    const n = denom === 10 ? h / 10 : h;
    const whole = Math.floor(n / denom), rem = n % denom;
    const wrap = el('span', 'mixed');
    if (whole) wrap.append(el('span', '', String(whole)));
    if (rem || !whole) {
      const f = el('span', 'sf');
      f.append(el('span', 't', String(rem)), el('span', 'b', String(denom)));
      wrap.append(f);
    }
    return wrap;
  }

  /* ── Top bar ── */

  $('#gemName').textContent = C.pointsName;
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
  RealmMusic.setTheme('race');

  /* ── Unicorns (original drawing) ── */

  function unicorn(pal, name) {
    const g = S('g', { class: 'uni' });
    const bob = S('g', { class: 'bob' });
    const legs = S('g', { class: 'legs' });
    [-24, -12, 12, 24].forEach(x => legs.append(S('rect', { x: x - 3.5, y: -24, width: 7, height: 24, rx: 3.5, fill: pal.body, stroke: INK, 'stroke-width': 2 })));
    bob.append(legs);
    bob.append(S('path', { d: 'M-26,-38 C-46,-42 -52,-22 -42,-10 C-40,-24 -34,-28 -24,-30 Z', fill: pal.mane, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    (pal.stripes || []).forEach((c, i) => bob.append(S('path', { d: 'M' + (-27 - i * 2) + ',' + (-36 + i) + ' C' + (-40 - i * 2) + ',' + (-38 + i * 2) + ' ' + (-45 + i) + ',' + (-26 + i * 2) + ' ' + (-41 + i * 2) + ',' + (-15 + i), fill: 'none', stroke: c, 'stroke-width': 3, 'stroke-linecap': 'round' })));
    bob.append(S('ellipse', { cx: 0, cy: -36, rx: 30, ry: 16, fill: pal.body, stroke: INK, 'stroke-width': 2 }));
    bob.append(S('path', { d: 'M14,-44 C18,-58 22,-64 28,-68 L40,-60 C33,-54 29,-46 27,-34 Z', fill: pal.body, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    bob.append(S('path', { d: 'M25,-72 C33,-80 49,-76 54,-65 C56,-58 50,-55 43,-57 L30,-56 Z', fill: pal.body, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    bob.append(S('path', { d: 'M29,-74 L31,-85 L37,-75 Z', fill: pal.body, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    bob.append(S('path', { d: 'M27,-74 C15,-72 18,-62 9,-58 C16,-56 11,-48 5,-45 C12,-45 18,-49 22,-52 C19,-58 25,-64 31,-68 Z', fill: pal.mane2, stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    bob.append(S('path', { d: 'M37,-76 L46,-98 L42,-74 Z', fill: pal.horn || '#FFD84D', stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' }));
    bob.append(S('circle', { cx: 42, cy: -66, r: 2.4, fill: pal.eye || INK }));
    bob.append(S('ellipse', { cx: 47, cy: -60, rx: 3.2, ry: 2, fill: '#FF9CC8', opacity: 0.85 }));
    g.append(bob);
    if (name) {   // a racing bib on the saddle
      const w = name.length * 11 + 14;
      bob.append(S('rect', { x: -w / 2 - 2, y: -49, width: w, height: 23, rx: 7, fill: '#fff', stroke: INK, 'stroke-width': 1.8 }));
      const tag = S('text', { x: -2, y: -32, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, fill: INK, 'font-family': 'Lexend, sans-serif' });
      tag.textContent = name;
      bob.append(tag);
    }
    return g;
  }

  /* ── Intro ── */

  const zone = C.zones.find(z => z.zone === skill.zone);
  $('#zoneName').textContent = zone ? zone.title : skill.zone;
  $('#skillTitle').textContent = skill.name;
  document.title = skill.name;
  ['me', 'cpu'].forEach(who => {
    const r = el('div', 'racer');
    const svg = S('svg', { viewBox: '-55 -112 115 116', 'aria-hidden': 'true' });
    svg.append(unicorn(who === 'me' ? ME : CPU));
    r.append(svg, el('span', '', who === 'me' ? 'You' : 'Comet'));
    $('#racers').append(r);
  });
  $('#ruleZoom').hidden = L.kind === 'tenths';
  const mine = session.mastery[skillId] || { status: '', days: 0 };
  $('#introStars').replaceChildren(starRow(Math.min(mine.days || 0, skill.daysNeeded), skill.daysNeeded, mine.status === 'mastered', false));
  $('#ruleStar').textContent = mine.status === 'mastered'
    ? 'You already mastered this one! Racing keeps it sharp.'
    : "To earn today's star: make at least " + skill.minItems + ' moves and land on the right spot on the first try for ' +
      Math.round(skill.minAccuracy * 100) + '% of them.';

  let memory = { v: 1, ratings: {} }, memoryLoaded = false;
  show('#intro');
  MathRealm.loadState(GAME_ID).then(d => {
    if (d.ok) { memoryLoaded = true; if (d.state && d.state.ratings) memory = d.state; }
    const b = $('#startBtn');
    b.disabled = false;
    b.textContent = "Let's race!";
    b.focus();
  });
  $('#startBtn').addEventListener('click', startRace);
  $('#againBtn').addEventListener('click', startRace);
  const rating = () => memory.ratings[skillId] || 0;

  /* ── Race state ── */

  let me = 0, cpu = 0, phase = 'idle';
  let base = 0, spin = null, marker = null, tries = 0, markFor = 'me', zoomStart = null;
  let claim = null, claimWhy = '', arcs = [], round = null, results = [], caught = 0, cpuMistakes = 0;

  function makeSpin() {
    if (L.kind === 'tenths') { const h = rnd(2, 9) * 10; return { h: h, text: fmtT(h), tenth: true }; }
    if (L.kind === 'mixed' && Math.random() < 0.5) { const h = rnd(2, 6) * 10; return { h: h, text: fmtT(h), tenth: true }; }
    let h;
    do { h = L.kind === 'mixed' ? rnd(12, 48) : rnd(12, 58); } while (h % 10 === 0);
    return { h: h, text: fmtH(h), tenth: false };
  }

  /* ── Drawing the number line ── */

  const X0 = 50, X1 = 950, W = X1 - X0, CPU_Y = 106, ME_Y = 204, LINE_Y = 238, H = 282, SCALE = 0.98;
  // The camera: which stretch of the number line is showing. It glides between racers.
  let cam = 0;
  function camFor(who) {
    const pos = who === 'me' ? me : cpu;
    return L.kind === 'tenths' ? Math.floor(pos / 100) * 100 : Math.floor(pos / 10) * 10;
  }
  function viewStart() { return cam; }
  function panTo(who) {
    const from = cam, to = camFor(who);
    if (from === to) { draw(); return Promise.resolve(); }
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dur = still ? 0 : Math.min(1100, 400 + Math.abs(to - from) / L.view * 260);
    const t0 = performance.now();
    return new Promise(done => {
      const frame = now => {
        const k = dur ? Math.min(1, (now - t0) / dur) : 1;
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // ease in and out
        cam = from + (to - from) * e;
        draw();
        if (k < 1) requestAnimationFrame(frame); else { cam = to; draw(); done(); }
      };
      requestAnimationFrame(frame);
    });
  }
  const px = h => X0 + (h - viewStart()) / L.view * W;

  function syncData() {
    const r = $('#race').dataset;
    r.phase = phase; r.base = base; r.spin = spin ? spin.h : ''; r.claim = claim === null ? '' : claim; r.me = me; r.cpu = cpu;
  }

  function draw() {
    syncData();
    const svg = $('#trackSvg');
    svg.replaceChildren();
    const vs = viewStart(), ve = vs + L.view;
    svg.classList.toggle('marking', phase === 'mark' || phase === 'challenge');

    // lanes
    svg.append(S('rect', { x: 0, y: CPU_Y - 4, width: 1000, height: 8, rx: 4, fill: '#EAF4FF' }));
    svg.append(S('rect', { x: 0, y: ME_Y - 4, width: 1000, height: 8, rx: 4, fill: '#FFEAF3' }));

    // zoom bracket
    if (zoomStart !== null && L.kind !== 'tenths' && zoomStart >= vs && zoomStart < ve) {
      svg.append(S('rect', { x: px(zoomStart), y: LINE_Y - 14, width: 10 / L.view * W, height: 28, rx: 5, fill: '#7CC8FF', opacity: 0.35 }));
      svg.append(S('path', { d: 'M' + px(zoomStart) + ',' + (LINE_Y + 14) + ' L0,' + H + ' M' + px(zoomStart + 10) + ',' + (LINE_Y + 14) + ' L1000,' + H, stroke: '#7CC8FF', 'stroke-width': 2, fill: 'none' }));
    }

    // finish line
    if (L.finish >= vs && L.finish <= ve) {
      const x = px(L.finish);
      for (let i = 0; i < 8; i++) svg.append(S('rect', { x: x - 6 + (i % 2) * 6, y: CPU_Y - 40 + i * 12, width: 6, height: 12, fill: i % 2 ? INK : '#fff' }));
      const t = S('text', { x: x, y: CPU_Y - 48, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, fill: INK, 'font-family': 'Lexend, sans-serif' });
      t.textContent = 'Finish';
      svg.append(t);
    }

    // the number line
    svg.append(S('line', { x1: X0 - 20, x2: X1 + 20, y1: LINE_Y, y2: LINE_Y, stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }));
    for (let h = Math.ceil(vs / L.step - 1e-9) * L.step; h <= ve + 1e-9; h += L.step) {
      const whole = h % 100 === 0, tenth = h % 10 === 0;
      const len = whole ? 26 : tenth ? 16 : 7;
      svg.append(S('line', { x1: px(h), x2: px(h), y1: LINE_Y - len / 2, y2: LINE_Y + len / 2, stroke: INK, 'stroke-width': whole ? 3 : tenth ? 2 : 1.2 }));
      if (tenth) {
        const t = S('text', { x: px(h), y: LINE_Y + 34, 'text-anchor': 'middle', 'font-size': whole ? 24 : 17, 'font-weight': whole ? 800 : 600, fill: INK, 'font-family': whole ? 'Grandstander, Lexend, sans-serif' : 'Lexend, sans-serif' });
        t.textContent = whole ? String(h / 100) : fmtT(h);
        svg.append(t);
      }
    }

    // unicorns
    const uni = (who, pos, y, pal, name) => {
      if (pos < vs || pos > ve) {
        const left = pos < vs;
        const t = S('text', { x: left ? 8 : 992, y: y - 20, 'text-anchor': left ? 'start' : 'end', 'font-size': 17, 'font-weight': 700, fill: INK, 'font-family': 'Lexend, sans-serif' });
        t.textContent = (left ? '◂ ' : '') + name + ' ' + fmt(pos) + (left ? '' : ' ▸');
        svg.append(t);
        return null;
      }
      const g = unicorn(pal, name);
      g.id = 'uni-' + who;
      g.style.transform = 'translate(' + px(pos) + 'px,' + y + 'px) scale(' + SCALE + ')';
      svg.append(g);
      return g;
    };
    uni('cpu', cpu, CPU_Y, CPU, 'Comet');
    uni('me', me, ME_Y, ME, 'You');

    // jump arcs (hints and explanations)
    arcs.forEach(a => {
      if (a.from < vs || a.to > ve) return;
      const x1 = px(a.from), x2 = px(a.to), mid = (x1 + x2) / 2, top = LINE_Y - 44;
      svg.append(S('path', { d: 'M' + x1 + ',' + (LINE_Y - 4) + ' Q' + mid + ',' + (top - 14) + ' ' + x2 + ',' + (LINE_Y - 4), fill: 'none', stroke: a.color || '#D2448A', 'stroke-width': 3, 'stroke-dasharray': '7 5' }));
      svg.append(S('polygon', { points: (x2 - 6) + ',' + (LINE_Y - 14) + ' ' + (x2 + 4) + ',' + (LINE_Y - 4) + ' ' + (x2 - 9) + ',' + (LINE_Y - 3), fill: a.color || '#D2448A' }));
      const t = S('text', { x: mid, y: top - 14, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, fill: a.color || '#D2448A', 'font-family': 'Lexend, sans-serif' });
      t.textContent = a.label;
      svg.append(t);
    });

    // Comet's claim
    if (claim !== null && (phase === 'cpuShow' || phase === 'challenge') && claim >= vs && claim <= ve) {
      const x = px(claim);
      svg.append(S('circle', { cx: x, cy: LINE_Y, r: 10, fill: '#7CC8FF', stroke: INK, 'stroke-width': 2 }));
      pill(svg, x, LINE_Y - 24, 'Comet: ' + fmtC(claim), '#E5F2FF');
    }

    // the student's marker (its label sits higher when Comet's answer is also showing)
    if (marker !== null) {
      const x = px(marker);
      svg.append(S('path', { d: starPath(x, LINE_Y, 13), fill: '#FFD84D', stroke: INK, 'stroke-width': 2 }));
      pill(svg, x, LINE_Y - (phase === 'challenge' ? 54 : 24), fmt(marker), '#FFF1B8');
    }
    if (L.kind !== 'tenths') drawZoom();
  }

  function pill(svg, x, y, text, fill) {
    const w = text.length * 10 + 18;
    svg.append(S('rect', { x: x - w / 2, y: y - 15, width: w, height: 24, rx: 12, fill: fill, stroke: INK, 'stroke-width': 1.5 }));
    const t = S('text', { x: x, y: y + 3, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, fill: INK, 'font-family': 'Lexend, sans-serif' });
    t.textContent = text;
    svg.append(t);
  }
  function starPath(cx, cy, r) {
    let d = '';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  }

  // The magnified tenth: 10 hundredths, each one clickable.
  function drawZoom() {
    const box = $('#zoom');
    const using = zoomStart !== null && (phase === 'mark' || phase === 'challenge');
    box.classList.toggle('unused', !using);   // the space stays, so nothing jumps
    if (!using) return;
    $('#zoomLabel').textContent = 'Zoomed in: from ' + fmtT(zoomStart) + ' to ' + fmtT(zoomStart + 10) + ', split into 10 hundredths';
    const z = $('#zoomSvg');
    z.replaceChildren();
    const zx = i => X0 + i / 10 * W, y = 38;
    z.append(S('line', { x1: X0 - 14, x2: X1 + 14, y1: y, y2: y, stroke: INK, 'stroke-width': 3, 'stroke-linecap': 'round' }));
    for (let i = 0; i <= 10; i++) {
      const h = zoomStart + i, end = i === 0 || i === 10;
      z.append(S('line', { x1: zx(i), x2: zx(i), y1: y - (end ? 14 : 9), y2: y + (end ? 14 : 9), stroke: INK, 'stroke-width': end ? 3 : 2 }));
      const t = S('text', { x: zx(i), y: y + 36, 'text-anchor': 'middle', 'font-size': end ? 20 : 17, 'font-weight': end ? 800 : 600, fill: INK, 'font-family': 'Lexend, sans-serif' });
      t.textContent = fmtH(h);
      z.append(t);
      if (h === base) z.append(S('circle', { cx: zx(i), cy: y, r: 7, fill: markFor === 'me' ? '#FF7EB6' : '#7CC8FF', stroke: INK, 'stroke-width': 2 }));
      if (h === marker) z.append(S('path', { d: starPath(zx(i), y, 14), fill: '#FFD84D', stroke: INK, 'stroke-width': 2 }));
    }
  }

  function minimap() {
    const m = $('#minimap');
    m.replaceChildren();
    m.append(el('div', 'track'));
    const pct = h => Math.min(100, h / L.finish * 100) + '%';
    [['cpu', cpu, 'Comet'], ['me', me, 'You']].forEach(([who, pos, name]) => {
      const d = el('div', 'dot ' + who);
      d.style.left = pct(pos);
      const l = el('div', 'lbl', name + ' ' + fmt(pos));
      l.style.left = pct(pos);
      l.style.top = who === 'cpu' ? '-4px' : '38px';
      m.append(d, l);
    });
    const f = el('div', 'flag', 'Finish ' + (L.finish / 100));
    m.append(f);
  }

  /* ── The equation shown above the line ── */

  // Decimals stacked with the decimal points lined up (ones . tenths hundredths).
  // A hundredths column appears when it's needed: always on the hundredths levels, and on the
  // tenths level only when Comet's answer has hundredths in it (0.7 + 0.6 = "0.13").
  // A faint 0 shows that a tenth like 0.4 is the same as 0.40.
  function equation(from, s, answer, isClaim) {
    const box = $('#vsum'), frBox = $('#fr');
    box.replaceChildren();
    frBox.replaceChildren();
    if (!s) return;
    const values = [from, s.h].concat(answer === null ? [] : [answer]);
    const hund = L.kind !== 'tenths' || values.some(v => v % 10 !== 0);
    box.style.gridTemplateColumns = 'var(--cell) var(--cell) .35em var(--cell)' + (hund ? ' var(--cell)' : '');
    const cell = (cls, text) => box.append(el('span', cls, text));
    cell('', ''); cell('head', 'O'); cell('head', ''); cell('head', 't'); if (hund) cell('head', 'h');
    const row = (op, v, opts) => {
      const o = opts || {};
      const extra = o.cls ? ' ' + o.cls : '';
      cell('c' + extra, op);
      if (v === null) {
        cell('c q' + extra, '?'); cell('pt' + extra, '.'); cell('c q' + extra, '?'); if (hund) cell('c q' + extra, '?');
        return;
      }
      cell('c' + extra, String(Math.floor(v / 100)));
      cell('pt' + extra, '.');
      cell('c' + extra, String(Math.floor(v / 10) % 10));
      if (hund) {
        const showGhost = o.tenthOnly;           // 0.4 written as 0.4 with a faint 0
        const blank = L.kind === 'tenths' && v % 10 === 0;   // tenths level: leave the hundredths empty
        cell('c' + extra + (showGhost ? ' ghost' : ''), blank ? '' : String(v % 10));
      }
    };
    row('', from);
    row('+', s.h, { cls: 'spinrow', tenthOnly: L.kind === 'mixed' && s.tenth });
    const line = el('span', 'rule');
    line.style.gridColumn = '1 / -1';
    box.append(line);
    row('', answer, isClaim ? { cls: 'claim' } : null);
    const key = el('p', 'key', 'O = ones, t = tenths' + (hund ? '\nh = hundredths' : ''));
    key.style.gridColumn = '1 / -1';
    box.append(key);

    const d = L.kind === 'tenths' ? 10 : 100;
    frBox.append(el('span', 'word', 'As fractions:'), fracEl(from, d), document.createTextNode('+'), fracEl(s.h, d), document.createTextNode('='));
    frBox.append(answer === null || isClaim ? document.createTextNode('?') : fracEl(answer, d));
  }

  async function spinAnimation(s, from) {
    const box = $('#vsum');
    box.classList.add('rolling');
    for (let i = 0; i < 8; i++) { equation(from, makeSpin(), null); await wait(70); }
    box.classList.remove('rolling');
    equation(from, s, null);
    RealmFX.correct();
  }

  function caption(text, tone) {
    const c = $('#caption');
    c.textContent = text;
    c.className = 'caption' + (tone ? ' ' + tone : '');
  }
  function controls(list) {
    syncData();
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
    const first = box.querySelector('button:not([disabled])');
    if (first && !list.some(b => b.noFocus)) first.focus();
  }
  function tip(text) { $('#tip').textContent = text || ''; }

  /* ── Moving unicorns ── */

  async function move(who, to) {
    const g = document.getElementById('uni-' + who);
    const from = who === 'me' ? me : cpu;
    const y = who === 'me' ? ME_Y : CPU_Y;
    if (g && to !== from) {
      const ve = viewStart() + L.view;
      const target = Math.max(viewStart(), Math.min(to, ve));
      g.classList.add('running');
      RealmFX.gallop(300 + Math.abs(to - from) / L.view * 1500);
      const anim = g.animate(
        [{ transform: 'translate(' + px(from) + 'px,' + y + 'px) scale(' + SCALE + ')' }, { transform: 'translate(' + px(target) + 'px,' + y + 'px) scale(' + SCALE + ')' }],
        { duration: 300 + Math.abs(to - from) / L.view * 1500, easing: 'ease-in-out', fill: 'forwards' }
      );
      await anim.finished.catch(() => {});
      g.classList.remove('running');   // stand still once it arrives
    }
    if (who === 'me') me = Math.max(0, to); else cpu = Math.max(0, to);
    minimap();
  }
  function stumble(who) {
    const g = document.getElementById('uni-' + who);
    if (g) { const inner = g.querySelector('.bob'); inner.classList.remove('stumble'); void inner.offsetWidth; inner.classList.add('stumble'); }
  }

  /* ── Hints and explanations ── */

  function pieces(from, s) {
    const target = from + s.h;
    if (L.kind === 'tenths') {
      const toWhole = 100 - from % 100;
      if (s.h > toWhole) return { target: target, whole: from + toWhole, toWhole: toWhole, rest: s.h - toWhole };
      return { target: target };
    }
    const tens = Math.floor(s.h / 10) * 10, ones = s.h % 10;
    return { target: target, tens: tens, ones: ones };
  }

  function hint(from, s) {
    const p = pieces(from, s);
    if (L.kind === 'tenths') {
      if (p.whole !== undefined) {
        arcs = [{ from: from, to: p.whole, label: '+' + fmtT(p.toWhole) }];
        return 'Make a whole first: from ' + fmt(from) + ', it takes ' + fmtT(p.toWhole) + ' to reach ' + (p.whole / 100) + '. How much of the ' + s.text + ' is left after that?';
      }
      arcs = [];
      return 'Count up ' + (s.h / 10) + ' tenths from ' + fmt(from) + ': ' + fmt(from + 10) + ', ' + fmt(from + 20) + ', and keep going.';
    }
    if (s.tenth) {
      arcs = [];
      return s.text + ' is ' + (s.h / 10) + ' tenths. That is the same as ' + s.h + ' hundredths, ' + fmtH(s.h) + '. Count up ' + (s.h / 10) + ' tenths from ' + fmt(from) + '.';
    }
    arcs = p.tens ? [{ from: from, to: from + p.tens, label: '+' + fmtT(p.tens) }] : [];
    return 'Jump the tenths first: ' + fmt(from) + ' + ' + fmtT(p.tens) + ' = ' + fmt(from + p.tens) + '. Then add ' + p.ones + ' more hundredths.';
  }

  function explain(from, s) {
    const p = pieces(from, s);
    const sum = fmt(from) + ' + ' + s.text + ' = ' + fmt(p.target) + '.';
    if (L.kind === 'tenths') {
      if (p.whole !== undefined) {
        arcs = [{ from: from, to: p.whole, label: '+' + fmtT(p.toWhole) }, { from: p.whole, to: p.target, label: '+' + fmtT(p.rest) }];
        return sum + ' Make a whole first: ' + fmt(from) + ' + ' + fmtT(p.toWhole) + ' = ' + (p.whole / 100) + ', then ' + (p.whole / 100) + ' + ' + fmtT(p.rest) + ' = ' + fmt(p.target) + '.';
      }
      arcs = [{ from: from, to: p.target, label: '+' + s.text }];
      return sum + ' Count up ' + (s.h / 10) + ' tenths from ' + fmt(from) + '.';
    }
    arcs = [];
    if (p.tens) arcs.push({ from: from, to: from + p.tens, label: '+' + fmtT(p.tens) });
    if (p.ones) arcs.push({ from: from + p.tens, to: p.target, label: '+' + fmtH(p.ones), color: '#2D76B5' });
    if (s.tenth) return sum + ' ' + s.text + ' is ' + (s.h / 10) + ' tenths (' + fmtH(s.h) + '), so jump ' + (s.h / 10) + ' tenths.';
    return sum + ' Tenths first: ' + fmt(from) + ' + ' + fmtT(p.tens) + ' = ' + fmt(from + p.tens) + '. Then hundredths: + ' + fmtH(p.ones) + ' = ' + fmt(p.target) + '.';
  }

  /* ── Comet's mistakes: the ones students really make ── */

  function mistakeFor(from, s) {
    const t = from + s.h, opts = [];
    if (L.kind === 'tenths') {
      const a = (from % 100) / 10, b = s.h / 10;
      if (a + b >= 10) {
        opts.push({ v: Math.floor(from / 100) * 100 + a + b,
          why: 'Comet added the tenths like whole numbers, ' + a + ' + ' + b + ' = ' + (a + b) + ', and wrote ' + fmtH(Math.floor(from / 100) * 100 + a + b) +
               '. But ' + (a + b) + ' tenths is 1 whole and ' + (a + b - 10) + ' tenths, so the answer is ' + fmt(t) + '.' });
        opts.push({ v: t - 100,
          why: 'Comet forgot that ' + (a + b) + ' tenths makes a new whole. ' + fmt(from) + ' + ' + s.text + ' is ' + fmt(t) + ', not ' + fmt(t - 100) + '.' });
      }
      opts.push({ v: t + 10, why: 'Comet counted one tenth too many. ' + fmt(from) + ' + ' + s.text + ' = ' + fmt(t) + '.' });
      opts.push({ v: t - 10, why: 'Comet counted one tenth too few. ' + fmt(from) + ' + ' + s.text + ' = ' + fmt(t) + '.' });
    } else {
      if (s.tenth) {
        opts.push({ v: from + s.h / 10, why: 'Comet treated ' + s.text + ' like ' + fmtH(s.h / 10) + '. But ' + s.text + ' is ' + (s.h / 10) + ' tenths, which is ' + s.h + ' hundredths (' + fmtH(s.h) + '). So the answer is ' + fmt(t) + '.' });
      } else if ((from % 10) + (s.h % 10) >= 10) {
        opts.push({ v: t - 10, why: 'Comet added the hundredths, ' + (from % 10) + ' + ' + (s.h % 10) + ' = ' + ((from % 10) + (s.h % 10)) +
          ', but forgot that 10 hundredths make a tenth. ' + fmt(from) + ' + ' + s.text + ' = ' + fmt(t) + '.' });
      }
      opts.push({ v: t + 1, why: 'Comet counted one hundredth too many. ' + fmt(from) + ' + ' + s.text + ' = ' + fmt(t) + '.' });
      opts.push({ v: t - 1, why: 'Comet counted one hundredth too few. ' + fmt(from) + ' + ' + s.text + ' = ' + fmt(t) + '.' });
      opts.push({ v: t + 10, why: 'Comet jumped one tenth too far. ' + fmt(from) + ' + ' + s.text + ' = ' + fmt(t) + '.' });
    }
    const real = opts.filter(o => o.v !== t && o.v >= 0);
    // The misconception mistakes come first in the list; favor them.
    return Math.random() < 0.6 ? real[0] : real[Math.floor(Math.random() * real.length)];
  }

  function mistakeRate() {
    let p = Math.max(0.08, 0.45 - 0.045 * rating());
    const gap = me - cpu, big = L.kind === 'tenths' ? 80 : 40;
    if (gap < -big) p += 0.12;        // student is well behind: Comet gets clumsier
    if (gap > big) p -= 0.08;
    return Math.min(0.55, Math.max(0.05, p));
  }
  function cpuSpin() {
    const s = makeSpin();
    if (Math.random() < rating() * 0.05) {   // a stronger Comet sometimes spins a little more
      s.h += L.kind === 'tenths' ? 10 : 5;
      if (L.kind === 'tenths' && s.h > 90) s.h = 90;
      s.tenth = s.tenth && s.h % 10 === 0;
      s.text = s.tenth || L.kind === 'tenths' ? fmtT(s.h) : fmtH(s.h);
    }
    return s;
  }

  /* ── Turns ── */

  function startRace() {
    me = 0; cpu = 0; results = []; caught = 0; cpuMistakes = 0;
    arcs = []; marker = null; claim = null; zoomStart = null;
    round = MathRealm.startRound(GAME_ID, skillId);
    cam = 0;
    $('#zoom').classList.toggle('none', L.kind === 'tenths');   // tenths never zoom, so no space for it
    $('#zoom').classList.add('unused');
    show('#race');
    minimap();
    myTurn();
  }

  async function myTurn() {
    phase = 'panning';
    arcs = []; marker = null; claim = null; zoomStart = null; spin = null;
    caption('Your turn! Spin to see how far your unicorn can go.');
    tip('');
    equation(me, null, null);
    controls([{ label: 'Spin!', id: 'spinBtn', disabled: true, on: mySpin }]);
    await panTo('me');
    phase = 'spin';
    draw();
    controls([{ label: 'Spin!', id: 'spinBtn', on: mySpin }]);
  }

  async function mySpin() {
    phase = 'spinning';
    controls([]);
    spin = makeSpin();
    equation(me, spin, null);
    await spinAnimation(spin, me);
    startMarking('me', me, spin);
  }

  function startMarking(who, from, s) {
    phase = who === 'me' ? 'mark' : 'challenge';
    markFor = who;
    base = from;
    spin = s;
    marker = null;
    tries = 0;
    zoomStart = L.kind === 'tenths' ? null : Math.floor(from / 10) * 10;
    equation(from, s, null);
    const where = who === 'me' ? "You're at " + fmt(from) + '. You spun ' + s.text + '.' : 'Comet is at ' + fmt(from) + ' and spun ' + s.text + '.';
    let extra = '';
    if (L.kind === 'mixed' && s.tenth) extra = ' (' + s.text + ' is ' + (s.h / 10) + ' tenths, the same as ' + fmtH(s.h) + '.)';
    caption(where + extra + (who === 'me' ? ' Where will you land?' : ' Where should Comet land?'), who === 'me' ? '' : 'cpu');
    tip(L.kind === 'tenths'
      ? 'Click the number line, or use the arrow keys. Then press Go!'
      : 'Click near your spot to zoom in, then click the exact hundredth. Arrow keys work too.');
    draw();
    controls([{ label: who === 'me' ? 'Go!' : 'Check', id: 'goBtn', disabled: true, noFocus: true, on: submitMark }]);
    $('#trackSvg').focus();
    if (who === 'me') round.shown();
  }

  function setMarker(h) {
    if (!(phase === 'mark' || phase === 'challenge')) return;
    const vs = viewStart();
    marker = Math.max(vs, Math.min(vs + L.view, h));
    if (L.kind !== 'tenths') {
      let z = Math.floor(marker / 10) * 10;
      if (z >= vs + L.view) z -= 10;
      zoomStart = z;
    }
    const go = $('#goBtn');
    if (go) go.disabled = false;
    draw();
  }

  function svgPoint(svg, e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  $('#trackSvg').addEventListener('click', e => {
    if (!(phase === 'mark' || phase === 'challenge')) return;
    const p = svgPoint($('#trackSvg'), e);
    const raw = viewStart() + (p.x - X0) / W * L.view;
    setMarker(Math.round(raw / L.step) * L.step);
  });
  $('#zoomSvg').addEventListener('click', e => {
    if (!(phase === 'mark' || phase === 'challenge') || zoomStart === null) return;
    const p = svgPoint($('#zoomSvg'), e);
    setMarker(zoomStart + Math.max(0, Math.min(10, Math.round((p.x - X0) / W * 10))));
  });
  $('#trackSvg').addEventListener('keydown', e => {
    if (!(phase === 'mark' || phase === 'challenge')) return;
    const big = L.kind === 'tenths' ? 10 : (e.shiftKey ? 10 : 1);
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setMarker((marker === null ? base : marker) + big); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setMarker((marker === null ? base : marker) - big); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); submitMark(); }
  });

  async function submitMark() {
    if (marker === null || !(phase === 'mark' || phase === 'challenge')) return;
    tip('');
    const truth = base + spin.h;
    if (phase === 'challenge') { finishChallenge(marker === truth); return; }

    const right = marker === truth;
    if (right) {
      if (tries === 0) results.push({ first: true });
      else results.push({ first: false });
      round.record({ prompt: fmt(base) + ' + ' + spin.text, answer: fmt(marker), correct: true, hintUsed: tries > 0 });
      phase = 'moving';
      controls([]);
      arcs = [];
      equation(base, spin, truth);
      caption((tries ? 'Yes! ' : ['Yes!', 'Nailed it!', 'Perfect landing!', 'Gallop!'][rnd(0, 3)] + ' ') + fmt(base) + ' + ' + spin.text + ' = ' + fmt(truth) + '.');
      RealmFX.correct();
      marker = null; zoomStart = null;
      draw();
      await move('me', truth);
      if (me >= L.finish) { endRace(true); return; }
      await wait(700);
      cpuTurn();
      return;
    }
    RealmFX.wrong();
    if (tries === 0) {
      tries = 1;
      caption('Not quite. ' + hint(base, spin) + ' Try again!', 'bad');
      marker = null;
      const go = $('#goBtn'); if (go) go.disabled = true;
      draw();
      $('#trackSvg').focus();
      return;
    }
    results.push({ first: false });
    round.record({ prompt: fmt(base) + ' + ' + spin.text, answer: fmt(marker), correct: false, hintUsed: true });
    phase = 'wait';
    marker = null; zoomStart = null;
    caption('Whoa, your unicorn stumbled! ' + explain(base, spin) + ' Your unicorn stays at ' + fmt(base) + ' this turn.', 'bad');
    equation(base, spin, base + spin.h);
    draw();
    stumble('me');
    controls([{ label: "Comet's turn", on: cpuTurn }]);
  }

  async function cpuTurn() {
    phase = 'cpuSpin';
    arcs = []; marker = null; zoomStart = null; claim = null;
    const s = cpuSpin();
    spin = s;
    base = cpu;
    caption("Comet's turn. Comet is spinning…", 'cpu');
    tip('');
    equation(cpu, null, null);
    controls([{ label: 'Looks right', disabled: true, on: () => {} }, { label: 'Spot the mistake!', soft: true, disabled: true, on: () => {} }]);
    await panTo('cpu');
    equation(cpu, s, null);
    await spinAnimation(s, cpu);
    await wait(500);
    const truth = cpu + s.h;
    const slip = Math.random() < mistakeRate() ? mistakeFor(cpu, s) : null;
    claim = slip ? slip.v : truth;
    claimWhy = slip ? slip.why : '';
    phase = 'cpuShow';
    caption('Comet is at ' + fmt(cpu) + ' and spun ' + s.text + '. Comet says: ' + fmt(cpu) + ' + ' + s.text + ' = ' + fmtC(claim) + '. Is Comet right?', 'cpu');
    equation(cpu, s, claim, true);
    draw();
    controls([
      { label: 'Looks right', on: acceptClaim },
      { label: 'Spot the mistake!', soft: true, on: () => startMarking('cpu', cpu, s) },
    ]);
  }

  async function acceptClaim() {
    const truth = cpu + spin.h;
    controls([]);
    if (claim === truth) {
      caption('Comet was right: ' + fmt(cpu) + ' + ' + spin.text + ' = ' + fmt(truth) + '.', 'cpu');
      phase = 'moving';
      draw();
      await move('cpu', truth);
      if (cpu >= L.finish) { endRace(false); return; }
      await wait(600);
      myTurn();
      return;
    }
    cpuMistakes++;
    const landing = L.kind === 'tenths' ? Math.round(claim / 10) * 10 : claim;
    phase = 'moving';
    caption('Uh-oh, Comet made a mistake and it slipped by! ' + claimWhy + ' Comet trots to ' + fmt(landing) + ' anyway.', 'bad');
    draw();
    await move('cpu', landing);
    if (cpu >= L.finish) { endRace(false); return; }
    phase = 'wait';
    controls([{ label: 'Your turn', on: myTurn }]);
  }

  async function finishChallenge(markRight) {
    const truth = base + spin.h;
    phase = 'moving';
    controls([]);
    marker = null; zoomStart = null;
    equation(base, spin, truth);
    if (claim !== truth) {
      cpuMistakes++;
      if (markRight) {
        caught++;
        RealmFX.fanfare();
        caption('You caught it! ' + claimWhy + ' Comet stays at ' + fmt(cpu) + ', and your unicorn gets a sparkle boost of ' + fmt(L.boost) + '!');
        await panTo('me');
        await move('me', me + L.boost);
        if (me >= L.finish) { endRace(true); return; }
      } else {
        caption('Good eye: Comet was wrong! But that spot isn\'t right either. ' + explain(base, spin) + ' Comet stays put.', 'cpu');
        draw();
      }
    } else {
      caption('Comet was right this time: ' + fmt(base) + ' + ' + spin.text + ' = ' + fmt(truth) + '. Comet gets a small boost for being right.', 'cpu');
      draw();
      await move('cpu', truth + L.boost);
      if (cpu >= L.finish) { endRace(false); return; }
    }
    phase = 'wait';
    controls([{ label: 'Your turn', on: myTurn }]);
  }

  /* ── The finish ── */

  async function endRace(won) {
    phase = 'over';
    controls([]);
    draw();
    if (won) { RealmFX.fanfare(); RealmFX.confetti(); }
    await wait(900);
    const r = rating();
    memory.ratings[skillId] = Math.max(0, Math.min(10, r + (won ? 1 : -1)));
    const firsts = results.filter(x => x.first).length;
    $('#resTitle').textContent = won ? 'You won the race!' : 'Comet won this time!';
    $('#resRight').textContent = firsts + ' of ' + results.length;
    $('#resCaught').textContent = caught + ' of ' + cpuMistakes;
    $('#resGems').textContent = '…';
    $('#resGemsLabel').textContent = 'saving your race';
    $('#resStars').replaceChildren();
    $('#resMsg').hidden = true;
    $('#resTicket').hidden = true;
    $('#againBtn').disabled = true;
    show('#done');

    const saves = [results.length ? round.finish() : Promise.resolve({ ok: false, error: 'no_attempts' })];
    if (memoryLoaded) saves.push(MathRealm.saveState(GAME_ID, memory));
    const [res] = await Promise.all(saves);
    showResult(res, won);
    $('#againBtn').disabled = false;
    $('#againBtn').focus();
  }

  function showResult(res, won) {
    const msg = $('#resMsg');
    msg.replaceChildren();
    const line = t => msg.append(el('p', '', t));
    if (res.guest) {
      // Guest mode: the round was scored on this computer only.
      $('#resGems').textContent = '—';
      $('#resGemsLabel').textContent = 'guest mode';
      $('#resStars').replaceChildren();
      line('Nice work! Nothing is saved in guest mode, so no ' + C.pointsName + ' or stars yet.');
      line('Log in with your class code to start earning ' + C.pointsName + ', stars and golden tickets.');
      msg.hidden = false;
      return;
    }
    line(won ? 'Comet is going to practice harder for next time!' : 'Comet will take it a little easier next time. You can do it!');
    if (res.ok) {
      $('#resGems').textContent = '+' + res.points.total;
      $('#resGemsLabel').textContent = C.pointsName + ' (you have ' + Number(res.points.balance).toLocaleString() + ')';
      updateGems();
      const m = res.mastery;
      const mastered = m.status === 'mastered';
      $('#resStars').replaceChildren(starRow(Math.min(m.days, m.daysNeeded), m.daysNeeded, mastered, m.newlyMastered || res.round.qualifies));
      if (m.newlyMastered) {
        line('You mastered ' + skill.name + '!');
        RealmFX.confetti();
      } else if (mastered) {
        line('You already mastered this one. Nice racing!');
      } else if (res.round.qualifies) {
        line("This race earned today's star!");
      } else if (results.length < skill.minItems) {
        line("For today's star, a race needs at least " + skill.minItems + ' of your moves. Try again!');
      } else {
        line("For today's star, land on the right spot on the first try for " + Math.round(skill.minAccuracy * 100) + '% of your moves.');
      }
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
      line('The internet dropped, so your race is saved on this computer. It will send by itself when the internet is back.');
    } else if (res.error !== 'no_attempts') {
      $('#resGems').textContent = '—';
      $('#resGemsLabel').textContent = 'not saved';
      line(MathRealm.errorMessage(res.error, true));
    } else {
      $('#resGems').textContent = '0';
      $('#resGemsLabel').textContent = C.pointsName;
    }
    msg.hidden = !msg.childNodes.length;
  }
})();
