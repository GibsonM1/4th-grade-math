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

  const fmt = AreaCore.fmt;
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


  /* ── Problems and drawing live in area-core.js (shared with the demo) ── */

  const makeProblem = () => AreaCore.make(kind);
  const hostOf = AreaCore.host;
  const markBox = AreaCore.mark;
  const fillBox = AreaCore.fill;

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
  $('#demoLink').href = 'how-it-works.html?show=' + kind + '&back=' + encodeURIComponent('area-model.html?skill=' + skillId);
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
    $('#title').textContent = problem.text;   // the question stays at the top the whole time
    $('#title').hidden = kind === 'tens';   // the tens problem is already written out big
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
