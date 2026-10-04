/*
 * Math Realm: shared API client (version 1.1)
 *
 * Every page loads config.js first, then this file:
 *   <script src="js/config.js"></script>
 *   <script src="js/api.js"></script>
 *
 * How a game uses it:
 *   if (!MathRealm.requireLogin()) return;           // sends logged-out students to the login page
 *   const round = MathRealm.startRound('flashcards', 'g3.mult.c');
 *   round.shown();                                   // call when a new problem appears
 *   round.record({ prompt: '7 × 8', answer: '56', correct: true, hintUsed: false });
 *   const result = await round.finish();             // points, mastery, maybe a golden ticket
 *     // if result.queued is true, the internet dropped: the round is saved on this
 *     // device and sends itself later, so the game can say "Saved!" and move on.
 *   await MathRealm.saveState('flashcards', { boxes: { ... } });
 *   const { state } = await MathRealm.loadState('flashcards');
 *
 * Guest mode: MathRealm.startGuest() makes a pretend session with the built-in skill
 * list and no token. Games play normally; nothing is sent to the server and nothing is
 * saved. MathRealm.isGuest() is true, and every page shows a guest banner.
 *
 * The login is kept in sessionStorage, so it ends when the browser tab closes.
 * On shared Chromebooks the next student never inherits someone else's login.
 * Rounds waiting to be sent are kept in localStorage and only send when the
 * same student logs in again.
 */
(function () {
  'use strict';

  const SESSION_KEY = 'mathRealm.session';
  const PENDING_KEY = 'mathRealm.pending';
  const PENDING_MAX = 30;
  const PENDING_DAYS = 14;
  // Errors that mean "try again later", so the round is kept instead of lost.
  const RETRYABLE = ['network', 'busy', 'session_expired', 'not_json', 'server_error'];

  // Messages for the adult test page
  const MESSAGES = {
    no_api_url:      'Add the web app URL (ending in /exec) to js/config.js.',
    network:         "Couldn't reach the server. Check the internet connection and try again. If it fails every time, check that the deployment's access is set to Anyone.",
    not_json:        'The server sent back a web page instead of data. Check that the URL ends in /exec and the deployment\'s access is set to Anyone.',
    bad_request:     'The server could not read that request.',
    unknown_action:  'The server does not know that action. The Apps Script code may need a new deployment version.',
    missing_fields:  'Fill in every box and try again.',
    bad_login:       "That class code, student ID, or PIN doesn't match. Check them and try again.",
    locked:          'Too many tries. Wait 10 minutes, then try again.',
    disabled:        'This login is turned off. Ask your teacher.',
    session_expired: 'Your login timed out. Log in again.',
    not_on_roster:   'This student is no longer on the roster.',
    unknown_skill:   "This game uses a skill that isn't on the Skills tab.",
    no_attempts:     'There were no answers to send.',
    state_too_large: 'This save file is too big to store.',
    guest:           'Not available in guest mode.',
    busy:            'The server is busy. Try again in a moment.',
    server_error:    'Something went wrong on the server. Details are in Apps Script under Executions.',
    not_enough_gems: 'Not enough gems for that yet.',
    already_owned:   'That one is already yours.',
    not_owned:       "That item isn't owned yet.",
    unknown_item:    "That item isn't in the shop. It may have been turned off on the Shop tab.",
    reserved:        'That save name is reserved for the server.',
    bad_slot:        'Unknown equip slot.',
    claw_only:       'Accessories come only from the claw machine.',
    claw_limit:      'The daily claw machine limit was reached (Settings tab: clawDailyLimit).',
    claw_empty:      'Every active claw machine prize has been won.',
  };
  // Messages students see
  const STUDENT_MESSAGES = {
    no_api_url:      "The game isn't connected yet. Tell your teacher.",
    network:         "Can't reach the internet right now. Check the Wi-Fi and try again.",
    not_json:        "The game can't reach its server. Tell your teacher.",
    unknown_action:  'The game needs an update. Tell your teacher.',
    missing_fields:  'Fill in every box, then try again.',
    not_on_roster:   "Your name isn't on the class list. Tell your teacher.",
    unknown_skill:   "This game isn't set up yet. Tell your teacher.",
    busy:            'Lots of players right now! Try again in a moment.',
    server_error:    'Something went wrong. Tell your teacher.',
    guest:           'Log in to use this.',
    not_enough_gems: "You don't have enough gems for that yet. Keep playing to earn more!",
    already_owned:   "That one is already yours!",
    not_owned:       "You'll need to adopt that one first.",
    unknown_item:    "That one isn't in the shop right now.",
    claw_only:       'Accessories come from the Critter Claw machine!',
    claw_limit:      "That's all the claw machine plays for today. Come back tomorrow!",
    claw_empty:      "You've won every prize in the machine. Amazing!",
  };

  // Mirrors the built-in skills in Code.gs, so guests see the same areas as students.
  const GUEST_SKILLS = [
    ['g3.mult.a', 'Multiply by 1, 2, 5, 10', '3rd Grade Review', 20, 0.9, 4000, 3, false],
    ['g3.mult.b', 'Multiply by 3, 4, 6', '3rd Grade Review', 20, 0.9, 4000, 3, false],
    ['g3.mult.c', 'Multiply by 7, 8, 9', '3rd Grade Review', 20, 0.9, 4000, 3, false],
    ['g3.mult.d', 'Multiply by 11, 12', '3rd Grade Review', 20, 0.9, 4000, 3, false],
    ['g3.mult.all', 'Multiplication facts 1–12, mixed', '3rd Grade Review', 30, 0.9, 4000, 3, true],
    ['g3.div.a', 'Divide by 1, 2, 5, 10', '3rd Grade Review', 20, 0.9, 5000, 3, false],
    ['g3.div.b', 'Divide by 3, 4, 6', '3rd Grade Review', 20, 0.9, 5000, 3, false],
    ['g3.div.c', 'Divide by 7, 8, 9', '3rd Grade Review', 20, 0.9, 5000, 3, false],
    ['g3.div.d', 'Divide by 11, 12', '3rd Grade Review', 20, 0.9, 5000, 3, false],
    ['g3.div.all', 'Division facts 1–12, mixed', '3rd Grade Review', 30, 0.9, 5000, 3, true],
    ['g4.u6.tens', 'Multiply with tens (30 × 4, 30 × 20)', 'Unit 6', 10, 0.9, 0, 3, false],
    ['g4.u6.area1', 'Area diagrams: multi-digit × 1-digit', 'Unit 6', 6, 0.8, 0, 3, false],
    ['g4.u6.area2', 'Area diagrams: 2-digit × 2-digit', 'Unit 6', 6, 0.8, 0, 3, true],
    ['g4.u6.partial2', 'Partial products: 2-digit × 2-digit, no diagram', 'Unit 6', 6, 0.8, 0, 3, true],
    ['g4.dec.tenths', 'Race with tenths (0.7 + 0.6)', 'Decimals', 6, 0.8, 0, 3, false],
    ['g4.dec.hundredths', 'Race with hundredths (0.47 + 0.25)', 'Decimals', 6, 0.8, 0, 3, false],
    ['g4.dec.mixed', 'Race with tenths and hundredths (0.4 + 0.25)', 'Decimals', 6, 0.8, 0, 3, true],
    ['g4.frac.build', 'Build fractions with scoops (3/4 = 1/4 + 1/4 + 1/4)', 'Fractions', 8, 0.8, 0, 3, false],
    ['g4.frac.equiv', 'Equivalent fractions (2/4 = 4/8)', 'Fractions', 8, 0.8, 0, 3, true],
    ['g4.frac.mixed', 'More than a cup (1 3/4 = 7/4)', 'Fractions', 8, 0.8, 0, 3, false],
    ['g4.frac.times', 'Feed a group (3 × 2/3 cup)', 'Fractions', 8, 0.8, 0, 3, true],
    ['g4.frac.kg', 'Kitchen scale: tenths and hundredths of a kilogram', 'Fractions', 8, 0.8, 0, 3, false],
  ].map(r => ({ skillId: r[0], name: r[1], zone: r[2], minItems: r[3], minAccuracy: r[4], maxMedianMs: r[5], daysNeeded: r[6], milestone: r[7] }));

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch (e) { return null; }
  }
  function writeSession(s) {
    try {
      if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (e) { /* storage blocked: the login just won't survive a page change */ }
  }
  let session = readSession();

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  async function call(action, payload, retries) {
    if (session && session.guest) return { ok: false, error: 'guest' };
    const url = String((window.MATH_REALM_CONFIG || {}).apiUrl || '').trim();
    if (!/^https:\/\/script\.google\.com\/.+\/exec$/.test(url)) return { ok: false, error: 'no_api_url' };

    const body = JSON.stringify(Object.assign({}, payload, { action: action, token: session ? session.token : undefined }));
    for (let attempt = 0; ; attempt++) {
      let text;
      try {
        // text/plain keeps this a "simple" request, so the browser skips the CORS preflight Apps Script can't answer.
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, redirect: 'follow' });
        text = await res.text();
      } catch (err) {
        if (attempt >= (retries || 0)) return { ok: false, error: 'network', detail: String((err && err.message) || err) };
        await wait(800 * (attempt + 1));
        continue;
      }
      let data;
      try { data = JSON.parse(text); } catch (e) { return { ok: false, error: 'not_json', detail: text.slice(0, 300) }; }
      if (!data.ok && data.error === 'session_expired' && session) {
        // Keep who it was, so rounds saved on this device can still be matched after logging back in.
        session = null;
        writeSession(null);
      }
      return data;
    }
  }

  /* ── Rounds waiting to send (kept on this device) ── */

  function whoKey(who) { return who ? String(who.classCode).trim().toUpperCase() + '|' + String(who.studentId).trim() : ''; }
  function readPending() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(PENDING_KEY)) || []; } catch (e) { list = []; }
    const cutoff = Date.now() - PENDING_DAYS * 86400000;
    return Array.isArray(list) ? list.filter(x => x && x.roundId && x.savedAt > cutoff) : [];
  }
  function writePending(list) {
    try {
      if (list.length) localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-PENDING_MAX)));
      else localStorage.removeItem(PENDING_KEY);
    } catch (e) { /* storage full or blocked */ }
  }
  function keep(item) {
    const list = readPending();
    if (!list.some(x => x.roundId === item.roundId)) { list.push(item); writePending(list); }
  }
  function pendingCount() {
    if (!session) return 0;
    const me = whoKey(session.who);
    return readPending().filter(x => x.who === me).length;
  }

  // Sends one round and, if it counted, updates the saved session.
  async function sendRound(gameId, skillId, attempts, roundId) {
    const data = await call('submitRound', { gameId: gameId, skillId: skillId, attempts: attempts, roundId: roundId }, 3);
    if (data.ok && !data.duplicate && session) {
      session.student.points = data.points.balance;
      session.student.lifetimePoints = data.points.lifetime;
      session.mastery[skillId] = { status: data.mastery.status, days: data.mastery.days };
      const skill = (session.skills || []).find(k => k.skillId === skillId);
      if (skill) skill.daysNeeded = data.mastery.daysNeeded;   // picks up Skills tab edits
      if (data.ticket) {
        session.tickets = session.tickets || [];
        session.tickets.push({ code: data.ticket.code, skillName: data.ticket.skillName, issued: new Date().toISOString(), redeemed: false });
      }
      writeSession(session);
    }
    return data;
  }

  // In guest mode a round is scored here so the results screen still works; nothing is sent.
  function guestRound(skillId, attempts) {
    const skill = (session.skills || []).find(k => k.skillId === skillId) || { minItems: attempts.length, minAccuracy: 0.8, maxMedianMs: 0, daysNeeded: 3 };
    const items = attempts.length;
    const independent = attempts.filter(a => a.correct && !a.hintUsed).length;
    const accuracy = items ? independent / items : 0;
    const times = attempts.map(a => a.ms).filter(ms => ms > 0).sort((a, b) => a - b);
    const medianMs = times.length ? (times.length % 2 ? times[(times.length - 1) / 2] : Math.round((times[times.length / 2 - 1] + times[times.length / 2]) / 2)) : 0;
    const fastEnough = !skill.maxMedianMs || (medianMs > 0 && medianMs <= skill.maxMedianMs);
    return {
      ok: true, guest: true,
      round: { items: items, correct: attempts.filter(a => a.correct).length, independentCorrect: independent, accuracy: accuracy, medianMs: medianMs, fastEnough: fastEnough, qualifies: items >= skill.minItems && accuracy >= skill.minAccuracy && fastEnough },
      points: { base: 0, streakBonus: 0, reducedForMastered: false, earned: 0, masteryBonus: 0, total: 0, balance: 0, lifetime: 0 },
      mastery: { skillId: skillId, status: '', days: 0, daysNeeded: skill.daysNeeded, qualifiedToday: false, newlyMastered: false },
      ticket: null,
    };
  }

  async function submitRound(gameId, skillId, attempts, roundId) {
    if (session && session.guest) return guestRound(skillId, attempts);
    roundId = roundId || newId();
    const who = session ? session.who : null;          // captured first: a timed-out login clears the session
    const data = await sendRound(gameId, skillId, attempts, roundId);
    if (!data.ok && RETRYABLE.indexOf(data.error) >= 0 && who) {
      keep({ who: whoKey(who), gameId: gameId, skillId: skillId, attempts: attempts, roundId: roundId, savedAt: Date.now() });
      data.queued = true;
    } else if (data.ok && pendingCount()) {
      flushPending();                                   // the connection is back, so send anything waiting
    }
    return data;
  }

  const guestSaves = {};
  let flushing = null;
  function flushPending() {
    if (flushing) return flushing;
    flushing = (async () => {
      let sent = 0;
      if (session && session.token) {
        const me = whoKey(session.who);
        for (const item of readPending().filter(x => x.who === me)) {
          const d = await sendRound(item.gameId, item.skillId, item.attempts, item.roundId);
          if (!d.ok && RETRYABLE.indexOf(d.error) >= 0) break;          // still offline: try again later
          writePending(readPending().filter(x => x.roundId !== item.roundId));  // sent, or can never be sent
          if (d.ok) sent++;
        }
      }
      return { sent: sent, remaining: pendingCount() };
    })();
    flushing.finally(() => { flushing = null; });
    return flushing;
  }
  window.addEventListener('online', () => { flushPending(); });

  /* ── Public API ── */

  window.MathRealm = {
    get session() { return session; },
    get student() { return session ? session.student : null; },
    isLoggedIn() { return !!(session && (session.token || session.guest)); },
    isGuest() { return !!(session && session.guest); },

    // A look around with nothing saved: real games, no account.
    startGuest() {
      session = {
        guest: true,
        student: { displayName: 'Guest', points: 0, lifetimePoints: 0 },
        skills: GUEST_SKILLS.map(k => Object.assign({}, k)),
        mastery: {}, tickets: [], shop: { owned: [], equipped: {} },
      };
      writeSession(session);
      return session;
    },

    // A bar every page shows in guest mode. next = where to come back to after logging in.
    guestBanner(next) {
      if (!this.isGuest()) return null;
      const bar = document.createElement('div');
      bar.className = 'guestbar';
      const text = document.createElement('span');
      text.innerHTML = '<strong>Guest mode.</strong> Play as much as you like! Nothing is saved: no ' +
        ((window.MATH_REALM_CATALOG || {}).pointsName || 'gems') + ', stars or prizes.';
      const a = document.createElement('a');
      a.className = 'btn btn-small';
      a.href = 'index.html?login=1' + (next ? '&next=' + encodeURIComponent(next) : '');
      a.textContent = 'Log in to save';
      bar.append(text, a);
      return bar;
    },
    newId: newId,

    ping() { return call('ping', {}, 0); },

    async login(classCode, studentId, pin) {
      const data = await call('login', { classCode: classCode, studentId: studentId, pin: pin }, 1);
      if (data.ok) {
        session = {
          token: data.token,
          who: { classCode: String(classCode).trim().toUpperCase(), studentId: String(studentId).trim() },
          student: data.student, skills: data.skills, mastery: data.mastery, tickets: data.tickets || [],
          shop: data.shop || { owned: [], equipped: {} },
        };
        writeSession(session);
        flushPending();
      }
      return data;
    },

    async logout() {
      const data = await call('logout', {}, 0);
      session = null;
      writeSession(null);
      return data;
    },

    async refresh() {
      const data = await call('getProgress', {}, 2);
      if (data.ok && session) {
        Object.assign(session, { student: data.student, skills: data.skills, mastery: data.mastery, tickets: data.tickets || [], shop: data.shop || session.shop });
        writeSession(session);
      }
      return data;
    },

    // For game pages: if nobody is logged in, go to the login page and come back here afterward.
    requireLogin() {
      if (session && (session.token || session.guest)) return true;
      const here = location.pathname.split('/').pop() + location.search;
      location.replace('index.html' + (here && here !== 'index.html' ? '?next=' + encodeURIComponent(here) : ''));
      return false;
    },

    submitRound: submitRound,
    flushPending: flushPending,
    pendingCount: pendingCount,

    startRound(gameId, skillId) {
      const attempts = [];
      const roundId = newId();
      let shownAt = performance.now();
      let pending = null;
      return {
        roundId: roundId,
        get count() { return attempts.length; },
        shown() { shownAt = performance.now(); },
        record(a) {
          attempts.push({
            prompt: String(a.prompt), answer: String(a.answer),
            correct: !!a.correct, hintUsed: !!a.hintUsed,
            ms: Math.round(performance.now() - shownAt),
          });
          shownAt = performance.now();
        },
        finish() {
          if (!pending) {
            pending = submitRound(gameId, skillId, attempts.slice(), roundId);
            pending.then(d => { if (!d.ok && !d.queued) pending = null; });   // a failed send can be tried again
          }
          return pending;
        },
      };
    },

    // Guests get an in-memory save, so games that save progress still work during a visit.
    saveState(gameId, state) {
      if (session && session.guest) { guestSaves[gameId] = state; return Promise.resolve({ ok: true, saved: true, guest: true }); }
      return call('saveState', { gameId: gameId, state: state }, 2);
    },

    // Sprite Shop. Prices and ownership are checked on the server.
    shop() { return call('shop', {}, 2); },
    async buy(itemId) {
      const data = await call('buy', { itemId: itemId }, 0);   // never retried, so nothing is bought twice
      if (data.ok && session) {
        session.student.points = data.balance;
        session.shop = { owned: data.owned, equipped: data.equipped };
        writeSession(session);
      }
      return data;
    },
    // One claw machine play. Never retried, so gems are never charged twice.
    async claw(targetId) {
      const data = await call('claw', { targetId: targetId || '' }, 0);
      if (data.ok && session) {
        session.student.points = data.balance;
        session.shop = { owned: data.owned, equipped: data.equipped };
        writeSession(session);
      }
      return data;
    },
    async equip(slot, itemId) {
      const data = await call('equip', { slot: slot, itemId: itemId }, 1);
      if (data.ok && session) {
        session.shop = { owned: data.owned, equipped: data.equipped };
        writeSession(session);
      }
      return data;
    },
    loadState(gameId) {
      if (session && session.guest) return Promise.resolve({ ok: true, state: guestSaves[gameId] || null, updated: null, guest: true });
      return call('loadState', { gameId: gameId }, 2);
    },

    // errorMessage(code) for adults; errorMessage(code, true) for students
    errorMessage(code, forStudent) {
      return (forStudent && STUDENT_MESSAGES[code]) || MESSAGES[code] || 'Something went wrong (' + code + ').';
    },
  };
})();
