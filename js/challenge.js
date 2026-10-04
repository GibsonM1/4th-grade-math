/*
 * Math Realm: Fact Garden speed challenge
 *
 * Race through a whole set of facts (one of the Fact Garden groups, or 40
 * mixed cards). Every card must be answered right to finish; a miss shows the
 * answer and sends the card to the back of the deck, so mistakes cost time.
 * Best times are saved per set ("challenge" save data). First-try answers are
 * sent as a round for that set's skill, so a great race can earn a star.
 * Missed facts also update the student's Fact Garden flashcard boxes, so
 * they come up more in practice.
 *
 * Voice answers (js/voice.js) show only when catalog.js has voiceAnswers: true
 * and the browser supports speech recognition.
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

  const GAME_ID = 'challenge';
  const C = window.MATH_REALM_CATALOG;
  const $ = s => document.querySelector(s);
  const GROUPS = { a: [1, 2, 5, 10], b: [3, 4, 6], c: [7, 8, 9], d: [11, 12], all: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] };
  const SET_IDS = ['a', 'b', 'c', 'd', 'all'];
  const MIXED_SIZE = 40;
  const RIGHT_PAUSE = 280;
  const MISS_PAUSE = 1400;
  const VOICE_OK = !!C.voiceAnswers && RealmVoice.supported;
  const STAR_PATH = 'M14 2.8l3.4 7 7.7 1-5.6 5.3 1.4 7.6L14 19.9l-6.9 3.8 1.4-7.6-5.6-5.3 7.7-1z';

  const session = MathRealm.session;
  let op = 'mult';
  let bests = {}, bestsLoaded = false;
  let memory = { v: 1, facts: {} }, memoryLoaded = false;

  let setId = null, skill = null, deck = [], card = null, typed = '', mode = 'idle';
  let startAt = 0, frame = 0, shownAt = 0, total = 0, results = [], round = null, timers = [];

  /* ── Helpers ── */

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
    ['#pick', '#race', '#done'].forEach(s => { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function clock(ms) {
    const tenths = Math.floor(ms / 100);
    const m = Math.floor(tenths / 600), s = Math.floor((tenths % 600) / 10), t = tenths % 10;
    return m + ':' + String(s).padStart(2, '0') + '.' + t;
  }
  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
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
  function updateGems() {
    const s = MathRealm.session;
    $('#gemCount').textContent = s ? Number(s.student.points || 0).toLocaleString() : '0';
  }

  // Same fact keys as the flashcards, so both games share the student's fact boxes.
  function buildFacts(kind, focus) {
    const out = [], seen = {};
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
  function makeCard(f) {
    if (f.kind === 'mult') {
      const flip = Math.random() < 0.5;
      const x = flip ? f.b : f.a, y = flip ? f.a : f.b;
      return { fact: f, text: x + ' × ' + y, answer: x * y, operands: [x, y], seen: false };
    }
    return { fact: f, text: f.dividend + ' ÷ ' + f.divisor, answer: f.quotient, operands: [f.dividend, f.divisor], seen: false };
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
  const zone = C.zones.find(z => z.zone === '3rd Grade Review');
  if (zone) $('#zoneName').textContent = zone.title;

  /* ── Picking a set ── */

  function renderSets() {
    $('#tabMult').setAttribute('aria-selected', String(op === 'mult'));
    $('#tabDiv').setAttribute('aria-selected', String(op === 'div'));
    const list = $('#sets');
    list.replaceChildren();
    SET_IDS.forEach(id => {
      const sk = (session.skills || []).find(k => k.skillId === 'g3.' + op + '.' + id);
      if (!sk) return;
      const n = id === 'all' ? MIXED_SIZE : buildFacts(op, GROUPS[id]).length;
      const li = el('li', 'set');
      const name = el('div', 'set-name', id === 'all' ? (op === 'mult' ? 'Mixed multiplication' : 'Mixed division') : sk.name);
      name.append(el('small', '', n + ' cards' + (id === 'all' ? ', picked from all the facts' : '')));
      const b = bests[op + '.' + id];
      const best = el('span', 'best' + (b ? '' : ' none'), b ? 'Best ' + clock(b.ms) : (bestsLoaded ? 'No best time yet' : ''));
      const go = el('button', 'btn btn-small', 'Race');
      go.type = 'button';
      go.setAttribute('aria-label', 'Race: ' + name.firstChild.textContent);
      go.addEventListener('click', () => startRace(id));
      li.append(name, best, go);
      list.append(li);
    });
  }
  $('#tabMult').addEventListener('click', () => { op = 'mult'; renderSets(); });
  $('#tabDiv').addEventListener('click', () => { op = 'div'; renderSets(); });

  if (C.voiceAnswers) {
    $('#voiceNote').hidden = false;
    $('#voiceNote').textContent = RealmVoice.supported
      ? 'You can say your answers out loud! Turn on "Say the answer" during the race. Just say the number, like "fifty-six."'
      : 'Saying answers out loud works in the Chrome browser. Here you can use the number pad or keyboard.';
  }

  show('#pick');
  renderSets();
  Promise.all([MathRealm.loadState(GAME_ID), MathRealm.loadState('flashcards')]).then(([b, f]) => {
    if (b.ok) { bestsLoaded = true; if (b.state && b.state.bests) bests = b.state.bests; }
    if (f.ok) { memoryLoaded = true; if (f.state && f.state.facts) memory = f.state; }
    renderSets();
  });

  /* ── Voice ── */

  let ear = null, voiceOn = false, pending = null;
  if (VOICE_OK) {
    $('#micRow').hidden = false;
    try { voiceOn = localStorage.getItem('mathRealm.voice') === 'on'; } catch (e) { voiceOn = false; }
    ear = RealmVoice.create({ onSpeech: onSpeech, onState: onVoiceState });
    paintMic();
    $('#micBtn').addEventListener('click', () => {
      voiceOn = !voiceOn;
      try { localStorage.setItem('mathRealm.voice', voiceOn ? 'on' : 'off'); } catch (e) { /* fine */ }
      $('#heard').textContent = voiceOn ? 'Listening… just say the answer.' : '';
      if (voiceOn && mode !== 'idle' && mode !== 'finished') ear.start(); else ear.stop();
      paintMic();
      $('#micBtn').blur();
    });
  }
  function paintMic() {
    $('#micBtn').setAttribute('aria-pressed', String(voiceOn));
    $('#micLabel').textContent = 'Say the answer: ' + (voiceOn ? 'on' : 'off');
  }
  function onVoiceState(state) {
    $('#micBtn').dataset.listening = String(state === 'listening');
    if (state === 'blocked') {
      voiceOn = false;
      paintMic();
      $('#heard').textContent = 'The microphone is turned off on this computer. Use the number pad, or ask your teacher.';
    } else if (state === 'network') {
      $('#heard').textContent = 'Voice answers need the internet. Use the number pad for now.';
    }
  }
  function onSpeech(alts, isFinal) {
    if (mode !== 'answering') return;
    const best = (alts[0] || '').trim();
    if (best) $('#heard').textContent = 'I heard: ' + best.slice(0, 40);
    const target = card;
    const lastNum = t => { const n = RealmVoice.numbersIn(t); return n.length ? n[n.length - 1] : null; };
    // Any of the recognizer's guesses ending in the right answer counts.
    if (alts.some(a => lastNum(a) === card.answer)) {
      clearTimeout(pending);
      if (isFinal) voiceAnswer(card.answer);
      else pending = setTimeout(() => { if (mode === 'answering' && card === target) voiceAnswer(target.answer); }, 250);
      return;
    }
    clearTimeout(pending);
    if (!isFinal) return;
    const nums = RealmVoice.numbersIn(best);
    if (!nums.length) return;
    const last = nums[nums.length - 1];
    // Reading the question out loud ("seven times eight") isn't a wrong answer.
    if (card.operands.indexOf(last) >= 0 && card.operands.every(o => nums.indexOf(o) >= 0)) return;
    voiceAnswer(last);
  }
  function voiceAnswer(n) {
    typed = String(n);
    renderAnswer();
    check();
  }

  /* ── Racing ── */

  function startRace(id) {
    setId = id;
    skill = session.skills.find(k => k.skillId === 'g3.' + op + '.' + id);
    const facts = buildFacts(op, GROUPS[id]);
    deck = shuffle(id === 'all' ? shuffle(facts).slice(0, MIXED_SIZE) : facts).map(makeCard);
    total = deck.length;
    results = [];
    round = MathRealm.startRound(GAME_ID, skill.skillId);
    clearTimers();
    const b = bests[op + '.' + id];
    $('#bestLine').textContent = b ? 'Best: ' + clock(b.ms) : 'First race on this set!';
    $('#clock').textContent = '0:00.0';
    $('#q').textContent = '';
    typed = '';
    renderAnswer();
    $('#feedback').textContent = '';
    $('#problem').dataset.state = '';
    $('#heard').textContent = voiceOn ? 'Listening… just say the answer.' : '';
    updateLeft();
    show('#race');
    if (ear && voiceOn) ear.start();   // warm up the microphone during the countdown

    mode = 'countdown';
    const cd = $('#countdown');
    cd.hidden = false;
    [3, 2, 1].forEach((n, i) => later(() => { cd.textContent = n; RealmFX.correct(); }, i * 700));
    later(() => {
      cd.hidden = true;
      startAt = performance.now();
      tick();
      nextCard();
    }, 2100);
  }

  function tick() {
    $('#clock').textContent = clock(performance.now() - startAt);
    frame = requestAnimationFrame(tick);
  }

  function updateLeft() {
    const left = deck.length + (card && mode === 'answering' ? 1 : 0);
    $('#left').textContent = (left === 1 ? '1 card' : left + ' cards') + ' left';
  }

  function nextCard() {
    if (!deck.length) { finish(); return; }
    card = deck.shift();
    typed = '';
    $('#q').textContent = card.text;
    $('#q').setAttribute('aria-label', card.text.replace('×', 'times').replace('÷', 'divided by'));
    renderAnswer();
    $('#feedback').textContent = '';
    $('#problem').dataset.state = '';
    mode = 'answering';
    updateLeft();
    if (ear) ear.clear();
    shownAt = performance.now();
    round.shown();
  }

  function renderAnswer() {
    $('#answerBox').textContent = typed;
    $('#checkBtn').disabled = !typed || mode !== 'answering';
  }

  function press(key) {
    if (mode !== 'answering') return;
    if (key === 'check') { check(); return; }
    if (key === 'del') typed = typed.slice(0, -1);
    else if (/^\d$/.test(key) && typed.length < 3) typed = (typed === '0' ? '' : typed) + key;
    renderAnswer();
  }

  function check() {
    if (mode !== 'answering' || !typed) return;
    clearTimeout(pending);
    const correct = Number(typed) === card.answer;
    if (!card.seen) {   // only the first try at each card counts toward stars
      card.seen = true;
      round.record({ prompt: card.text, answer: typed, correct: correct, hintUsed: false });
      results.push({ key: card.fact.key, correct: correct, ms: performance.now() - shownAt });
    }
    if (ear) ear.clear();
    if (correct) {
      mode = 'right';
      $('#problem').dataset.state = 'right';
      renderAnswer();
      RealmFX.correct();
      later(nextCard, RIGHT_PAUSE);
    } else {
      mode = 'wrong';
      typed = String(card.answer);
      renderAnswer();
      $('#problem').dataset.state = 'wrong';
      $('#feedback').textContent = card.text + ' = ' + card.answer + '. This card goes to the back.';
      RealmFX.wrong();
      deck.push(card);
      updateLeft();
      later(nextCard, MISS_PAUSE);
    }
  }

  $('#keypad').addEventListener('click', e => {
    const b = e.target.closest('[data-key]');
    if (!b) return;
    b.blur();
    press(b.dataset.key);
  });
  document.addEventListener('keydown', e => {
    if ($('#race').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Enter' || e.key === ' ') {
      if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
      e.preventDefault();
      press('check');
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      press('del');
    } else if (/^\d$/.test(e.key)) {
      press(e.key);
    }
  });

  function stopRace() {
    cancelAnimationFrame(frame);
    clearTimers();
    clearTimeout(pending);
    if (ear) ear.stop();
  }
  $('#quitBtn').addEventListener('click', () => {
    stopRace();
    mode = 'idle';
    show('#pick');
    renderSets();
  });

  /* ── Finished ── */

  function updateMemory() {
    const speed = skill.maxMedianMs || 0;
    const now = Date.now();
    results.forEach(r => {
      const f = memory.facts[r.key] || { b: 0 };
      if (!r.correct) f.b = 1;
      else if (!speed || r.ms <= speed) f.b = Math.min(5, Math.max(1, f.b || 0) + 1);
      else f.b = Math.max(1, f.b || 0);
      f.t = now;
      memory.facts[r.key] = f;
    });
  }

  async function finish() {
    const elapsed = Math.round(performance.now() - startAt);
    stopRace();
    mode = 'finished';
    $('#clock').textContent = clock(elapsed);

    const key = op + '.' + setId;
    const prev = bests[key];
    const isBest = !prev || elapsed < prev.ms;
    if (isBest) bests[key] = { ms: elapsed, at: new Date().toISOString() };
    const firsts = results.filter(r => r.correct).length;

    $('#resTitle').textContent = prev && isBest ? 'New best time!' : (prev ? 'Finished!' : 'Your first time on the board!');
    $('#resTime').textContent = clock(elapsed);
    $('#resTimeLabel').textContent = prev
      ? (isBest ? 'new best! Your old best was ' + clock(prev.ms) : 'your best is ' + clock(prev.ms))
      : 'your time to beat next race';
    $('#timeStat').classList.toggle('best-stat', isBest);
    $('#resFirst').textContent = firsts + ' of ' + total;
    $('#resGems').textContent = '…';
    $('#resGemsLabel').textContent = 'saving your race';
    $('#resStars').replaceChildren();
    $('#resMsg').hidden = true;
    $('#resTicket').hidden = true;
    $('#againBtn').disabled = true;
    show('#done');
    if (prev && isBest) { RealmFX.fanfare(); RealmFX.confetti(); }

    updateMemory();
    const saves = [round.finish()];
    // Only save what loaded properly, so a dropped connection can't wipe old records.
    if (bestsLoaded) saves.push(MathRealm.saveState(GAME_ID, { v: 1, bests: bests }));
    if (memoryLoaded) saves.push(MathRealm.saveState('flashcards', memory));
    const [res] = await Promise.all(saves);
    showResult(res, firsts);
    $('#againBtn').disabled = false;
    $('#againBtn').focus();
  }

  function showResult(res, firsts) {
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
    if (res.ok) {
      $('#resGems').textContent = '+' + res.points.total;
      $('#resGemsLabel').textContent = C.pointsName + ' (you have ' + Number(res.points.balance).toLocaleString() + ')';
      updateGems();
      const m = res.mastery;
      const mastered = m.status === 'mastered';
      $('#resStars').replaceChildren(starRow(Math.min(m.days, m.daysNeeded), m.daysNeeded, mastered, m.newlyMastered || res.round.qualifies));
      const need = Math.ceil(skill.minAccuracy * total - 1e-9);
      if (m.newlyMastered) {
        line('You mastered ' + skill.name + '!');
        RealmFX.fanfare();
        RealmFX.confetti();
      } else if (mastered) {
        line('You already mastered this set. Racing keeps it sharp!');
      } else if (res.round.qualifies) {
        line("This race earned today's star for " + skill.name + '!');
      } else {
        if (firsts < need) line("For today's star, get " + need + ' of ' + total + ' right on the first try.');
        if (skill.maxMedianMs && !res.round.fastEnough) line("For today's star, answer a little faster: about " + skill.maxMedianMs / 1000 + ' seconds a card.');
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
      line('The internet dropped, so your race is saved on this computer. It will send by itself when the internet is back.');
    } else {
      $('#resGems').textContent = '—';
      $('#resGemsLabel').textContent = 'not saved';
      line(MathRealm.errorMessage(res.error, true));
    }
    msg.hidden = !msg.childNodes.length;
  }

  $('#againBtn').addEventListener('click', () => startRace(setId));
  $('#otherBtn').addEventListener('click', () => { mode = 'idle'; show('#pick'); renderSets(); });
})();
