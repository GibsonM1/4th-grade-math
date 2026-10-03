/** @OnlyCurrentDoc */

/*
 * MATH REALM: backend (Google Apps Script)
 * Phase 1, part 1. Version 1.0.0
 *
 * This script lives inside the district Google Sheet (Extensions ▸ Apps Script).
 * The GitHub Pages site sends requests here, and all student data stays in the
 * Sheet. Nothing about students is stored on GitHub.
 *
 * @OnlyCurrentDoc (line 1) limits this script to this one spreadsheet, so the
 * permission prompt asks for access to this file only, not your whole Drive.
 *
 * Requests are POSTed as JSON with Content-Type text/plain. That avoids the
 * browser's CORS preflight check, which Apps Script can't answer. Every
 * request has an "action":
 *
 *   ping         is the server up?
 *   login        { classCode, studentId, pin }      → token + progress
 *   logout       { token }
 *   getProgress  { token }                          → points, skills, mastery
 *   submitRound  { token, gameId, skillId, roundId, attempts: [...] }
 *   saveState    { token, gameId, state }           → a game's save data
 *   loadState    { token, gameId }
 *
 * Every reply is JSON: { ok: true, ... } or { ok: false, error: 'code' }.
 */

const APP_VERSION = '1.0.0';
const TZ = 'America/Los_Angeles';
const SESSION_SECONDS = 6 * 60 * 60;   // a login lasts one school day (the most Apps Script's cache allows)
const CONFIG_CACHE_SECONDS = 120;      // Settings and Skills edits take effect within 2 minutes
const LOCKOUT_SECONDS = 10 * 60;
const MAX_SAVE_CHARS = 45000;          // a Sheets cell holds 50,000 characters

const TABS = {
  roster:   { name: 'Roster',    headers: ['studentId', 'studentName', 'displayName', 'classCode', 'pin', 'disabled', 'points', 'lifetimePoints', 'lastLogin'] },
  skills:   { name: 'Skills',    headers: ['skillId', 'name', 'zone', 'minItems', 'minAccuracy', 'maxMedianMs', 'daysNeeded', 'milestone'] },
  settings: { name: 'Settings',  headers: ['key', 'value', 'notes'] },
  mastery:  { name: 'Mastery',   headers: ['studentId', 'skillId', 'status', 'qualifyingDays', 'lastPracticed', 'masteredAt'] },
  sessions: { name: 'Sessions',  headers: ['timestamp', 'studentId', 'gameId', 'skillId', 'items', 'correct', 'independentCorrect', 'accuracy', 'medianMs', 'qualifies', 'pointsEarned', 'roundId'] },
  attempts: { name: 'Attempts',  headers: ['timestamp', 'studentId', 'gameId', 'skillId', 'prompt', 'answer', 'correct', 'hintUsed', 'ms'] },
  points:   { name: 'PointsLog', headers: ['timestamp', 'studentId', 'delta', 'reason'] },
  saves:    { name: 'SaveData',  headers: ['studentId', 'gameId', 'updated', 'json'] },
  tickets:  { name: 'Tickets',   headers: ['ticketCode', 'studentId', 'studentName', 'skillId', 'skillName', 'issued', 'redeemed', 'redeemedBy', 'redeemedAt'] },
};

// key, default value, note shown on the Settings tab
const DEFAULT_SETTINGS = [
  ['pointsPerCorrect',       10,   'Points for a correct answer with no hint'],
  ['pointsPerHintedCorrect', 5,    'Points for a correct answer after a hint'],
  ['streakLength',           5,    'Correct answers in a row (no hints) for a streak bonus'],
  ['streakBonus',            5,    'Bonus points each time a streak is reached'],
  ['masteredMultiplier',     0.25, 'Points are multiplied by this on skills already mastered, so grinding easy work pays less'],
  ['masteryBonus',           50,   'One-time bonus when a skill is mastered'],
  ['maxPointsPerRound',      400,  'Most points one round can earn (before the mastery bonus)'],
  ['maxAttemptsPerRound',    60,   'Answers past this number in one round are ignored'],
  ['failedLoginsPerStudent', 8,    'Wrong tries before that student ID is locked for 10 minutes'],
  ['failedLoginsPerClass',   60,   'Failed tries on one class code before the whole class code is locked for 10 minutes'],
];

// skillId, name, zone, minItems, minAccuracy, maxMedianMs (blank = no speed check), daysNeeded, milestone (golden ticket)
// A round "qualifies" when it has at least minItems answers, at least minAccuracy of them right WITHOUT hints,
// and (if set) a typical answer time under maxMedianMs. A skill is mastered after qualifying rounds on daysNeeded different days.
const DEFAULT_SKILLS = [
  ['g3.mult.a',      'Multiply by 1, 2, 5, 10',                          '3rd Grade Review', 20, 0.9, 4000, 3, false],
  ['g3.mult.b',      'Multiply by 3, 4, 6',                              '3rd Grade Review', 20, 0.9, 4000, 3, false],
  ['g3.mult.c',      'Multiply by 7, 8, 9',                              '3rd Grade Review', 20, 0.9, 4000, 3, false],
  ['g3.mult.d',      'Multiply by 11, 12',                               '3rd Grade Review', 20, 0.9, 4000, 3, false],
  ['g3.mult.all',    'Multiplication facts 1–12, mixed',                 '3rd Grade Review', 30, 0.9, 4000, 3, true],
  ['g3.div.a',       'Divide by 1, 2, 5, 10',                            '3rd Grade Review', 20, 0.9, 5000, 3, false],
  ['g3.div.b',       'Divide by 3, 4, 6',                                '3rd Grade Review', 20, 0.9, 5000, 3, false],
  ['g3.div.c',       'Divide by 7, 8, 9',                                '3rd Grade Review', 20, 0.9, 5000, 3, false],
  ['g3.div.d',       'Divide by 11, 12',                                 '3rd Grade Review', 20, 0.9, 5000, 3, false],
  ['g3.div.all',     'Division facts 1–12, mixed',                       '3rd Grade Review', 30, 0.9, 5000, 3, true],
  ['g4.u6.tens',     'Multiply with tens (30 × 4, 30 × 20)',             'Unit 6',           10, 0.9, '',   3, false],
  ['g4.u6.area1',    'Area diagrams: multi-digit × 1-digit',             'Unit 6',            6, 0.8, '',   3, false],
  ['g4.u6.area2',    'Area diagrams: 2-digit × 2-digit',                 'Unit 6',            6, 0.8, '',   3, true],
  ['g4.u6.partial2', 'Partial products: 2-digit × 2-digit, no diagram',  'Unit 6',            6, 0.8, '',   3, true],
];

class AppError extends Error {
  constructor(code) { super(code); this.code = code; }
}


/* ───────────── Web entry points ───────────── */

function doGet() {
  return json_({ ok: true, app: 'Math Realm', version: APP_VERSION, time: new Date().toISOString() });
}

function doPost(e) {
  let req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  const handler = ROUTES[req && req.action];
  if (!handler) return json_({ ok: false, error: 'unknown_action' });
  try {
    return json_(Object.assign({ ok: true }, handler(req)));
  } catch (err) {
    if (err instanceof AppError) return json_({ ok: false, error: err.code });
    console.error((err && err.stack) || err);
    return json_({ ok: false, error: 'server_error', detail: String((err && err.message) || err) });
  }
}

const ROUTES = {
  ping:        () => ({ app: 'Math Realm', version: APP_VERSION }),
  login:       login_,
  logout:      logout_,
  getProgress: getProgress_,
  submitRound: submitRound_,
  saveState:   saveState_,
  loadState:   loadState_,
};


/* ───────────── Actions ───────────── */

function login_(req) {
  const classCode = clean_(req.classCode, 20).toUpperCase();
  const studentId = clean_(req.studentId, 40);
  const pin = clean_(req.pin, 20);
  if (!classCode || !studentId) throw new AppError('missing_fields');

  const S = settings_();
  const cache = CacheService.getScriptCache();
  const idKey = 'fail_' + classCode + '_' + studentId;
  const classKey = 'failc_' + classCode;
  if (num_(cache.get(idKey)) >= S.failedLoginsPerStudent || num_(cache.get(classKey)) >= S.failedLoginsPerClass) {
    throw new AppError('locked');
  }

  const t = table_(TABS.roster);
  const i = t.rows.findIndex(r => sameId_(r.studentId, studentId) && String(r.classCode).trim().toUpperCase() === classCode);
  const row = i >= 0 ? t.rows[i] : null;
  const storedPin = row ? String(row.pin).trim() : '';
  if (!row || (storedPin && storedPin !== pin)) {
    bump_(cache, idKey);
    bump_(cache, classKey);
    throw new AppError('bad_login');
  }
  if (bool_(row.disabled)) throw new AppError('disabled');

  cache.remove(idKey);
  t.update(i, { lastLogin: new Date() });

  const id = String(row.studentId).trim();
  const token = Utilities.getUuid();
  cache.put('tok_' + token, JSON.stringify({ studentId: id, classCode: classCode }), SESSION_SECONDS);
  return Object.assign({ token: token }, progressFor_(id, row));
}

function logout_(req) {
  if (req.token) CacheService.getScriptCache().remove('tok_' + clean_(req.token, 64));
  return {};
}

function getProgress_(req) {
  const who = auth_(req);
  const t = table_(TABS.roster);
  return progressFor_(who.studentId, t.rows[rosterIndex_(t, who)]);
}

function submitRound_(req) {
  const who = auth_(req);
  const cache = CacheService.getScriptCache();

  // The same round sent twice (a retry after a dropped connection) is only counted once.
  const roundId = idSafe_(req.roundId, 64);
  if (roundId) {
    const seen = cache.get('round_' + roundId);
    if (seen) return Object.assign(JSON.parse(seen), { duplicate: true });
  }

  const S = settings_();
  const skill = skillsList_().find(s => s.skillId === idSafe_(req.skillId, 40));
  if (!skill) throw new AppError('unknown_skill');
  const gameId = idSafe_(req.gameId, 40) || 'unknown';

  const attempts = (Array.isArray(req.attempts) ? req.attempts : [])
    .slice(0, S.maxAttemptsPerRound)
    .map(a => ({
      prompt:   clean_(a && a.prompt, 120),
      answer:   clean_(a && a.answer, 60),
      correct:  !!(a && a.correct === true),
      hintUsed: !!(a && a.hintUsed === true),
      ms:       Math.round(Math.min(600000, Math.max(0, num_(a && a.ms)))),
    }));
  if (!attempts.length) throw new AppError('no_attempts');

  // Score the round. Hinted answers earn points but don't count toward mastery.
  const items = attempts.length;
  const correct = attempts.filter(a => a.correct).length;
  const independent = attempts.filter(a => a.correct && !a.hintUsed).length;
  const accuracy = independent / items;
  const medianMs = median_(attempts.map(a => a.ms).filter(ms => ms > 0));
  const fastEnough = !skill.maxMedianMs || (medianMs > 0 && medianMs <= skill.maxMedianMs);
  const qualifies = items >= skill.minItems && accuracy >= skill.minAccuracy && fastEnough;

  let base = 0, streak = 0, streakBonus = 0;
  attempts.forEach(a => {
    if (a.correct && !a.hintUsed) {
      base += S.pointsPerCorrect;
      streak++;
      if (S.streakLength > 0 && streak % S.streakLength === 0) streakBonus += S.streakBonus;
    } else {
      if (a.correct) base += S.pointsPerHintedCorrect;
      streak = 0;
    }
  });

  const now = new Date();
  const today = Utilities.formatDate(now, TZ, 'yyyy-MM-dd');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new AppError('busy');
  let result;
  try {
    // Mastery: qualifying rounds on daysNeeded different days. Once mastered, it stays mastered.
    const mt = table_(TABS.mastery);
    const mi = mt.rows.findIndex(m => sameId_(m.studentId, who.studentId) && String(m.skillId).trim() === skill.skillId);
    const prev = mi >= 0 ? mt.rows[mi] : null;
    const wasMastered = !!prev && String(prev.status).trim() === 'mastered';
    const days = prev ? daysList_(prev.qualifyingDays) : [];
    if (qualifies && days.indexOf(today) < 0) days.push(today);
    const isMastered = wasMastered || days.length >= skill.daysNeeded;
    const newlyMastered = isMastered && !wasMastered;
    const status = isMastered ? 'mastered' : (days.length ? 'practicing' : 'learning');
    const record = {
      studentId: who.studentId,
      skillId: skill.skillId,
      status: status,
      qualifyingDays: days.join(', '),
      lastPracticed: now,
      masteredAt: newlyMastered ? now : (prev ? prev.masteredAt : ''),
    };
    if (mi >= 0) mt.update(mi, record); else appendRows_(TABS.mastery, [record]);

    // Points
    let earned = base + streakBonus;
    if (wasMastered) earned = Math.round(earned * S.masteredMultiplier);
    earned = Math.min(earned, S.maxPointsPerRound);
    const masteryBonus = newlyMastered ? S.masteryBonus : 0;
    const total = earned + masteryBonus;

    const rt = table_(TABS.roster);
    const ri = rosterIndex_(rt, who);
    const rr = rt.rows[ri];
    const balance = num_(rr.points) + total;
    const lifetime = num_(rr.lifetimePoints) + total;
    rt.update(ri, { points: balance, lifetimePoints: lifetime });

    const pointRows = [];
    if (earned) pointRows.push({ timestamp: now, studentId: who.studentId, delta: earned, reason: 'Round: ' + skill.skillId });
    if (masteryBonus) pointRows.push({ timestamp: now, studentId: who.studentId, delta: masteryBonus, reason: 'Mastered: ' + skill.skillId });
    appendRows_(TABS.points, pointRows);

    appendRows_(TABS.attempts, attempts.map(a => ({
      timestamp: now, studentId: who.studentId, gameId: gameId, skillId: skill.skillId,
      prompt: safeText_(a.prompt), answer: safeText_(a.answer), correct: a.correct, hintUsed: a.hintUsed, ms: a.ms,
    })));
    appendRows_(TABS.sessions, [{
      timestamp: now, studentId: who.studentId, gameId: gameId, skillId: skill.skillId,
      items: items, correct: correct, independentCorrect: independent,
      accuracy: Math.round(accuracy * 1000) / 1000, medianMs: medianMs, qualifies: qualifies,
      pointsEarned: total, roundId: roundId,
    }]);

    let ticket = null;
    if (newlyMastered && skill.milestone) {
      ticket = { code: issueTicket_(who.studentId, String(rr.studentName || ''), skill, now), skillName: skill.name };
    }

    result = {
      round: { items: items, correct: correct, independentCorrect: independent, accuracy: accuracy, medianMs: medianMs, fastEnough: fastEnough, qualifies: qualifies },
      points: { base: base, streakBonus: streakBonus, reducedForMastered: wasMastered, earned: earned, masteryBonus: masteryBonus, total: total, balance: balance, lifetime: lifetime },
      mastery: { skillId: skill.skillId, status: status, days: days.length, daysNeeded: skill.daysNeeded, qualifiedToday: days.indexOf(today) >= 0, newlyMastered: newlyMastered },
      ticket: ticket,
    };
  } finally {
    lock.releaseLock();
  }
  if (roundId) cache.put('round_' + roundId, JSON.stringify(result), SESSION_SECONDS);
  return result;
}

function saveState_(req) {
  const who = auth_(req);
  const gameId = idSafe_(req.gameId, 40);
  if (!gameId || req.state === undefined) throw new AppError('missing_fields');
  const json = JSON.stringify(req.state);
  if (json.length > MAX_SAVE_CHARS) throw new AppError('state_too_large');

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new AppError('busy');
  try {
    const now = new Date();
    const found = findSaveRow_(who.studentId, gameId);
    if (found.row < 0) {
      appendRows_(TABS.saves, [{ studentId: who.studentId, gameId: gameId, updated: now, json: json }]);
    } else {
      found.sh.getRange(found.row, found.col.updated + 1).setValue(now);
      found.sh.getRange(found.row, found.col.json + 1).setValue(json);
    }
    return { saved: true, updated: now.toISOString() };
  } finally {
    lock.releaseLock();
  }
}

function loadState_(req) {
  const who = auth_(req);
  const gameId = idSafe_(req.gameId, 40);
  if (!gameId) throw new AppError('missing_fields');
  const found = findSaveRow_(who.studentId, gameId);
  if (found.row < 0) return { state: null, updated: null };
  const vals = found.sh.getRange(found.row, 1, 1, found.headers.length).getValues()[0];
  let state = null;
  try { state = JSON.parse(String(vals[found.col.json] || 'null')); } catch (e) { state = null; }
  const updated = vals[found.col.updated];
  return { state: state, updated: updated instanceof Date ? updated.toISOString() : null };
}


/* ───────────── Progress and golden tickets ───────────── */

function progressFor_(studentId, row) {
  const mastery = {};
  table_(TABS.mastery).rows.forEach(m => {
    if (sameId_(m.studentId, studentId)) {
      mastery[String(m.skillId).trim()] = { status: String(m.status).trim(), days: daysList_(m.qualifyingDays).length };
    }
  });
  return {
    student: { displayName: displayName_(row), points: num_(row.points), lifetimePoints: num_(row.lifetimePoints) },
    skills: skillsList_(),
    mastery: mastery,
  };
}

function issueTicket_(studentId, studentName, skill, now) {
  const sh = sheet_(TABS.tickets);
  const code = uniqueTicketCode_(sh);
  appendRows_(TABS.tickets, [{
    ticketCode: code, studentId: studentId, studentName: studentName,
    skillId: skill.skillId, skillName: skill.name, issued: now, redeemed: false, redeemedBy: '', redeemedAt: '',
  }]);
  return code;
}

function uniqueTicketCode_(sh) {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L look-alikes
  for (let tries = 0; tries < 25; tries++) {
    let code = 'GT-';
    for (let i = 0; i < 4; i++) code += letters[Math.floor(Math.random() * letters.length)];
    if (!sh.createTextFinder(code).matchEntireCell(true).findNext()) return code;
  }
  throw new Error('Could not make a unique ticket code');
}


/* ───────────── Settings and Skills tabs ───────────── */

function settings_() {
  return cached_('cfg_settings', () => {
    const out = {};
    DEFAULT_SETTINGS.forEach(r => { out[r[0]] = r[1]; });
    table_(TABS.settings).rows.forEach(r => {
      const key = String(r.key).trim();
      if (key && r.value !== '' && isFinite(Number(r.value))) out[key] = Number(r.value);
    });
    return out;
  });
}

function skillsList_() {
  return cached_('cfg_skills', () => table_(TABS.skills).rows
    .filter(r => String(r.skillId).trim())
    .map(r => ({
      skillId:     String(r.skillId).trim(),
      name:        String(r.name).trim(),
      zone:        String(r.zone).trim(),
      minItems:    num_(r.minItems) > 0 ? Math.round(num_(r.minItems)) : 10,
      minAccuracy: pct_(r.minAccuracy, 0.9),
      maxMedianMs: num_(r.maxMedianMs),
      daysNeeded:  num_(r.daysNeeded) > 0 ? Math.round(num_(r.daysNeeded)) : 3,
      milestone:   bool_(r.milestone),
    })));
}

function cached_(key, build) {
  const cache = CacheService.getScriptCache();
  const hit = cache.get(key);
  if (hit) return JSON.parse(hit);
  const value = build();
  cache.put(key, JSON.stringify(value), CONFIG_CACHE_SECONDS);
  return value;
}


/* ───────────── Sheet helpers ───────────── */

function sheet_(tab) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(tab.name);
  if (!sh) throw new Error('The ' + tab.name + ' tab is missing. Run Math Realm ▸ Set up tabs.');
  return sh;
}

// Columns are found by header name, so you can add your own columns or reorder them.
function headerMap_(sh, tab) {
  const lastCol = Math.max(1, sh.getLastColumn());
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim());
  const col = {};
  headers.forEach((h, i) => { if (h && !(h in col)) col[h] = i; });
  tab.headers.forEach(h => {
    if (!(h in col)) throw new Error('The ' + tab.name + ' tab is missing the "' + h + '" column. Run Math Realm ▸ Set up tabs.');
  });
  return { headers: headers, col: col };
}

// Reads a whole tab. Only used on small tabs (Roster, Skills, Settings, Mastery).
function table_(tab) {
  const sh = sheet_(tab);
  const values = sh.getDataRange().getValues();
  const headers = (values[0] || []).map(h => String(h).trim());
  const col = {};
  headers.forEach((h, i) => { if (h && !(h in col)) col[h] = i; });
  tab.headers.forEach(h => {
    if (!(h in col)) throw new Error('The ' + tab.name + ' tab is missing the "' + h + '" column. Run Math Realm ▸ Set up tabs.');
  });
  const rows = values.slice(1).map(v => {
    const o = {};
    headers.forEach((h, i) => { if (h) o[h] = v[i]; });
    return o;
  });
  return {
    sheet: sh,
    col: col,
    rows: rows,
    // Writes only the named cells, so formulas or notes in other columns are left alone.
    update(i, patch) {
      Object.keys(patch).forEach(k => {
        if (!(k in col)) return;
        sh.getRange(i + 2, col[k] + 1).setValue(patch[k]);
        rows[i][k] = patch[k];
      });
    },
  };
}

// Adds rows to the bottom of a tab without reading the whole tab (Attempts gets big).
function appendRows_(tab, objs) {
  if (!objs || !objs.length) return;
  const sh = sheet_(tab);
  const headers = headerMap_(sh, tab).headers;
  const data = objs.map(o => headers.map(h => (h && Object.prototype.hasOwnProperty.call(o, h)) ? o[h] : ''));
  const start = sh.getLastRow() + 1;
  const overflow = start + data.length - 1 - sh.getMaxRows();
  if (overflow > 0) sh.insertRowsAfter(sh.getMaxRows(), overflow + 500);
  sh.getRange(start, 1, data.length, headers.length).setValues(data);
}

function findSaveRow_(studentId, gameId) {
  const sh = sheet_(TABS.saves);
  const map = headerMap_(sh, TABS.saves);
  const last = sh.getLastRow();
  let row = -1;
  if (last >= 2) {
    const ids = sh.getRange(2, map.col.studentId + 1, last - 1, 1).getValues();
    const games = sh.getRange(2, map.col.gameId + 1, last - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (sameId_(ids[i][0], studentId) && String(games[i][0]).trim() === gameId) { row = i + 2; break; }
    }
  }
  return { sh: sh, headers: map.headers, col: map.col, row: row };
}


/* ───────────── Small utilities ───────────── */

function auth_(req) {
  const raw = req.token ? CacheService.getScriptCache().get('tok_' + clean_(req.token, 64)) : null;
  if (!raw) throw new AppError('session_expired');
  return JSON.parse(raw);
}

function rosterIndex_(t, who) {
  const i = t.rows.findIndex(r => sameId_(r.studentId, who.studentId) && String(r.classCode).trim().toUpperCase() === who.classCode);
  if (i < 0) throw new AppError('not_on_roster');
  return i;
}

function clean_(v, max) { return String(v == null ? '' : v).trim().slice(0, max || 60); }
function idSafe_(v, max) { return clean_(v, max).replace(/[^A-Za-z0-9._-]/g, ''); }
// A leading apostrophe stops Sheets from treating typed text like "=..." as a formula.
function safeText_(s) { return /^[=+@]/.test(s) ? "'" + s : s; }
function num_(v) { const n = Number(v); return isFinite(n) ? n : 0; }
function pct_(v, fallback) {
  const n = Number(v);
  if (v === '' || v == null || !isFinite(n) || n <= 0) return fallback;
  return n > 1 ? n / 100 : n;          // accepts 0.9 or 90
}
function bool_(v) { return v === true || /^(true|yes|y|1|x)$/i.test(String(v).trim()); }
function sameId_(a, b) { return String(a).trim() === String(b).trim() && String(a).trim() !== ''; }
function median_(arr) {
  if (!arr.length) return 0;
  const s = arr.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}
function daysList_(v) {
  if (v instanceof Date) return [Utilities.formatDate(v, TZ, 'yyyy-MM-dd')];
  const out = [];
  String(v || '').split(/[,\s]+/).forEach(s => { if (/^\d{4}-\d{2}-\d{2}$/.test(s) && out.indexOf(s) < 0) out.push(s); });
  return out;
}
function displayName_(row) {
  const chosen = String(row.displayName || '').trim();
  if (chosen) return chosen;
  const first = String(row.studentName || '').trim().split(/\s+/)[0];
  return first || 'Adventurer';
}
function bump_(cache, key) { cache.put(key, String(num_(cache.get(key)) + 1), LOCKOUT_SECONDS); }
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


/* ───────────── Admin menu (inside the Sheet) ───────────── */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Math Realm')
    .addItem('Set up tabs', 'setupSheets')
    .addItem('Fill in missing PINs', 'generatePins')
    .addItem('Apply Settings and Skills changes now', 'reloadConfig')
    .addToUi();
}

// Safe to run again: it adds missing tabs and columns but never deletes or overwrites data.
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach(k => ensureTab_(ss, TABS[k]));

  // Plain-text columns keep leading zeros in IDs and PINs, and stop answers like "3/4" turning into dates.
  textColumns_(TABS.roster,   ['studentId', 'classCode', 'pin']);
  textColumns_(TABS.skills,   ['skillId']);
  textColumns_(TABS.mastery,  ['studentId', 'skillId', 'qualifyingDays']);
  textColumns_(TABS.sessions, ['studentId', 'roundId']);
  textColumns_(TABS.attempts, ['studentId', 'prompt', 'answer']);
  textColumns_(TABS.points,   ['studentId']);
  textColumns_(TABS.saves,    ['studentId', 'json']);
  textColumns_(TABS.tickets,  ['ticketCode', 'studentId']);
  checkboxColumns_(TABS.roster,  ['disabled']);
  checkboxColumns_(TABS.skills,  ['milestone']);
  checkboxColumns_(TABS.tickets, ['redeemed']);

  seedIfEmpty_(TABS.settings, DEFAULT_SETTINGS.map(r => ({ key: r[0], value: r[1], notes: r[2] })));
  seedIfEmpty_(TABS.skills, DEFAULT_SKILLS.map(r => ({
    skillId: r[0], name: r[1], zone: r[2], minItems: r[3], minAccuracy: r[4], maxMedianMs: r[5], daysNeeded: r[6], milestone: r[7],
  })));
  seedIfEmpty_(TABS.roster, [{
    studentId: 'TEST1', studentName: 'Test Student', displayName: 'Tester', classCode: 'DEMO', pin: '1234',
    disabled: false, points: 0, lifetimePoints: 0, lastLogin: '',
  }]);

  const starter = ss.getSheetByName('Sheet1');
  if (starter && starter.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(starter);
  ss.setActiveSheet(ss.getSheetByName(TABS.roster.name));
  CacheService.getScriptCache().removeAll(['cfg_settings', 'cfg_skills']);
  ss.toast('All tabs are ready. Next step: deploy the web app.', 'Math Realm', 8);
}

function generatePins() {
  const t = table_(TABS.roster);
  let filled = 0;
  t.rows.forEach((r, i) => {
    if (String(r.studentId).trim() && !String(r.pin).trim()) {
      t.update(i, { pin: String(1000 + Math.floor(Math.random() * 9000)) });
      filled++;
    }
  });
  SpreadsheetApp.getActive().toast(filled + (filled === 1 ? ' PIN' : ' PINs') + ' added.', 'Math Realm', 5);
}

function reloadConfig() {
  CacheService.getScriptCache().removeAll(['cfg_settings', 'cfg_skills']);
  SpreadsheetApp.getActive().toast('Settings and Skills changes are live.', 'Math Realm', 5);
}

function ensureTab_(ss, tab) {
  const sh = ss.getSheetByName(tab.name) || ss.insertSheet(tab.name);
  const lastCol = sh.getLastColumn();
  const existing = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim()) : [];
  const missing = tab.headers.filter(h => existing.indexOf(h) < 0);
  if (missing.length) sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#EFE7FB');
}

function seedIfEmpty_(tab, objs) {
  if (sheet_(tab).getLastRow() <= 1) appendRows_(tab, objs);
}

function textColumns_(tab, names) {
  const sh = sheet_(tab);
  const col = headerMap_(sh, tab).col;
  names.forEach(n => sh.getRange(1, col[n] + 1, sh.getMaxRows(), 1).setNumberFormat('@'));
}

function checkboxColumns_(tab, names) {
  const sh = sheet_(tab);
  const col = headerMap_(sh, tab).col;
  const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  names.forEach(n => sh.getRange(2, col[n] + 1, sh.getMaxRows() - 1, 1).setDataValidation(rule));
}
