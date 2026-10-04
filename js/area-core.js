/*
 * Math Realm: Rectangle Kingdom core (shared by the game and the "See how it works" demo)
 *
 *   const p = AreaCore.make('area2');            // random problem
 *   const p = AreaCore.make('area2', [34, 27]);  // fixed numbers (the demo uses these)
 *   p.render(container);                         // draws it; every box gets an .input
 *   p.boxes  → in order: { type, answer, step, help(reveal) → [lines], input, ... }
 *   p.update()                                   // refresh labels after a box is done
 *   AreaCore.fill(box, value)  AreaCore.mark(box, 'ok' | 'bad' | 'shown' | '')  AreaCore.host(box)
 *
 * Kinds: tens (30 × 20), area1 (482 × 9), area2 (34 × 27 with a diagram), partial2 (no diagram)
 */
(function () {
  'use strict';

  const PLACE = ['ones', 'tens', 'hundreds', 'thousands', 'ten thousands'];
  const PLACE_SHORT = ['O', 'T', 'H', 'Th', 'TTh'];

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
      : ['Add one column at a time, starting with the ones column on the right. Type each digit as you find it. It fills in from the right, just like on paper.',
         'If a column adds up to 10 or more, regroup: write the ones digit and carry the ten to the next column.'];
  }
  // Column addition, ones first: [{ place, digits, carryIn, sum, write, carryOut }]
  function columnSteps(list, total) {
    const cols = String(total).length, steps = [];
    let carry = 0;
    for (let c = 0; c < cols; c++) {
      const digits = list.map(v => Math.floor(v / Math.pow(10, c)) % 10).filter((d, i) => list[i] >= Math.pow(10, c));
      const sum = digits.reduce((a, b) => a + b, 0) + carry;
      steps.push({ place: PLACE[c], digits: digits, carryIn: carry, sum: sum, write: sum % 10, carryOut: Math.floor(sum / 10) });
      carry = Math.floor(sum / 10);
    }
    return steps;
  }

  // Blocks picture for the tens skill: 30 × 20 is 3 × 2 blocks of 100.
  function blocksPicture(x, y) {
    const a = frontZeros(x), b = frontZeros(y);
    const unit = Math.pow(10, a.zeros + b.zeros);
    if (unit === 1 || a.front * b.front > 48) return null;
    const bw = 56, bh = 38, padL = 48, padT = 30;
    const W = padL + a.front * bw + 4, H = padT + b.front * bh + 4;
    const svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': a.front + ' by ' + b.front + ' blocks of ' + unit });
    for (let r = 0; r < b.front; r++) {
      for (let c = 0; c < a.front; c++) {
        svg.append(svgEl('rect', { x: padL + c * bw, y: padT + r * bh, width: bw, height: bh, rx: 4, fill: '#E9DDFF', stroke: '#fff', 'stroke-width': 3 }));
        const t = svgEl('text', { x: padL + c * bw + bw / 2, y: padT + r * bh + bh / 2 + 6, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, fill: '#6C4FB3', 'font-family': 'Lexend, sans-serif' });
        t.textContent = unit;
        svg.append(t);
      }
    }
    const lbl = (x0, y0, t, anchor) => {
      const e = svgEl('text', { x: x0, y: y0, 'text-anchor': anchor, 'font-size': 18, 'font-weight': 700, fill: '#2A1F45', 'font-family': 'Lexend, sans-serif' });
      e.textContent = t;
      svg.append(e);
    };
    lbl(padL + a.front * bw / 2, 20, fmt(x), 'middle');
    lbl(padL - 10, padT + b.front * bh / 2 + 6, fmt(y), 'end');
    return svg;
  }

  /* ── Problems ── */

  function tensProblem(nums) {
    let x, y;
    if (nums) { x = nums[0]; y = nums[1]; }
    else {
      x = rnd(2, 9) * 10; y = rnd(2, 9);
      if (Math.random() < 0.4) y *= 10;
      if (Math.random() < 0.5) { const t = x; x = y; y = t; }
    }
    const p = { kind: 'tens', text: fmt(x) + ' × ' + fmt(y), n: x, m: y, total: x * y, boxes: [] };
    const unit = Math.pow(10, frontZeros(x).zeros + frontZeros(y).zeros);
    const blockLine = unit === 100 ? 'In the picture, each block is 10 × 10 = 100.' : unit === 10 ? 'In the picture, each block is 10 × 1 = 10.' : null;
    p.boxes.push({
      type: 'answer', answer: x * y, step: 'Multiply ' + fmt(x) + ' × ' + fmt(y) + ', then press Enter.',
      help: r => productHelp(x, y, r).concat(blockLine && blocksPicture(x, y) ? [blockLine] : []),
      picture: () => blocksPicture(x, y),
    });
    p.render = work => {
      const row = el('div', 'single');
      row.append(el('span', '', fmt(x) + ' × ' + fmt(y) + ' ='));
      p.boxes[0].input = numInput('Answer');
      row.append(p.boxes[0].input);
      work.append(row);
    };
    return p;
  }

  function area1Problem(nums) {
    let n, m;
    if (nums) { n = nums[0]; m = nums[1]; }
    else {
      const r = Math.random();
      const len = r < 0.4 ? 2 : r < 0.8 ? 3 : 4;
      n = rnd(1, 9);
      for (let i = 1; i < len; i++) n = n * 10 + rnd(1, 9);
      m = rnd(2, 9);
    }
    const tops = placeParts(n);
    const p = { kind: 'area1', text: fmt(n) + ' × ' + m, n: n, m: m, total: n * m, tops: tops, sides: [m], sideGiven: true, boxes: [] };
    tops.forEach((t, i) => p.boxes.push({
      type: 'top', i: i, answer: t,
      step: i === 0
        ? 'Write ' + fmt(n) + ' in expanded form along the top of the rectangle. Start with the ' + placeOf(t) + '.'
        : 'Keep writing ' + fmt(n) + ' in expanded form: now the ' + placeOf(t) + '.',
      help: rv => splitHelp(n, t, rv),
    }));
    tops.forEach((t, i) => p.boxes.push({
      type: 'part', row: 0, col: i, answer: t * m,
      step: 'Find the area of this part: ' + fmt(t) + ' × ' + m + '.',
      help: rv => productHelp(t, m, rv),
    }));
    const list = tops.map(t => t * m);
    p.boxes.push({
      type: 'total', answer: n * m, list: list,
      step: 'Add the partial products to find ' + fmt(n) + ' × ' + m + '. Start with the ones column and type the ones digit first.',
      help: rv => addHelp(list, n * m, rv),
    });
    p.render = work => renderWithDiagram(work, p);
    return p;
  }

  function twoByTwoProblem(noDiagram, nums) {
    let n, m;
    if (nums) { n = nums[0]; m = nums[1]; }
    else {
      do {
        n = rnd(1, 9) * 10 + rnd(1, 9);
        m = rnd(1, 9) * 10 + rnd(1, 9);
      } while (n < 20 && m < 20);
    }
    const tops = placeParts(n), sides = placeParts(m);
    const p = { kind: noDiagram ? 'partial2' : 'area2', text: n + ' × ' + m, n: n, m: m, total: n * m, tops: tops, sides: sides, boxes: [] };

    if (!noDiagram) {
      tops.forEach((t, i) => p.boxes.push({
        type: 'top', i: i, answer: t,
        step: i === 0 ? 'Write ' + n + ' in expanded form along the top. Start with the tens.' : 'Keep writing ' + n + ' in expanded form: now the ones.',
        help: rv => splitHelp(n, t, rv),
      }));
      sides.forEach((s, i) => p.boxes.push({
        type: 'side', i: i, answer: s,
        step: i === 0 ? 'Now write ' + m + ' in expanded form along the side. Start with the tens.' : 'Keep writing ' + m + ' in expanded form: now the ones.',
        help: rv => splitHelp(m, s, rv),
      }));
      sides.forEach((s, r) => tops.forEach((t, c) => p.boxes.push({
        type: 'part', row: r, col: c, answer: s * t,
        step: 'Find the area of this part: ' + t + ' × ' + s + '.',
        help: rv => productHelp(t, s, rv),
      })));
      const list = sides.flatMap(s => tops.map(t => s * t));
      p.boxes.push({
        type: 'total', answer: n * m, list: list,
        step: 'Add the four partial products to find ' + n + ' × ' + m + '. Start with the ones column and type the ones digit first.',
        help: rv => addHelp(list, n * m, rv),
      });
      p.render = work => renderWithDiagram(work, p);
    } else {
      // Same order as the written method: ones × ones first, tens × tens last.
      const order = [];
      sides.slice().reverse().forEach(s => tops.slice().reverse().forEach(t => order.push([t, s])));
      order.forEach(([t, s]) => p.boxes.push({
        type: 'part', label: t + ' × ' + s, answer: t * s, editable: true,
        step: 'Find the partial product ' + t + ' × ' + s + ' and type it on its line.',
        help: rv => productHelp(t, s, rv),
      }));
      const list = order.map(([t, s]) => t * s);
      p.boxes.push({
        type: 'total', answer: n * m, list: list,
        step: 'Add the partial products to find ' + n + ' × ' + m + '. Start with the ones column and type the ones digit first.',
        help: rv => addHelp(list, n * m, rv),
      });
      p.render = work => {
        const solo = el('div', 'solo');
        solo.append(renderPaper(p, true));
        work.append(solo);
      };
    }
    return p;
  }

  /* ── Drawing ── */

  // A row of digits lined up in place-value columns. Editable rows have a real input on top.
  // rightToLeft: each digit typed goes one column further left, ones first, like adding on paper.
  // Otherwise the typed number is shown lined up on the right (for numbers typed whole).
  function digitRow(cols, value, editable, label, rightToLeft) {
    const row = el('div', 'drow' + (editable ? ' edit waiting' : ''));
    row.style.gridColumn = '2 / span ' + cols;
    row.style.gridTemplateColumns = 'repeat(' + cols + ', var(--cell))';
    const cells = [];
    for (let i = 0; i < cols; i++) { const c = el('span', 'cell'); cells.push(c); row.append(c); }
    let input = null;
    const paint = text => {
      const digits = String(text == null ? '' : text).replace(/[^0-9?]/g, '').slice(-cols);
      const focused = input && document.activeElement === input && !input.disabled;
      cells.forEach((c, i) => {
        const k = i - (cols - digits.length);
        c.textContent = k >= 0 ? digits[k] : '';
        c.classList.toggle('q', digits[k] === '?');
        c.classList.toggle('next', !!(rightToLeft && focused && digits.length < cols && i === cols - 1 - digits.length));
      });
    };
    paint(value);
    if (!editable) return { row: row, paint: paint };

    input = el('input');
    input.type = 'text';
    input.inputMode = 'numeric';
    input.autocomplete = 'off';
    input.maxLength = cols;
    input.disabled = true;
    input.setAttribute('aria-label', label + (rightToLeft ? '. Type the ones digit first.' : ''));
    if (rightToLeft) {
      input.addEventListener('beforeinput', e => {
        const all = input.value && input.selectionStart === 0 && input.selectionEnd === input.value.length;
        if (e.inputType === 'insertText' || e.inputType === 'insertReplacementText' || e.inputType === 'insertFromPaste') {
          e.preventDefault();
          const d = String(e.data || '').replace(/[^0-9]/g, '');
          if (!d) return;
          if (d.length > 1) input.value = d.slice(-cols);                    // pasted a whole number
          else if (all) input.value = d;                                      // typing over a selected answer
          else if (input.value.length < cols) input.value = d + input.value;  // next column to the left
        } else if (e.inputType.indexOf('delete') === 0) {
          e.preventDefault();
          input.value = all ? '' : input.value.slice(1);                      // erase the last digit typed
        } else return;
        paint(input.value);
      });
    }
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '').slice(0, cols);
      paint(input.value);
    });
    input.addEventListener('focus', () => paint(input.value));
    input.addEventListener('blur', () => paint(input.value));
    row.append(input);
    return { row: row, input: input, paint: paint };
  }

  // A vertical stack of numbers in place-value columns with labels on top.
  // rows: [{ op, value | editable box, note }] separated by rules where row.rule is true.
  function paperGrid(cols, rows, withNotes) {
    const paper = el('div', 'paper' + (withNotes ? ' notes' : ''));
    paper.style.gridTemplateColumns = 'var(--op) repeat(' + cols + ', var(--cell))' + (withNotes ? ' auto' : '');
    paper.append(el('span'));
    for (let i = cols - 1; i >= 0; i--) {
      const h = el('span', 'head', PLACE_SHORT[i]);
      h.title = PLACE[i];
      paper.append(h);
    }
    if (withNotes) paper.append(el('span'));
    rows.forEach(r => {
      if (r.rule) {
        const line = el('div', 'rule');
        line.style.gridColumn = '1 / span ' + (cols + 1);
        paper.append(line);
        if (withNotes) paper.append(el('span'));
        return;
      }
      paper.append(el('span', 'op', r.op || ''));
      paper.append(r.el);
      if (withNotes) paper.append(el('span', 'note', r.note || ''));
    });
    const wrap = el('div', 'paper-wrap');
    wrap.append(paper);
    const used = [];
    for (let i = cols - 1; i >= 0; i--) used.push(PLACE_SHORT[i] + ' = ' + PLACE[i]);
    wrap.append(el('p', 'key', used.join(', ')));
    return wrap;
  }

  // The "paper" column: the problem written vertically, then the partial products and their sum.
  function renderPaper(p, withNotes) {
    const cols = String(p.total).length;
    const rows = [
      { el: digitRow(cols, p.n).row },
      { op: '×', el: digitRow(cols, p.m).row },
      { rule: true },
    ];
    const parts = p.boxes.filter(b => b.type === 'part');
    p.paperRows = [];
    parts.forEach((b, i) => {
      const d = digitRow(cols, b.editable ? '' : '?', !!b.editable, 'Partial product ' + (b.label || ''), false);
      if (b.editable) { b.input = d.input; b.host = d.row; b.digits = true; b.paint = d.paint; }
      else p.paperRows.push({ box: b, paint: d.paint });
      rows.push({ op: i === parts.length - 1 ? '+' : '', el: d.row, note: b.label });
    });
    rows.push({ rule: true });
    const total = p.boxes.find(b => b.type === 'total');
    const t = digitRow(cols, '', true, 'Total', true);
    total.input = t.input; total.host = t.row; total.digits = true; total.paint = t.paint;
    rows.push({ el: t.row, note: withNotes ? 'add them up' : '' });
    return paperGrid(cols, rows, withNotes);
  }

  // Display-only stack (used by the demo to show the standard algorithm).
  function stackView(lines, total, ops) {
    const cols = String(Math.max.apply(null, lines.concat([total]))).length;
    const rows = [];
    lines.forEach((v, i) => {
      if (i === 2) rows.push({ rule: true });
      rows.push({ op: ops[i] || '', el: digitRow(cols, String(v)).row });
    });
    rows.push({ rule: true });
    rows.push({ el: digitRow(cols, String(total)).row });
    return paperGrid(cols, rows, false);
  }

  // Bigger places get more room, so 30 looks bigger than 4 (the diagram is not to scale).
  const weight = v => String(v).length;

  function renderWithDiagram(work, p) {
    const split = el('div', 'split');
    split.append(renderPaper(p, false));

    const wrap = el('div', 'area-wrap');
    const grid = el('div', 'area');
    const k = window.innerWidth < 640 ? 0.7 : 1;
    grid.style.gridTemplateColumns = 'auto ' + p.tops.map(t => Math.round(k * (92 + 32 * weight(t))) + 'px').join(' ');
    grid.style.gridTemplateRows = 'auto ' + p.sides.map(s => Math.round(Math.max(p.sides.length === 1 ? 140 : 0, 80 + 32 * weight(s)) * (k < 1 ? 0.85 : 1)) + 'px').join(' ');
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
      p.paperRows.forEach(pr => pr.paint(pr.box.done ? String(pr.box.answer) : '?'));
    };
  }

  /* ── Box helpers ── */

  const host = b => b.host || b.input;
  function mark(b, state) {
    const h = host(b);
    h.classList.remove('ok', 'bad', 'shown');
    void h.offsetWidth;   // restart the shake animation
    if (state) h.classList.add(state);
  }
  function fill(b, v) {
    b.input.value = b.digits ? String(v) : fmt(v);
    if (b.paint) b.paint(b.input.value);
  }

  window.AreaCore = {
    make(kind, nums) {
      if (kind === 'tens') return tensProblem(nums);
      if (kind === 'area1') return area1Problem(nums);
      return twoByTwoProblem(kind === 'partial2', nums);
    },
    host: host, mark: mark, fill: fill,
    fmt: fmt, el: el, svgEl: svgEl,
    placeParts: placeParts, placeOf: placeOf, frontZeros: frontZeros,
    columnSteps: columnSteps, blocksPicture: blocksPicture, stackView: stackView,
    PLACE: PLACE,
  };
})();
