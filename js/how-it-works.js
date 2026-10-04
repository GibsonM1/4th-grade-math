/*
 * Math Realm: "See how it works" demo for Rectangle Kingdom (no login needed)
 *   how-it-works.html?show=area2&back=area-model.html%3Fskill%3Dg4.u6.area2
 * Builds the same drawing the game uses (area-core.js), then fills it in one
 * narrated step at a time. The last step is a note for grown-ups connecting
 * the method to the standard algorithm.
 */
(function () {
  'use strict';
  const A = window.AreaCore;
  const $ = s => document.querySelector(s);
  const fmt = A.fmt;
  const EXAMPLES = { tens: [40, 30], area1: [482, 9], area2: [34, 27], partial2: [34, 27] };
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  const params = new URLSearchParams(location.search);
  const back = params.get('back') || '';
  if (/^[A-Za-z0-9_-]+\.html(\?[A-Za-z0-9=&._%-]*)?$/.test(back)) $('#backLink').href = back;

  let kind = EXAMPLES[params.get('show')] ? params.get('show') : 'area2';
  let nums = EXAMPLES[kind];
  let problem = null, steps = [], idx = 0, playing = false, timer = null;

  /* ── Building the steps ── */

  function build() {
    problem = A.make(kind, nums, { totalMode: 'guided' });
    $('#title').textContent = problem.text;
    $('#work').replaceChildren();
    $('#extra').replaceChildren();
    problem.render($('#work'));
    $('#title').hidden = kind === 'tens';
    steps = makeSteps(problem);
  }

  function finishBox(b) {
    document.querySelectorAll('.demo-now').forEach(e => e.classList.remove('demo-now'));
    A.fill(b, b.answer);
    A.mark(b, 'ok');
    A.host(b).classList.remove('waiting');
    A.host(b).classList.add('demo-now');
    b.done = true;
    if (problem.update) problem.update();
  }

  function makeSteps(p) {
    const list = [];
    const say = (text, act, grown) => list.push({ text: text, act: act || null, grown: !!grown });
    const n = p.n, m = p.m;

    if (p.kind === 'tens') {
      const a = A.frontZeros(n), b = A.frontZeros(m);
      const unit = Math.pow(10, a.zeros + b.zeros);
      say("Let's find " + fmt(n) + ' × ' + fmt(m) + '.');
      say(fmt(n) + ' is ' + a.front + (a.zeros ? ' tens' : '') + ' and ' + fmt(m) + ' is ' + b.front + (b.zeros ? ' tens' : '') +
          '. In the picture, each block is ' + (unit === 100 ? '10 × 10 = 100' : '10 × 1 = 10') + '.',
          () => { const pic = A.blocksPicture(n, m); if (pic) $('#extra').replaceChildren(pic); });
      say('Count the blocks: ' + a.front + ' × ' + b.front + ' = ' + a.front * b.front + ' blocks, each worth ' + unit + '.');
      say('So ' + fmt(n) + ' × ' + fmt(m) + ' = ' + fmt(n * m) + '. The shortcut: multiply the front digits (' + a.front + ' × ' + b.front + ' = ' + a.front * b.front +
          '), then put the zeros from both numbers on the end.', () => finishBox(p.boxes[0]));
      say('For grown-ups: this is the "multiply, then add the zeros" rule many of us learned. The blocks show why it works: ' +
          'tens times tens make hundreds. Kids who understand that can multiply 30 × 20 in their heads, which is the first step of the area model.', null, true);
      return list;
    }

    if (p.kind === 'partial2') {
      say("Let's find " + n + ' × ' + m + ' with partial products. It is the area model without the drawing: multiply every part of ' + n +
          ' by every part of ' + m + ', then add. In expanded form, ' + n + ' = ' + A.placeParts(n).join(' + ') + ' and ' + m + ' = ' + A.placeParts(m).join(' + ') + '.');
    } else {
      const shape = p.kind === 'area1' ? fmt(n) + ' wide and ' + m + ' tall' : n + ' wide and ' + m + ' tall';
      say("Let's find " + p.text + ' with an area model. Picture a rectangle ' + shape + '. Its area is the answer. ' +
          'A big rectangle is hard to measure all at once, so we cut it into smaller parts by place value.');
    }

    p.boxes.forEach(b => {
      if (b.type === 'top' || b.type === 'side') {
        const num = b.type === 'top' ? n : m;
        const fz = A.frontZeros(b.answer);
        const first = b.i === 0;
        say((first ? 'First, write ' + fmt(num) + ' in expanded form along the ' + (b.type === 'top' ? 'top' : 'side') + '. ' : '') +
            'The ' + fz.front + ' in ' + fmt(num) + ' is in the ' + A.PLACE[fz.zeros] + ' place, so it is worth ' + fmt(b.answer) + '.',
            () => finishBox(b));
      } else if (b.type === 'part') {
        const [x, y] = b.label ? b.label.split(' × ').map(Number) : [p.tops[b.col], p.sides[b.row]];
        const a = A.frontZeros(x), c = A.frontZeros(y), z = a.zeros + c.zeros;
        const how = z === 0
          ? x + ' × ' + y + ' = ' + x * y + '.'
          : 'Multiply the front digits, ' + a.front + ' × ' + c.front + ' = ' + a.front * c.front + ', then add ' + (z === 1 ? 'the zero' : 'the ' + z + ' zeros') + ': ' + fmt(x * y) + '.';
        say((b.label ? 'Partial product: ' : 'This part of the rectangle is ') + fmt(x) + ' × ' + fmt(y) + '. ' + how, () => finishBox(b));
      } else if (b.type === 'colsum') {
        const c = b.colData, i = b.col, last = !p.boxes.some(x => x.type === 'colsum' && x.col > i);
        const parts = c.digits.join(' + ') + (c.carryIn ? (c.digits.length ? ' + ' : '') + c.carryIn + ' carried' : '');
        const tail = c.carryOut
          ? c.sum + ' ' + A.PLACE[i] + ' is ' + c.carryOut + ' ' + (c.carryOut === 1 ? ['ten', 'hundred', 'thousand', 'ten thousand'][i] : A.PLACE[i + 1]) +
            ' and ' + c.write + ' ' + A.PLACE[i] + ', so write the ' + c.write + ' and carry the ' + c.carryOut + ' to the top of the ' + A.PLACE[i + 1] + ' column.'
          : 'Write ' + c.write + '.';
        say((i === 0 ? 'Now add the partial products. They are lined up by place value, so add one column at a time, starting with the ones. ' : '') +
            cap(A.PLACE[i]) + ': ' + parts + ' = ' + c.sum + '. ' + tail, () => finishBox(b));
        if (last) say('So ' + p.text + ' = ' + fmt(p.total) + '.');
      } else if (b.type === 'total') {
        const total = b.answer, digits = String(total);
        A.columnSteps(b.list, total).forEach((c, i, all) => {
          const parts = c.digits.join(' + ') + (c.carryIn ? ' + ' + c.carryIn + ' carried' : '');
          const tail = c.carryOut && i < all.length - 1
            ? 'Write ' + c.write + ' and carry ' + c.carryOut + ' to the ' + A.PLACE[i + 1] + '.'
            : 'Write ' + (i === all.length - 1 ? c.sum : c.write) + '.';
          say((i === 0 ? 'Now add the partial products. They are lined up by place value, so add one column at a time, starting with the ones. ' : '') +
              cap(c.place) + ': ' + parts + ' = ' + c.sum + '. ' + tail,
              () => {
                const box = b;
                A.host(box).classList.remove('waiting');
                document.querySelectorAll('.demo-now').forEach(e => e.classList.remove('demo-now'));
                A.host(box).classList.add('demo-now');
                box.input.value = digits.slice(-(i + 1));
                box.paint(box.input.value);
                if (i === all.length - 1) { A.mark(box, 'ok'); box.done = true; }
              });
        });
        say('So ' + p.text + ' = ' + fmt(total) + '.');
      }
    });

    // The connection to the standard algorithm
    if (p.kind === 'area1') {
      const ones = n % 10;
      say('For grown-ups: the standard method writes ' + fmt(p.total) + ' in a single row and carries as it goes. Each carried digit is part of a partial product moving into the next place. ' +
          'For example, ' + ones + ' × ' + m + ' = ' + ones * m + (ones * m >= 10 ? ': the ' + (ones * m % 10) + ' stays in the ones and the ' + Math.floor(ones * m / 10) + ' ten is carried. ' : '. ') +
          'The area model shows every one of those pieces separately (' + p.boxes.find(x => x.list).list.map(fmt).join(' + ') + '), which is why students learn it first.',
          () => $('#extra').replaceChildren(standard(A.stackView([n, m], p.total, ['', '×']))), true);
    } else {
      const ones = m % 10, tens = m - ones;
      const r1 = n * ones, r2 = n * tens;
      const t = A.placeParts(n);
      say('For grown-ups: the standard method does the same work in fewer lines. Its first row, ' + n + ' × ' + ones + ' = ' + r1 +
          ', is the two parts that use the ' + ones + ' added together (' + t.map(x => x * ones).reverse().join(' + ') + '). Its second row, ' + n + ' × ' + tens + ' = ' + fmt(r2) +
          ', is the two parts that use the ' + tens + ' (' + t.map(x => x * tens).reverse().map(fmt).join(' + ') + '). The area model shows every piece before they are combined, which is why students learn it first.',
          () => $('#extra').replaceChildren(standard(A.stackView([n, m, r1, r2], p.total, ['', '×', '', '+']))), true);
    }
    return list;
  }

  function standard(stack) {
    const box = A.el('div', 'std');
    box.append(A.el('p', 'std-label', 'The same problem, standard method'), stack);
    return box;
  }

  /* ── Playing ── */

  function show(i) {
    const s = steps[i];
    const c = $('#caption');
    c.textContent = s.text;
    c.classList.toggle('grown', s.grown);
    $('#counter').textContent = 'Step ' + (i + 1) + ' of ' + steps.length;
  }

  function goTo(target) {
    // Redraw from scratch and replay the steps up to the target, so Back always works.
    build();
    target = Math.max(0, Math.min(target, steps.length - 1));
    for (let i = 0; i <= target; i++) if (steps[i].act) steps[i].act();
    idx = target;
    show(idx);
    $('#backBtn').disabled = idx === 0;
    $('#nextBtn').disabled = idx === steps.length - 1;
  }

  function next() {
    if (idx >= steps.length - 1) { pause(); return; }
    idx++;
    if (steps[idx].act) steps[idx].act();
    show(idx);
    $('#backBtn').disabled = false;
    $('#nextBtn').disabled = idx === steps.length - 1;
  }

  function wait() { return 1800 + steps[idx].text.length * 45; }
  function play() {
    if (idx >= steps.length - 1) goTo(0);
    playing = true;
    $('#playBtn').textContent = 'Pause';
    clearTimeout(timer);
    timer = setTimeout(function tick() {
      next();
      if (playing && idx < steps.length - 1) timer = setTimeout(tick, wait());
      else pause();
    }, wait());
  }
  function pause() {
    playing = false;
    clearTimeout(timer);
    $('#playBtn').textContent = idx >= steps.length - 1 ? 'Play again' : 'Play';
  }

  $('#playBtn').addEventListener('click', () => (playing ? pause() : play()));
  $('#nextBtn').addEventListener('click', () => { pause(); next(); });
  $('#backBtn').addEventListener('click', () => { pause(); goTo(idx - 1); });
  $('#restartBtn').addEventListener('click', () => { pause(); goTo(0); });
  $('#newBtn').addEventListener('click', () => {
    pause();
    const fresh = A.make(kind);   // pick new numbers once, so Back replays the same problem
    nums = [fresh.n, fresh.m];
    goTo(0);
  });

  function selectTab() {
    document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.kind === kind)));
  }
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
    pause();
    kind = b.dataset.kind;
    nums = EXAMPLES[kind];
    selectTab();
    history.replaceState(null, '', '?show=' + kind + (back ? '&back=' + encodeURIComponent(back) : ''));
    goTo(0);
  }));

  selectTab();
  goTo(0);
})();
