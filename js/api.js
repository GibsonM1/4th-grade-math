/*
 * Math Realm: shared API client
 *
 * Every page loads config.js first, then this file:
 *   <script src="js/config.js"></script>
 *   <script src="js/api.js"></script>
 *
 * How a game uses it:
 *   await MathRealm.login(classCode, studentId, pin);
 *   const round = MathRealm.startRound('flashcards', 'g3.mult.c');
 *   round.shown();                                   // call when a new problem appears
 *   round.record({ prompt: '7 × 8', answer: '56', correct: true, hintUsed: false });
 *   const result = await round.finish();             // points, mastery, maybe a golden ticket
 *   await MathRealm.saveState('flashcards', { boxes: { ... } });
 *   const { state } = await MathRealm.loadState('flashcards');
 *
 * The login is kept in sessionStorage, so it ends when the browser tab closes.
 * On shared Chromebooks the next student never inherits someone else's login.
 */
(function () {
  'use strict';

  const SESSION_KEY = 'mathRealm.session';

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
    busy:            'The server is busy. Try again in a moment.',
    server_error:    'Something went wrong on the server. Details are in Apps Script under Executions.',
  };

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
      if (!data.ok && data.error === 'session_expired') { session = null; writeSession(null); }
      return data;
    }
  }

  async function submitRound(gameId, skillId, attempts, roundId) {
    // The same roundId is reused on retries, so the server never counts a round twice.
    const data = await call('submitRound', { gameId: gameId, skillId: skillId, attempts: attempts, roundId: roundId || newId() }, 3);
    if (data.ok && !data.duplicate && session) {
      session.student.points = data.points.balance;
      session.student.lifetimePoints = data.points.lifetime;
      session.mastery[skillId] = { status: data.mastery.status, days: data.mastery.days };
      const skill = (session.skills || []).find(k => k.skillId === skillId);
      if (skill) skill.daysNeeded = data.mastery.daysNeeded;   // picks up Skills tab edits
      writeSession(session);
    }
    return data;
  }

  window.MathRealm = {
    get session() { return session; },
    get student() { return session ? session.student : null; },
    isLoggedIn() { return !!(session && session.token); },
    newId: newId,

    ping() { return call('ping', {}, 0); },

    async login(classCode, studentId, pin) {
      const data = await call('login', { classCode: classCode, studentId: studentId, pin: pin }, 1);
      if (data.ok) {
        session = { token: data.token, student: data.student, skills: data.skills, mastery: data.mastery };
        writeSession(session);
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
        Object.assign(session, { student: data.student, skills: data.skills, mastery: data.mastery });
        writeSession(session);
      }
      return data;
    },

    submitRound: submitRound,

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
            pending.then(d => { if (!d.ok) pending = null; });   // let a failed send be tried again
          }
          return pending;
        },
      };
    },

    saveState(gameId, state) { return call('saveState', { gameId: gameId, state: state }, 2); },
    loadState(gameId) { return call('loadState', { gameId: gameId }, 2); },

    errorMessage(code) { return MESSAGES[code] || 'Something went wrong (' + code + ').'; },
  };
})();
