/*
 * Math Realm: Rectangle Kingdom (Unit 6, multi-digit multiplication)
 * Plays the four Unit 6 skills from the Skills tab:
 *   g4.u6.tens      Multiply with tens: 30 × 4, 30 × 20
 *   g4.u6.area1     Area diagrams: multi-digit × 1-digit (263 × 4)
 *   g4.u6.area2     Area diagrams: 2-digit × 2-digit (34 × 27)
 *   g4.u6.partial2  Partial products, no diagram (34 × 27 as a stack)
 *
 * Students fill one box at a time and press Enter. A wrong answer gets a
 * second try; a second miss shows the answer and explains it. A problem
 * counts toward the star only if no answer had to be shown and
 * "Show me how" wasn't used.
 */
(function () {
  'use strict';
  if (!MathRealm.requireLogin()) return;

  const GAME_ID = 'rectangles';
  const C = window.MATH_REALM_CATALOG;
  const $ = s => document.querySelector(s);
  const STAR_PATH = 'M14 2.8l3.4 7 7.7 1-5.6 5.3 1.4 7.6L14 19.9l-6.9 3.8 1.4-7.6-5.6-5.3 7.7-1z';
  const PRAISE = ['You got it!', 'Nice work!', 'Great building!', 'Super!', 'Yes!'];
  const KINDS = { 'g4.u6.tens': 'tens', 'g4.u6.area1': 'area1', 'g4.u6.area2': 'area2', 'g4.u6.partial2': 'partial2' };
  const HOW = {
    tens: 'Multiply numbers that end in zero. Tip: multiply the front digits, then count the zeros and put them on the end.',
    area1: 'Write the big number in expanded form along the top of the rectangle (482 = 400 + 80 + 2). Find the area of each part. Then add the parts, lined up by place value.',
    area2: 'Write both numbers in expanded form along the edges of the rectangle (34 = 30 + 4). Find the area of all four parts, then add them, lined up by place value.',
    partial2: 'Find the four partial products and add them, lined up by place value. No rectangle this time, but you can still picture it!',
  };

  const session = MathRealm.session;
  const skillId = new URLSearchParams(location.search).get('skill') || '';
  const skill = (session.skills || []).find(k => k.skillId === skillId);
  const kind = KINDS[skillId];

  setupTopbar();
  if (!skill || !kind) { show('#missing'); return; }

  const ROUND_SIZE = skill.minItems;
  const NEED_RIGHT = Math.ceil(skill.minAccuracy * ROUND_SIZE - 1e-9);

  let round = null, results = [], count = 0;
  let problem = null, boxIdx = -1, tries = 0, helped = false, revealed = false, startedAt = 0, mode = 'idle';

  /* ── Small helpers ── */

  const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const fmt = n => Number(n).toLocaleString('en-US');
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
  function show(id) {
    ['#intro', '#play', '#results', '#missing'].forEach(s => { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }
  function setupTopbar() {
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
  }
  function updateGems() {
    const s = MathRealm.session;
    $('#gemCount').textContent = s ? Number(s.student.points || 0).toLocaleString() : '0';
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
  function numInput(label) {
    const i = el('input', 'num');
    i.type = 'text';
    i.inputMode = 'numeric';
    i.autocomplete = 'off';
    i.maxLength = 7;
    i.setAttribute('aria-label', label);
    i.disabled = true;
    return i;
  }

  /* ── Math pieces ── */

  const PLACE = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands'];
  const PLACE_SHORT = ['O', 'T', 'H', 'Th', 'TTh'];

  // 482 → [400, 80, 2]  (expanded form)
  function placeParts(n) {
    const s = String(n), out = [];
    for (let i = 0; i < s.length; i++) {
      const d = Number(s[i]);
      if (d) out.push(d * Math.pow(10, s.length - 1 - i));
    }
    return out;
  }
  // 300 → { front: 3, zeros: 2 }
  function frontZeros(x) {
    let z = 0;
    while (x > 0 && x % 10 === 0) { x /= 10; z++; }
    return { front: x, zeros: z };
  }
  const placeOf = v => PLACE[frontZeros(v).zeros];
  const zeroWords = z => z === 1 ? 'one zero' : z === 2 ? 'two zeros' : z === 3 ? 'three zeros' : z + ' zeros';

  function productHelp(x, y, reveal) {
    const a = frontZeros(x), b = frontZeros(y), z = a.zeros + b.zeros;
    if (z === 0) return reveal ? [x + ' × ' + y + ' = ' + (x * y) + '.'] : ["It's a times fact: " + x + ' × ' + y + '.'];
    const lines = [
      'Multiply the front digits: ' + a.front + ' × ' + b.front + (reveal ? ' = ' + a.front * b.front : '') + '.',
      'Then count the zeros in ' + fmt(x) + ' and ' + fmt(y) + ': ' + zeroWords(z) + '. Put ' + (z === 1 ? 'it' : 'them') + ' on the end.',
    ];
    if (reveal) lines.push('So ' + fmt(x) + ' × ' + fmt(y) + ' = ' + fmt(x * y) + '.');
    return lines;
  }
  function splitHelp(n, value, reveal) {
    const fz = frontZeros(value);
    const line = 'In ' + fmt(n) + ', the ' + fz.front + ' is in the ' + PLACE[fz.zeros] + ' place.';
    return reveal
      ? [line + ' It is worth ' + fmt(value) + '.', 'In expanded form, ' + fmt(n) + ' = ' + placeParts(n).map(fmt).join(' + ') + '.']
      : ['Expanded form writes a number as what each digit is worth.', line + ' What is it worth?'];
  }
  function addHelp(list, total, reveal) {
    return reveal
      ? ['Add the partial products: ' + list.map(fmt).join(' + ') + ' = ' + fmt(total) + '.']
      : ['Add one place at a time, starting with the ones column on the right.', 'If a column adds up to 10 or more, regroup: carry the extra ten to the next place.'];
  }

  // Blocks picture for the tens skill: 30 × 20 is 3 × 2 blocks of 100.
  function blocksPicture(x, y) {
    const a = frontZeros(x), b = frontZeros(y);
    const unit = Math.pow(10, a.zeros + b.zeros);
    if (unit === 1 || a.front * b.front > 48) return null;
    const bw = 52, bh = 34, padL = 44, padT = 28;
    const W = padL + a.front * bw + 4, H = padT + b.front * bh + 4;
    const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': a.front + ' by ' + b.front + ' blocks of ' + unit });
    for (let r = 0; r < b.front; r++) {
      for (let c = 0; c < a.front; c++) {
        svg.append(svgEl('rect', { x: padL + c * bw, y: padT + r * bh, width: bw, height: bh, rx: 4, fill: '#E9DDFF', stroke: '#fff', 'stroke-width': 3 }));
        const t = svgEl('text', { x: padL + c * bw + bw / 2, y: padT + r * bh + bh / 2 + 6, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700, fill: '#6C4FB3', 'font-family': 'Lexend, sans-serif' });
        t.textContent = unit;
        svg.append(t);
      }
    }
    const lbl = (x0, y0, t, anchor) => {
      const e = svgEl('text', { x: x0, y: y0, 'text-anchor': anchor, 'font-size': 17, 'font-weight': 700, fill: '#2A1F45', 'font-family': 'Lexend, sans-serif' });
      e.textContent = t;
      svg.append(e);
    };
    lbl(padL + a.front * bw / 2, 19, fmt(x), 'middle');
    lbl(padL - 10, padT + b.front * bh / 2 + 6, fmt(y), 'end');
    return svg;
  }

  /* ── Problems ── */

  function makeProblem() {
    if (kind === 'tens') return tensProblem();
    if (kind === 'area1') return area1Problem();
    return twoByTwoProblem(kind === 'partial2');
  }

  function tensProblem() {
    let x = rnd(2, 9) * 10, y = rnd(2, 9);
    if (Math.random() < 0.4) y *= 10;
    if (Math.random() < 0.5) { const t = x; x = y; y = t; }
    const p = { text: x + ' × ' + y, total: x * y, boxes: [] };
    const unit = Math.pow(10, frontZeros(x).zeros + frontZeros(y).zeros);
    const blockLine = unit === 100 ? 'In the picture, each block is 10 × 10 = 100.' : unit === 10 ? 'In the picture, each block is 10 × 1 = 10.' : null;
    p.boxes.push({
      answer: x * y, step: 'Multiply, then press Enter.',
      help: r => productHelp(x, y, r).concat(blockLine && blocksPicture(x, y) ? [blockLine] : []),
      picture: () => blocksPicture(x, y),
    });
    p.render = work => {
      const row = el('div', 'single');
      row.append(el('span', '', x + ' × ' + y + ' ='));
      p.boxes[0].input = numInput('Answer');
      row.append(p.boxes[0].input);
      work.append(row);
    };
    return p;
  }

  function area1Problem() {
    const r = Math.random();
    const len = r < 0.4 ? 2 : r < 0.8 ? 3 : 4;
    let n = rnd(1, 9);
    for (let i = 1; i < len; i++) n = n * 10 + rnd(1, 9);
    const m = rnd(2, 9);
    const tops = placeParts(n);
    const p = { text: fmt(n) + ' × ' + m, n: n, m: m, total: n * m, tops: tops, sides: [m], sideGiven: true, boxes: [] };
    tops.forEach((t, i) => p.boxes.push({
      type: 'top', i: i, answer: t,
      step: i === 0 ? 'Write ' + fmt(n) + ' in expanded form along the top. Start with the ' + placeOf(t) + '.' : 'Keep going: the ' + placeOf(t) + '.',
      help: rv => splitHelp(n, t, rv),
    }));
    tops.forEach((t, i) => p.boxes.push({
      type: 'part', row: 0, col: i, answer: t * m,
      step: 'Find the area of each part of the rectangle.',
      help: rv => productHelp(t, m, rv),
    }));
    p.boxes.push({ type: 'total', answer: n * m, step: 'Add the partial products. They are lined up by place value, so add one column at a time.', help: rv => addHelp(tops.map(t => t * m), n * m, rv) });
    p.render = work => renderWithDiagram(work, p);
    return p;
  }

  function twoByTwoProblem(noDiagram) {
    let n, m;
    do {
      n = rnd(1, 9) * 10 + rnd(1, 9);
      m = rnd(1, 9) * 10 + rnd(1, 9);
    } while (n < 20 && m < 20);
    const tops = placeParts(n), sides = placeParts(m);
    const p = { text: n + ' × ' + m, n: n, m: m, total: n * m, tops: tops, sides: sides, boxes: [] };

    if (!noDiagram) {
      tops.forEach((t, i) => p.boxes.push({
        type: 'top', i: i, answer: t,
        step: i === 0 ? 'Write ' + n + ' in expanded form along the top. Start with the tens.' : 'Now the ones in ' + n + '.',
        help: rv => splitHelp(n, t, rv),
      }));
      sides.forEach((s, i) => p.boxes.push({
        type: 'side', i: i, answer: s,
        step: i === 0 ? 'Now write ' + m + ' in expanded form along the side. Start with the tens.' : 'Now the ones in ' + m + '.',
        help: rv => splitHelp(m, s, rv),
      }));
      sides.forEach((s, r) => tops.forEach((t, c) => p.boxes.push({
        type: 'part', row: r, col: c, answer: s * t,
        step: 'Find the area of each of the four parts.',
        help: rv => productHelp(t, s, rv),
      })));
      p.boxes.push({ type: 'total', answer: n * m, step: 'Add the four partial products. They are lined up by place value, so add one column at a time.', help: rv => addHelp(sides.flatMap(s => tops.map(t => s * t)), n * m, rv) });
      p.render = work => renderWithDiagram(work, p);
    } else {
      // Same order as the written method: ones × ones first, tens × tens last.
      const order = [];
      sides.slice().reverse().forEach(s => tops.slice().reverse().forEach(t => order.push([t, s])));
      order.forEach(([t, s]) => p.boxes.push({
        type: 'part', label: t + ' × ' + s, answer: t * s, editable: true,
        step: 'Find each partial product. Line the digits up with their place.',
        help: rv => productHelp(t, s, rv),
      }));
      p.boxes.push({ type: 'total', answer: n * m, step: 'Add the partial products, one column at a time.', help: rv => addHelp(order.map(([t, s]) => t * s), n * m, rv) });
      p.render = work => {
        const solo = el('div', 'solo');
        solo.append(renderPaper(p, true));
        work.append(solo);
      };
    }
    return p;
  }

  /* ── Drawing ── */

  // A row of digits lined up in place-value columns. If editable, a real input sits on top
  // and whatever the student types fills in from the right, so the ones always line up.
  function digitRow(cols, value, editable, label) {
    const row = el('div', 'drow' + (editable ? ' edit waiting' : ''));
    row.style.gridColumn = '2 / span ' + cols;
    row.style.gridTemplateColumns = 'repeat(' + cols + ', var(--cell))';
    const cells = [];
    for (let i = 0; i < cols; i++) { const c = el('span', 'cell'); cells.push(c); row.append(c); }
    const paint = text => {
      const digits = String(text == null ? '' : text).replace(/[^0-9?]/g, '').slice(-cols);
      cells.forEach((c, i) => {
        const k = i - (cols - digits.length);
        c.textContent = k >= 0 ? digits[k] : '';
        c.classList.toggle('q', digits[k] === '?');
      });
    };
    paint(value);
    if (!editable) return { row: row, paint: paint };
    const input = el('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.maxLength = cols;
    input.disabled = true;
    input.setAttribute('aria-label', label);
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '').slice(0, cols);
      paint(input.value);
    });
    row.append(input);
    return { row: row, input: input, paint: paint };
  }

  // The "paper" column: the problem written vertically, then the partial products and
  // their sum, all lined up by place value with column labels on top.
  function renderPaper(p, withNotes) {
    const cols = String(p.total).length;
    const paper = el('div', 'paper' + (withNotes ? ' notes' : ''));
    paper.style.gridTemplateColumns = 'var(--op) repeat(' + cols + ', var(--cell))' + (withNotes ? ' auto' : '');
    const line = () => { const r = el('div', 'rule'); r.style.gridColumn = '1 / span ' + (cols + 1); paper.append(r); if (withNotes) paper.append(el('span')); };
    const row = (op, rowEl, note) => { paper.append(el('span', 'op', op || '')); paper.append(rowEl); if (withNotes) paper.append(el('span', 'note', note || '')); };

    // column labels
    paper.append(el('span'));
    for (let i = cols - 1; i >= 0; i--) {
      const h = el('span', 'head', PLACE_SHORT[i]);
      h.title = PLACE[i];
      paper.append(h);
    }
    if (withNotes) paper.append(el('span'));

    row('', digitRow(cols, p.n).row);
    row('×', digitRow(cols, p.m).row);
    line();
    const parts = p.boxes.filter(b => b.type === 'part');
    p.paperRows = [];
    parts.forEach((b, i) => {
      const d = digitRow(cols, b.editable ? '' : '?', !!b.editable, 'Partial product ' + b.label);
      if (b.editable) { b.input = d.input; b.host = d.row; b.digits = true; b.paint = d.paint; }
      else p.paperRows.push({ box: b, paint: d.paint });
      row(i === parts.length - 1 ? '+' : '', d.row, b.label);
    });
    line();
    const total = p.boxes.find(b => b.type === 'total');
    const t = digitRow(cols, '', true, 'Total');
    total.input = t.input; total.host = t.row; total.digits = true; total.paint = t.paint;
    row('', t.row, withNotes ? 'add them up' : '');

    const wrap = el('div', 'paper-wrap');
    wrap.append(paper);
    const used = [];
    for (let i = cols - 1; i >= 0; i--) used.push(PLACE_SHORT[i] + ' = ' + PLACE[i]);
    wrap.append(el('p', 'key', used.join(', ')));
    return wrap;
  }

  // Bigger places get more room, so 30 looks bigger than 4 (the diagram is not to scale).
  const weight = v => String(v).length;

  function renderWithDiagram(work, p) {
    const split = el('div', 'split');
    split.append(renderPaper(p, false));

    const wrap = el('div', 'area-wrap');
    const grid = el('div', 'area');
    const k = window.innerWidth < 640 ? 0.68 : 1;   // narrower columns on small screens
    grid.style.gridTemplateColumns = 'auto ' + p.tops.map(t => Math.round(k * (80 + 30 * weight(t))) + 'px').join(' ');
    grid.style.gridTemplateRows = 'auto ' + p.sides.map(s => Math.max(p.sides.length === 1 ? 124 : 0, 66 + 28 * weight(s)) + 'px').join(' ');
    const byType = (type, i) => p.boxes.find(b => b.type === type && b.i === i);

    grid.append(el('div'));
    p.tops.forEach((t, i) => {
      const cell = el('div', 'edge top');
      const b = byType('top', i);
      b.input = numInput(placeOf(t) + ' part of ' + p.n);
      cell.append(el('span', 'place', placeOf(t)), b.input);
      grid.append(cell);
    });
    p.regions = [];
    p.sides.forEach((s, r) => {
      const left = el('div', 'edge left');
      left.append(el('span', 'place', placeOf(s)));
      if (p.sideGiven) left.append(el('span', 'given', String(s)));
      else {
        const b = byType('side', r);
        b.input = numInput(placeOf(s) + ' part of ' + p.m);
        left.append(b.input);
      }
      grid.append(left);
      p.tops.forEach((t, c) => {
        const reg = el('div', 'region r' + ((p.sides.length > 1 ? r * 2 + c : c) % 4));
        const expr = el('span', 'expr');
        const b = p.boxes.find(x => x.type === 'part' && x.row === r && x.col === c);
        b.input = numInput('Area of part');
        reg.append(expr, b.input);
        grid.append(reg);
        p.regions.push({ r: r, c: c, t: t, s: s, expr: expr });
      });
    });
    wrap.append(grid);
    split.append(wrap);
    work.append(split);

    p.update = () => {
      p.regions.forEach(g => {
        const topDone = byType('top', g.c).done;
        const sideDone = p.sideGiven || byType('side', g.r).done;
        g.expr.textContent = topDone && sideDone ? fmt(g.t) + ' × ' + fmt(g.s) : '';
      });
      // Each finished part drops into the vertical addition on the left.
      p.paperRows.forEach(pr => pr.paint(pr.box.done ? String(pr.box.answer) : '?'));
    };
  }

  /* ── Intro ── */

  const zone = C.zones.find(z => z.zone === skill.zone);
  $('#zoneName').textContent = zone ? zone.title : skill.zone;
  $('#skillTitle').textContent = skill.name;
  document.title = skill.name;
  const mine = session.mastery[skillId] || { status: '', days: 0 };
  $('#introStars').replaceChildren(starRow(Math.min(mine.days || 0, skill.daysNeeded), skill.daysNeeded, mine.status === 'mastered', false));
  $('#ruleHow').textContent = HOW[kind] + ' You get ' + ROUND_SIZE + ' problems.';
  $('#ruleStar').textContent = mine.status === 'mastered'
    ? 'You already mastered this one! Playing keeps it sharp.'
    : "To earn today's star: solve " + NEED_RIGHT + ' of ' + ROUND_SIZE + ' problems without help.';
  show('#intro');
  $('#startBtn').focus();
  $('#startBtn').addEventListener('click', startRound);
  $('#againBtn').addEventListener('click', startRound);

  /* ── Playing ── */

  function startRound() {
    round = MathRealm.startRound(GAME_ID, skillId);
    results = [];
    count = 0;
    show('#play');
    nextProblem();
  }

  function nextProblem() {
    if (count >= ROUND_SIZE) { finishRound(); return; }
    count++;
    problem = makeProblem();
    $('#title').textContent = problem.text;   // kept for screen readers; the problem is written out in the work area
    $('#title').hidden = true;
    $('#board').setAttribute('aria-label', problem.text);
    $('#board').dataset.state = '';
    $('#help').hidden = true;
    $('#hintBtn').hidden = false;
    $('#nextBtn').hidden = true;
    const work = $('#work');
    work.replaceChildren();
    problem.render(work);
    helped = false;
    revealed = false;
    boxIdx = -1;
    mode = 'solving';
    updateProgress();
    advance(false);
    startedAt = performance.now();
    round.shown();
  }

  function updateProgress() {
    $('#bar').style.width = Math.round(100 * results.length / ROUND_SIZE) + '%';
    $('#count').textContent = 'Problem ' + count + ' of ' + ROUND_SIZE;
  }

  function advance(keepHelp) {
    boxIdx++;
    if (problem.update) problem.update();
    if (!keepHelp) $('#help').hidden = true;
    if (boxIdx >= problem.boxes.length) { problemDone(); return; }
    const b = problem.boxes[boxIdx];
    tries = 0;
    $('#step').textContent = b.step;
    b.input.disabled = false;
    hostOf(b).classList.remove('waiting');
    b.input.focus();
  }

  function showHelp(lines, warn, picture) {
    const h = $('#help');
    h.replaceChildren();
    h.classList.toggle('warn', !!warn);
    lines.forEach(t => h.append(el('p', '', t)));
    if (picture) h.append(picture);
    h.hidden = false;
    h.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // A box is either a plain input or a place-value row (an input with digit cells).
  function hostOf(b) { return b.host || b.input; }
  function markBox(b, state) {
    const h = hostOf(b);
    h.classList.remove('ok', 'bad', 'shown');
    void h.offsetWidth;   // restart the shake
    if (state) h.classList.add(state);
  }
  function fillBox(b, v) {
    b.input.value = b.digits ? String(v) : fmt(v);
    if (b.paint) b.paint(b.input.value);
  }

  function check() {
    if (mode !== 'solving') return;
    const b = problem.boxes[boxIdx];
    const typed = b.input.value.replace(/[^0-9]/g, '');
    if (!typed) return;
    if (Number(typed) === b.answer) {
      fillBox(b, b.answer);
      markBox(b, 'ok');
      b.input.disabled = true;
      b.done = true;
      RealmFX.correct();
      advance(false);
      return;
    }
    tries++;
    markBox(b, 'bad');
    RealmFX.wrong();
    if (tries < 2) {
      showHelp(['Not quite. Try that box again.'], true);
      b.input.select();
    } else {
      revealed = true;
      fillBox(b, b.answer);
      markBox(b, 'shown');
      b.input.disabled = true;
      b.done = true;
      showHelp(['Here is that one:'].concat(b.help(true)), true, b.picture ? b.picture() : null);
      advance(true);
    }
  }

  function problemDone() {
    mode = 'done';
    const ms = Math.round(performance.now() - startedAt);
    const correct = !revealed;
    round.record({ prompt: problem.text, answer: String(problem.total), correct: correct, hintUsed: helped });
    results.push({ correct: correct, hint: helped, ms: ms });
    updateProgress();
    $('#board').dataset.state = 'done';
    const answer = problem.text + ' = ' + fmt(problem.total);
    $('#step').textContent = revealed
      ? answer + '. Take a look at the boxes, then try the next one.'
      : (helped ? 'You solved it! ' : PRAISE[Math.floor(Math.random() * PRAISE.length)] + ' ') + answer;
    $('#hintBtn').hidden = true;
    $('#nextBtn').hidden = false;
    $('#nextBtn').textContent = count >= ROUND_SIZE ? 'See how I did' : 'Next problem';
    $('#nextBtn').focus();
  }

  $('#hintBtn').addEventListener('click', () => {
    if (mode !== 'solving') return;
    const b = problem.boxes[boxIdx];
    helped = true;
    showHelp(b.help(false), false, b.picture ? b.picture() : null);
    b.input.focus();
  });
  $('#nextBtn').addEventListener('click', nextProblem);
  $('#work').addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); check(); }
  });

  /* ── Finishing ── */

  function median(list) {
    if (!list.length) return 0;
    const s = list.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function duration(ms) {
    const sec = Math.round(ms / 1000);
    return sec < 60 ? sec + ' s' : Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  async function finishRound() {
    mode = 'finished';
    const right = results.filter(r => r.correct && !r.hint).length;
    $('#resTitle').textContent = 'Round complete!';
    $('#resRight').textContent = right + ' of ' + results.length;
    $('#resTime').textContent = duration(median(results.map(r => r.ms)));
    $('#resGems').textContent = '…';
    $('#resGemsLabel').textContent = 'saving your round';
    $('#resStars').replaceChildren();
    $('#resMsg').hidden = true;
    $('#resTicket').hidden = true;
    $('#againBtn').disabled = true;
    show('#results');
    const res = await round.finish();
    showResult(res, right);
    $('#againBtn').disabled = false;
    $('#againBtn').focus();
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
      } else {
        line("For today's star, solve " + NEED_RIGHT + ' of ' + ROUND_SIZE + ' problems without help. You solved ' + right + '.');
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
