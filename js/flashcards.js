/*
 * Math Realm: Fact Garden flashcards (3rd grade review)
 * Plays any g3.mult.* or g3.div.* skill from the Skills tab, for example:
 *   flashcards.html?skill=g3.mult.c
 *
 * One round = the skill's minItems cards (from the Skills tab), so a round
 * is always exactly what the mastery rule looks at.
 *
 * Which facts come up: each fact sits in a "box" from 1 to 5 in the student's
 * save data. A fast, correct answer with no help moves it up a box; a miss
 * drops it to box 1. Low boxes come up more often, so missed facts come back
 * until they stick.
 *
 * Card layouts: multiplication shows as a row (5 × 6 = ?) or stacked
 * vertically, about half and half (VERTICAL_SHARE). Division shows as a row
 * until a student has a star on that division skill; then a short lesson
 * shows the ÷ sign turning into a fraction bar, and after that about a third
 * of division cards show as a fraction (FRACTION_SHARE).
 *
 * The see-through grid under the card shows for any fact below box 3, so a
 * student sees the area picture until they've answered that fact quickly
 * twice, and again whenever they miss it. It doesn't count as help: counting
 * squares is too slow to meet the speed goal anyway.
 */
(function () {
  'use strict';
  if (!MathRealm.requireLogin()) return;

  const GAME_ID = 'flashcards';
  const C = window.MATH_REALM_CATALOG;
  const $ = s => document.querySelector(s);

  const GROUPS = { a: [1, 2, 5, 10], b: [3, 4, 6], c: [7, 8, 9], d: [11, 12], all: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
  const FRIENDLY = [1, 2, 5, 10];
  // How the grid splits a hard number into easier pieces
  const SPLITS = { 3: [2, 1], 4: [2, 2], 6: [5, 1], 7: [5, 2], 8: [4, 4], 9: [5, 4], 11: [10, 1], 12: [10, 2] };
  const COLORS = ['#4FD1AB', '#FF7EB6'];
  const GHOST_UNTIL_BOX = 3;
  const VERTICAL_SHARE = 0.5;    // share of multiplication cards written vertically
  const FRACTION_SHARE = 0.35;   // share of division cards written as a fraction, after the lesson
  const BOX_WEIGHT = [6, 8, 5, 3, 2, 1];   // index = box. 0 = never seen, 1 = missed or needed help, 5 = solid
  const PRAISE = ['Yes!', 'Nice!', 'You got it!', 'Super!', 'Great!'];
  const STAR_PATH = 'M14 2.8l3.4 7 7.7 1-5.6 5.3 1.4 7.6L14 19.9l-6.9 3.8 1.4-7.6-5.6-5.3 7.7-1z';

  /* ── Which skill? ── */

  const session = MathRealm.session;
  const skillId = new URLSearchParams(location.search).get('skill') || '';
  const skill = (session.skills || []).find(k => k.skillId === skillId);
  const match = /^g3\.(mult|div)\.(a|b|c|d|all)$/.exec(skillId);

  setupTopbar();
  if (!skill || !match) { show('#missing'); return; }

  const op = match[1];
  const facts = buildFacts(op, GROUPS[match[2]]);
  const ROUND_SIZE = skill.minItems;
  const NEED_RIGHT = Math.ceil(skill.minAccuracy * ROUND_SIZE - 1e-9);
  const SPEED_MS = skill.maxMedianMs || 0;

  let memory = { v: 1, facts: {} };   // the student's fact boxes, saved on the server
  let deck = [], pos = 0, card = null, typed = '', helpUsed = false, turned = false;
  let mode = 'idle', shownAt = 0, round = null, results = [];
  let answerEl = null, fractionsOn = false;

  /* ── Screens ── */

  function show(id) {
    ['#intro', '#play', '#results', '#missing', '#lesson'].forEach(s => { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }

  function setupTopbar() {
    $('#gemName').textContent = C.pointsName;
    updateGems();
    const toggles = [
      { btn: $('#soundBtn'), label: 'Sounds', get: () => RealmFX.soundOn, flip: () => RealmFX.toggleSound() },
      { btn: $('#musicBtn'), label: 'Music', get: () => RealmMusic.on, flip: () => RealmMusic.toggle() },
    ];
    toggles.forEach(t => {
      const paint = () => { t.btn.textContent = t.label + ': ' + (t.get() ? 'on' : 'off'); t.btn.setAttribute('aria-pressed', String(t.get())); };
      paint();
      t.btn.addEventListener('click', () => { t.flip(); paint(); t.btn.blur(); });
    });
  }
  function updateGems() {
    const s = MathRealm.session;
    $('#gemCount').textContent = s ? Number(s.student.points || 0).toLocaleString() : '0';
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function svgEl(tag, attrs) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k]));
    return e;
  }
  function starRow(have, need, mastered, pop) {
    const row = el('div', 'stars' + (mastered ? ' mastered' : '') + (pop ? ' pop' : ''));
    row.setAttribute('role', 'img');
    row.setAttribute('aria-label', mastered ? 'Mastered' : have + ' of ' + need + ' stars');
    for (let i = 0; i < need; i++) {
      const star = svgEl('svg', { viewBox: '0 0 28 28', class: 'star' + (mastered || i < have ? ' on' : ''), 'aria-hidden': 'true' });
      star.style.setProperty('--i', i);
      star.append(svgEl('path', { d: STAR_PATH }));
      row.append(star);
    }
    return row;
  }

  /* ── Intro ── */

  const zone = C.zones.find(z => z.zone === skill.zone);
  $('#zoneName').textContent = zone ? zone.title : skill.zone;
  $('#skillTitle').textContent = skill.name;
  document.title = skill.name;
  const mine = session.mastery[skillId] || { status: '', days: 0 };
  $('#introStars').replaceChildren(starRow(Math.min(mine.days || 0, skill.daysNeeded), skill.daysNeeded, mine.status === 'mastered', false));
  $('#ruleCards').textContent = 'You get ' + ROUND_SIZE + ' cards. Type each answer, then press Check (or the Enter key).';
  $('#ruleStar').textContent = mine.status === 'mastered'
    ? 'You already mastered this one! Playing keeps it sharp.'
    : "To earn today's star: " + NEED_RIGHT + ' of ' + ROUND_SIZE + ' right without the grid' +
      (SPEED_MS ? ', answering in about ' + SPEED_MS / 1000 + ' seconds or less.' : '.');
  show('#intro');

  MathRealm.loadState(GAME_ID).then(d => {
    if (d.ok && d.state && d.state.facts) memory = d.state;
    $('#replayWrap').hidden = !(op === 'div' && lessonSeen());
    const btn = $('#startBtn');
    btn.disabled = false;
    btn.textContent = 'Start';
    btn.focus();
  });
  $('#startBtn').addEventListener('click', begin);
  $('#againBtn').addEventListener('click', begin);

  /* ── Facts ── */

  function buildFacts(kind, focus) {
    const out = [];
    const seen = {};
    focus.forEach(f => {
      for (let n = 1; n <= 12; n++) {
        if (kind === 'mult') {
          const lo = Math.min(f, n), hi = Math.max(f, n), key = 'm' + lo + 'x' + hi;
          if (!seen[key]) { seen[key] = 1; out.push({ key: key, kind: kind, a: lo, b: hi }); }
        } else {
          out.push({ key: 'd' + (f * n) + '/' + f, kind: kind, divisor: f, quotient: n, dividend: f * n });
        }
      }
    });
    return out;
  }

  function pickDeck() {
    const pool = facts.map(f => ({ f: f, w: BOX_WEIGHT[(memory.facts[f.key] || {}).b || 0] }));
    const picked = [];
    while (picked.length < ROUND_SIZE && pool.length) {
      let r = Math.random() * pool.reduce((sum, p) => sum + p.w, 0);
      let i = 0;
      for (; i < pool.length - 1; i++) { r -= pool[i].w; if (r <= 0) break; }
      picked.push(pool[i].f);
      pool.splice(i, 1);
    }
    return picked;
  }

  function makeCard(f) {
    if (f.kind === 'mult') {
      const flip = Math.random() < 0.5;
      const x = flip ? f.b : f.a, y = flip ? f.a : f.b;
      return { fact: f, text: x + ' × ' + y, prompt: x + ' × ' + y, answer: x * y, rows: x, cols: y, retry: false,
        layout: Math.random() < VERTICAL_SHARE ? 'stack' : 'row', parts: [x, y] };
    }
    return { fact: f, text: f.dividend + ' ÷ ' + f.divisor, prompt: f.dividend + ' ÷ ' + f.divisor, answer: f.quotient, rows: f.divisor, cols: f.quotient, retry: false,
      layout: fractionsOn && Math.random() < FRACTION_SHARE ? 'frac' : 'row', parts: [f.dividend, f.divisor] };
  }

  /* ── The fraction-bar lesson ── */

  function lessonSeen() { return !!(memory.lessons && memory.lessons.fractionBar); }
  function lessonDue() {
    if (op !== 'div' || lessonSeen()) return false;
    const m = (MathRealm.session.mastery || {})[skillId] || {};
    return (m.days || 0) >= 1 || m.status === 'mastered';
  }

  function begin() {
    if (lessonDue()) playLesson(true);
    else startRound();
  }

  let lessonAnims = [];
  function playLesson(thenPlay) {
    // Use one of this skill's own facts, ideally a two-digit one.
    const pool = facts.filter(f => f.dividend >= 12 && f.divisor > 1);
    const f = pool.find(x => x.dividend === 24 && x.divisor === 6) || pool[Math.floor(Math.random() * pool.length)] || facts[facts.length - 1];
    const D = f.dividend, d = f.divisor, q = f.quotient;
    $('#lNum').textContent = D;
    $('#lDen').textContent = d;
    $('#lText1').textContent = 'Look closely at the ÷ sign in ' + D + ' ÷ ' + d + '. It has a dot on top, a line, and a dot on the bottom.';
    $('#lText2').textContent = 'Put the ' + D + ' where the top dot is and the ' + d + ' where the bottom dot is, and you get a fraction: ' + D + ' over ' + d + '. It means the same thing as ' + D + ' ÷ ' + d + ', so it also equals ' + q + '.';
    $('#lText3').textContent = 'From now on, some of your division cards will be written this way. Same math, new look!';
    $('#lText2').hidden = true;
    $('#lText3').hidden = true;
    $('#lessonGo').textContent = thenPlay ? 'Got it! Start' : 'Got it!';
    $('#lessonGo').onclick = () => {
      lessonAnims.forEach(a => a.cancel());
      memory.lessons = Object.assign({}, memory.lessons, { fractionBar: true });
      $('#replayWrap').hidden = false;
      if (thenPlay) startRound(); else show('#intro');
    };
    show('#lesson');
    animateLesson(D, d);
  }
  $('#lessonAgain').addEventListener('click', () => animateLesson(Number($('#lNum').textContent), Number($('#lDen').textContent)));
  $('#replayBtn').addEventListener('click', () => playLesson(false));

  function animateLesson() {
    lessonAnims.forEach(a => a.cancel());
    lessonAnims = [];
    const W = $('#stage').clientWidth || 340, cx = W / 2;
    const at = (node, x, y) => { node.style.left = x + 'px'; node.style.top = y + 'px'; };
    const num = $('#lNum'), den = $('#lDen'), dot1 = $('#lDot1'), dot2 = $('#lDot2'), bar = $('#lBar');
    const gap = Math.max(num.offsetWidth, 70) / 2 + 40;
    // Start: written in a row, 24 ÷ 6
    at(num, cx - gap, 115); at(den, cx + gap, 115); at(dot1, cx, 92); at(dot2, cx, 138); at(bar, cx, 115);
    bar.style.width = '34px';
    [num, den, dot1, dot2, bar].forEach(n => { n.style.opacity = 1; });
    $('#lText2').hidden = true;
    $('#lText3').hidden = true;
    const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const opts = { duration: still ? 1 : 1100, delay: still ? 0 : 1200, easing: 'cubic-bezier(.45,0,.2,1)', fill: 'forwards' };
    const go = (node, frames) => lessonAnims.push(node.animate(frames, opts));
    go(num, [{ left: (cx - gap) + 'px', top: '115px' }, { left: cx + 'px', top: '62px' }]);
    go(den, [{ left: (cx + gap) + 'px', top: '115px' }, { left: cx + 'px', top: '170px' }]);
    go(dot1, [{ top: '92px', opacity: 1 }, { top: '62px', opacity: 0 }]);
    go(dot2, [{ top: '138px', opacity: 1 }, { top: '170px', opacity: 0 }]);
    go(bar, [{ width: '34px' }, { width: Math.max(num.offsetWidth + 30, 110) + 'px' }]);
    lessonAnims[0].finished.then(() => {
      $('#lText2').hidden = false;
      setTimeout(() => { $('#lText3').hidden = false; }, still ? 0 : 900);
    }).catch(() => { /* replayed before it finished */ });
  }

  /* ── Playing ── */

  function startRound() {
    fractionsOn = op === 'div' && lessonSeen();
    round = MathRealm.startRound(GAME_ID, skillId);
    deck = pickDeck().map(makeCard);
    pos = 0;
    results = [];
    show('#play');
    nextCard();
  }

  function nextCard() {
    if (pos >= deck.length) { finishRound(); return; }
    card = deck[pos++];
    typed = '';
    helpUsed = false;
    turned = false;
    renderQuestion();
    renderAnswer();
    $('#feedback').textContent = '';
    $('#problem').dataset.state = '';
    $('#problem').classList.remove('shake');
    $('#retryTag').hidden = !card.retry;
    $('#help').hidden = true;
    $('#helpBtn').hidden = false;
    $('#helpBtn').disabled = false;
    $('#nextBtn').hidden = true;
    drawGhost();
    mode = 'answering';
    updateProgress();
    shownAt = performance.now();
    round.shown();
  }

  function updateProgress() {
    const done = results.length;
    $('#bar').style.width = Math.round(100 * done / ROUND_SIZE) + '%';
    const current = mode === 'answering' ? done + 1 : done;   // after answering, keep showing this card's number
    $('#count').textContent = card && card.retry ? 'Practice card' : 'Card ' + Math.max(1, Math.min(current, ROUND_SIZE)) + ' of ' + ROUND_SIZE;
  }

  function renderQuestion() {
    const q = $('#question');
    q.replaceChildren();
    q.dataset.text = card.text;
    q.setAttribute('aria-label', card.text.replace('×', 'times').replace('÷', 'divided by'));
    answerEl = el('span', 'answer-box');
    const [x, y] = card.parts;
    if (card.layout === 'stack') {
      const v = el('span', 'vstack');
      v.append(el('span', 'n', String(x)), el('span', 'op', '×'), el('span', 'n', String(y)), el('span', 'rule'), answerEl);
      q.append(v);
    } else if (card.layout === 'frac') {
      const f = el('span', 'frac');
      f.append(el('span', 'top', String(x)), el('span', 'bottom', String(y)));
      q.append(f, el('span', '', '='), answerEl);
    } else {
      q.append(el('span', '', card.text), el('span', '', '='), answerEl);
    }
  }

  function renderAnswer() {
    answerEl.textContent = typed;
    $('#checkBtn').disabled = !typed || mode !== 'answering';
  }

  function press(key) {
    if (mode === 'wrong' && key === 'check') { nextCard(); return; }
    if (mode !== 'answering') return;
    if (key === 'check') { check(); return; }
    if (key === 'del') typed = typed.slice(0, -1);
    else if (/^\d$/.test(key) && typed.length < 3) typed = (typed === '0' ? '' : typed) + key;
    renderAnswer();
  }

  function check() {
    if (mode !== 'answering' || !typed) return;
    const ms = Math.round(performance.now() - shownAt);
    const correct = Number(typed) === card.answer;
    // Practice cards (a missed fact coming back) don't count toward the round.
    if (!card.retry) {
      round.record({ prompt: card.prompt, answer: typed, correct: correct, hintUsed: helpUsed });
      results.push({ key: card.fact.key, correct: correct, hint: helpUsed, ms: ms });
    }
    if (correct) {
      mode = 'right';
      $('#problem').dataset.state = 'right';
      $('#ghost').classList.add('lit');
      $('#checkBtn').disabled = true;
      $('#helpBtn').disabled = true;
      $('#feedback').textContent = helpUsed ? 'Yes! The grid helped.' : (SPEED_MS && ms < SPEED_MS * 0.6 ? 'Speedy!' : PRAISE[Math.floor(Math.random() * PRAISE.length)]);
      RealmFX.correct();
      updateProgress();
      setTimeout(nextCard, helpUsed ? 1200 : 700);
    } else {
      mode = 'wrong';
      const said = typed;
      typed = String(card.answer);
      renderAnswer();
      $('#problem').dataset.state = 'wrong';
      const p = $('#problem');
      p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake');
      $('#feedback').textContent = 'Not quite. You said ' + said + '. Here is how to see it:';
      RealmFX.wrong();
      showHelp(true);
      $('#helpBtn').hidden = true;
      $('#nextBtn').hidden = false;
      $('#nextBtn').focus();
      if (!card.retry) deck.splice(Math.min(pos + 3, deck.length), 0, Object.assign({}, card, { retry: true }));
      updateProgress();
    }
  }

  /* ── The see-through grid under the card ── */

  function drawGhost() {
    const box = (memory.facts[card.fact.key] || {}).b || 0;
    const ghost = $('#ghost');
    ghost.classList.remove('lit');
    if (box >= GHOST_UNTIL_BOX) { ghost.hidden = true; ghost.replaceChildren(); return; }
    const cell = 18, R = card.rows, Cc = card.cols, W = Cc * cell, H = R * cell;
    const svg = svgEl('svg', { viewBox: '-1 -1 ' + (W + 2) + ' ' + (H + 2), width: W + 2, height: H + 2 });
    svg.append(svgEl('rect', { class: 'area', x: 0, y: 0, width: W, height: H }));
    for (let r = 1; r < R; r++) svg.append(svgEl('line', { x1: 0, x2: W, y1: r * cell, y2: r * cell }));
    for (let c = 1; c < Cc; c++) svg.append(svgEl('line', { y1: 0, y2: H, x1: c * cell, x2: c * cell }));
    svg.append(svgEl('rect', { class: 'frame', x: 0, y: 0, width: W, height: H, rx: 2 }));
    ghost.replaceChildren(svg);
    ghost.hidden = false;
    // restart the fade-in for each new card
    ghost.style.animation = 'none'; void ghost.offsetWidth; ghost.style.animation = '';
  }

  /* ── The grid ── */

  function showHelp(explain) {
    if (!explain) helpUsed = true;
    $('#ghost').hidden = true;
    $('#help').hidden = false;
    $('#helpBtn').hidden = true;
    $('#turnBtn').hidden = card.fact.kind !== 'mult' || card.rows === card.cols;
    drawHelp(explain);
  }

  function multPlan(rows, cols) {
    const options = [];
    if (SPLITS[rows]) options.push({ axis: 'rows', parts: SPLITS[rows], other: cols });
    if (SPLITS[cols]) options.push({ axis: 'cols', parts: SPLITS[cols], other: rows });
    options.forEach(o => { o.score = o.parts.filter(p => FRIENDLY.indexOf(p) >= 0).length * 2 + (FRIENDLY.indexOf(o.other) >= 0 ? 1 : 0); });
    options.sort((a, b) => b.score - a.score);
    return options[0] || null;
  }

  function drawHelp(explain) {
    const rows = turned ? card.cols : card.rows;
    const cols = turned ? card.rows : card.cols;
    const text = $('#helpText');
    const legend = $('#legend');
    legend.replaceChildren();
    text.replaceChildren();
    const say = (parts) => parts.forEach(p => text.append(typeof p === 'string' ? document.createTextNode(p) : p));
    const bold = t => el('strong', '', t);
    const addLegend = (i, label) => {
      const li = el('li');
      const chip = el('i');
      chip.style.background = COLORS[i];
      li.append(chip, document.createTextNode(label));
      legend.append(li);
    };

    let grid;
    if (card.fact.kind === 'mult') {
      const answer = rows * cols;
      const plan = multPlan(rows, cols);
      if (rows === 1 || cols === 1) {
        say(['Times 1 means just one group, so the answer is the other number.']);
        grid = { rows: rows, cols: cols };
      } else if (!plan) {
        say([rows + ' rows with ' + cols + ' squares in each row. Count by ' + cols + 's down the rows.']);
        grid = { rows: rows, cols: cols };
      } else {
        const [p0, p1] = plan.parts;
        const a = plan.axis === 'rows' ? p0 * cols : rows * p0;
        const b = plan.axis === 'rows' ? p1 * cols : rows * p1;
        say(['Split the ', bold(plan.axis === 'rows' ? rows + ' rows' : cols + ' columns'), ' into ' + p0 + ' and ' + p1 + '. Find each part, then add them.']);
        addLegend(0, plan.axis === 'rows' ? p0 + ' × ' + cols + ' = ' + a : rows + ' × ' + p0 + ' = ' + a);
        addLegend(1, plan.axis === 'rows' ? p1 + ' × ' + cols + ' = ' + b : rows + ' × ' + p1 + ' = ' + b);
        if (explain) say([' ' + a + ' + ' + b + ' = ' + answer + '.']);
        grid = { rows: rows, cols: cols, axis: plan.axis, parts: plan.parts };
      }
      if (explain) say([' So ', bold(card.text + ' = ' + card.answer), '.']);
      if (turned) say([' Same squares, turned sideways: ' + cols + ' × ' + rows + ' is the same as ' + rows + ' × ' + cols + '.']);
    } else {
      const d = card.fact.divisor, q = card.fact.quotient, D = card.fact.dividend;
      const chunk = q > 10 ? 10 : q > 5 ? 5 : 0;
      if (explain) {
        say([bold(D + ' ÷ ' + d + ' = ' + q), ', because ' + d + ' rows of ' + q + ' make ' + D + '. (' + d + ' × ' + q + ' = ' + D + ')']);
        if (chunk) {
          addLegend(0, d + ' × ' + chunk + ' = ' + d * chunk);
          addLegend(1, d + ' × ' + (q - chunk) + ' = ' + d * (q - chunk));
          grid = { rows: d, cols: q, axis: 'cols', parts: [chunk, q - chunk] };
        } else {
          grid = { rows: d, cols: q };
        }
      } else if (chunk) {
        const left = D - d * chunk;
        say(['Think: ', bold(d + ' × ? = ' + D), '. ' + d + ' rows of ' + chunk + ' make ' + d * chunk + '. That leaves ' + left + '. How many more columns of ' + d + ' make ' + left + '?']);
        addLegend(0, d + ' × ' + chunk + ' = ' + d * chunk);
        addLegend(1, left + ' left over');
        grid = { rows: d, cols: q, axis: 'cols', parts: [chunk, q - chunk], hideRest: true, topLabels: [String(chunk), '?'] };
      } else {
        say(['Think: ', bold(d + ' × ? = ' + D), '. Each column has ' + d + ' squares. Count by ' + d + 's until you reach ' + D + '.']);
        grid = { rows: d, cols: q, topLabels: ['?'] };
      }
    }
    $('#gridWrap').replaceChildren(drawGrid(grid));
  }

  // A rectangle of squares. Optional split into two colored parts along rows or columns.
  function drawGrid(g) {
    const cell = 24, padL = 34, padT = 30;
    const W = padL + g.cols * cell + 4, H = padT + g.rows * cell + 4;
    const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'A rectangle of squares, ' + g.rows + ' rows tall' + (g.topLabels ? '' : ' and ' + g.cols + ' columns wide') });
    const split = g.parts ? g.parts[0] : Infinity;
    const partOf = (r, c) => (g.axis === 'rows' ? r : c) < split ? 0 : 1;

    for (let r = 0; r < g.rows; r++) {
      for (let c = 0; c < g.cols; c++) {
        const part = g.parts ? partOf(r, c) : 0;
        if (g.hideRest && part === 1) continue;
        const rect = svgEl('rect', { x: padL + c * cell, y: padT + r * cell, width: cell, height: cell, rx: 3, fill: COLORS[part], stroke: '#fff', 'stroke-width': 2, class: 'cell' });
        rect.style.setProperty('--d', r + c * 0.25);
        svg.append(rect);
      }
    }
    if (g.hideRest) {
      const x0 = padL + split * cell;
      svg.append(svgEl('rect', { x: x0 + 1, y: padT + 1, width: (g.cols - split) * cell - 2, height: g.rows * cell - 2, rx: 6, fill: '#FFD6E8', stroke: COLORS[1], 'stroke-width': 2.5, 'stroke-dasharray': '6 4' }));
      const q = svgEl('text', { x: x0 + (g.cols - split) * cell / 2, y: padT + g.rows * cell / 2 + 10, 'text-anchor': 'middle', 'font-size': 28, 'font-weight': 800, fill: '#A8306C', 'font-family': 'Grandstander, sans-serif' });
      q.textContent = '?';
      svg.append(q);
    }
    if (g.parts) {
      const line = g.axis === 'rows'
        ? { x1: padL - 4, x2: padL + g.cols * cell + 4, y1: padT + split * cell, y2: padT + split * cell }
        : { y1: padT - 4, y2: padT + g.rows * cell + 4, x1: padL + split * cell, x2: padL + split * cell };
      svg.append(svgEl('line', Object.assign(line, { stroke: '#2A1F45', 'stroke-width': 3, 'stroke-linecap': 'round' })));
    }

    const label = (x, y, t, anchor) => {
      const e = svgEl('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-size': 16, 'font-weight': 700, fill: '#2A1F45', 'font-family': 'Lexend, sans-serif' });
      e.textContent = t;
      svg.append(e);
    };
    // Numbers along the top (columns) and left side (rows)
    if (g.axis === 'cols') {
      const tops = g.topLabels || [String(g.parts[0]), String(g.parts[1])];
      label(padL + split * cell / 2, 20, tops[0]);
      label(padL + split * cell + (g.cols - split) * cell / 2, 20, tops[1]);
    } else {
      label(padL + g.cols * cell / 2, 20, g.topLabels ? g.topLabels[0] : String(g.cols));
    }
    if (g.axis === 'rows') {
      label(padL - 10, padT + split * cell / 2 + 6, String(g.parts[0]), 'end');
      label(padL - 10, padT + split * cell + (g.rows - split) * cell / 2 + 6, String(g.parts[1]), 'end');
    } else {
      label(padL - 10, padT + g.rows * cell / 2 + 6, String(g.rows), 'end');
    }
    return svg;
  }

  $('#helpBtn').addEventListener('click', e => { e.currentTarget.blur(); if (mode === 'answering') showHelp(false); });
  $('#turnBtn').addEventListener('click', e => { e.currentTarget.blur(); turned = !turned; drawHelp(mode === 'wrong'); });
  $('#nextBtn').addEventListener('click', () => { if (mode === 'wrong') nextCard(); });
  $('#keypad').addEventListener('click', e => {
    const b = e.target.closest('[data-key]');
    if (!b) return;
    b.blur();   // so the Enter key always means Check, not "press the last button again"
    press(b.dataset.key);
  });
  document.addEventListener('keydown', e => {
    if ($('#play').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter' || e.key === ' ') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;   // the button handles it
      e.preventDefault();
      press('check');
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      press('del');
    } else if (/^\d$/.test(e.key)) {
      press(e.key);
    }
  });

  /* ── Finishing ── */

  function median(list) {
    if (!list.length) return 0;
    const s = list.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function updateMemory() {
    const now = Date.now();
    results.forEach(r => {
      const f = memory.facts[r.key] || { b: 0 };
      if (!r.correct) f.b = 1;
      else if (!r.hint && (!SPEED_MS || r.ms <= SPEED_MS)) f.b = Math.min(5, Math.max(1, f.b || 0) + 1);   // a new fact answered well starts in box 2
      else f.b = Math.max(1, f.b || 0);
      f.t = now;
      memory.facts[r.key] = f;
    });
  }

  async function finishRound() {
    mode = 'done';
    const right = results.filter(r => r.correct && !r.hint).length;
    $('#resTitle').textContent = 'Round complete!';
    $('#resRight').textContent = right + ' of ' + results.length;
    $('#resTime').textContent = (median(results.map(r => r.ms)) / 1000).toFixed(1) + ' s';
    $('#resGems').textContent = '…';
    $('#resGemsLabel').textContent = 'saving your round';
    $('#resStars').replaceChildren();
    $('#resMsg').hidden = true;
    $('#resTicket').hidden = true;
    $('#againBtn').disabled = true;
    show('#results');

    updateMemory();
    const [res] = await Promise.all([round.finish(), MathRealm.saveState(GAME_ID, memory)]);
    showResult(res, right);
    $('#againBtn').disabled = false;
  }

  function showResult(res, right) {
    const msg = $('#resMsg');
    msg.replaceChildren();
    const line = t => msg.append(el('p', '', t));

    if (res.ok) {
      $('#resGems').textContent = '+' + res.points.total;
      $('#resGemsLabel').textContent = C.pointsName + ' (you have ' + Number(res.points.balance).toLocaleString() + ')';
      updateGems();
      const m = res.mastery;
      const mastered = m.status === 'mastered';
      $('#resStars').replaceChildren(starRow(Math.min(m.days, m.daysNeeded), m.daysNeeded, mastered, m.newlyMastered || res.round.qualifies));

      if (m.newlyMastered) {
        $('#resTitle').textContent = 'You mastered it!';
        line('You mastered ' + skill.name + '!');
        RealmFX.fanfare();
        RealmFX.confetti();
      } else if (mastered) {
        line('You already mastered this one. Nice job keeping it sharp!');
      } else if (res.round.qualifies) {
        line("Today's star is yours! Come back on another day to earn the next one.");
        RealmFX.correct();
      } else {
        if (right < NEED_RIGHT) line("For today's star, get " + NEED_RIGHT + ' of ' + ROUND_SIZE + ' right without the grid. You got ' + right + '.');
        if (SPEED_MS && !res.round.fastEnough) line("For today's star, try to answer a little faster: about " + SPEED_MS / 1000 + ' seconds a card.');
        if (!msg.childNodes.length) line('Keep practicing!');
      }
      if (res.ticket) {
        const wrap = $('#resTicket');
        const stub = el('div', 'ticket');
        stub.append(el('strong', '', res.ticket.code), el('span', '', res.ticket.skillName));
        wrap.replaceChildren(stub, el('p', '', 'A golden ticket! Show this code to your teacher to trade it for a prize.'));
        wrap.hidden = false;
        if (!m.newlyMastered) RealmFX.confetti();
      }
    } else if (res.queued) {
      $('#resGems').textContent = 'Saved';
      $('#resGemsLabel').textContent = 'on this computer';
      line('The internet dropped, so your round is saved on this computer. It will send by itself when the internet is back, and your stars will update then.');
    } else {
      $('#resGems').textContent = '—';
      $('#resGemsLabel').textContent = 'not saved';
      line(MathRealm.errorMessage(res.error, true));
    }
    msg.hidden = !msg.childNodes.length;
  }
})();
