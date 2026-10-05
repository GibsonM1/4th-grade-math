/*
 * Test server: runs the real apps-script/Code.gs in Node with an in-memory Sheet.
 *   node server.js <path to Code.gs> <port>
 * POST /exec   → doPost (exactly what the web app does)
 * POST /admin  → { op: 'setSkill', skillId, patch } | { op: 'dump', tab } | { op: 'clearCache' } | { op: 'reset' }
 */
const fs = require('fs'), vm = require('vm'), http = require('http'), crypto = require('crypto');
const [,, codePath, portArg] = process.argv;
const port = Number(portArg || 8787);

function makeSheet(name) {
  const data = [];   // rows of values
  let maxRows = 1000;
  const sh = {
    name, data,
    getName: () => name,
    getLastRow() { for (let r = data.length - 1; r >= 0; r--) if ((data[r] || []).some(v => v !== '' && v != null)) return r + 1; return 0; },
    getLastColumn() { let m = 0; data.forEach(row => { for (let c = (row || []).length - 1; c >= 0; c--) if (row[c] !== '' && row[c] != null) { m = Math.max(m, c + 1); break; } }); return m; },
    getMaxRows: () => Math.max(maxRows, data.length),
    insertRowsAfter(_, n) { maxRows += n; },
    setFrozenRows() {},
    getRange(r, c, nr, nc) { return makeRange(sh, r, c, nr || 1, nc || 1); },
    getDataRange() { return makeRange(sh, 1, 1, Math.max(1, sh.getLastRow()), Math.max(1, sh.getLastColumn())); },
    createTextFinder(text) {
      return { matchEntireCell() { return this; }, findNext() { return data.some(row => (row || []).some(v => String(v) === text)) ? {} : null; } };
    },
  };
  return sh;
}
function makeRange(sh, r, c, nr, nc) {
  const d = sh.data;
  const cell = (i, j) => { const row = d[r - 1 + i] || []; const v = row[c - 1 + j]; return v === undefined || v === null ? '' : v; };
  const set = (i, j, v) => { const ri = r - 1 + i; while (d.length <= ri) d.push([]); const row = d[ri]; while (row.length < c - 1 + j) row.push(''); row[c - 1 + j] = v; };
  const rng = {
    getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) row.push(cell(i, j)); out.push(row); } return out; },
    getValue() { return cell(0, 0); },
    setValues(v) { v.forEach((row, i) => row.forEach((x, j) => set(i, j, x))); return rng; },
    setValue(v) { set(0, 0, v); return rng; },
    setFontWeight() { return rng; }, setBackground() { return rng; }, setNumberFormat() { return rng; }, setDataValidation() { return rng; },
  };
  return rng;
}

let ss, cache;
function freshSheet() {
  const sheets = [makeSheet('Sheet1')];
  ss = {
    getSheetByName: n => sheets.find(s => s.name === n) || null,
    insertSheet(n) { const s = makeSheet(n); sheets.push(s); return s; },
    getSheets: () => sheets.slice(),
    deleteSheet(s) { const i = sheets.indexOf(s); if (i >= 0) sheets.splice(i, 1); },
    setActiveSheet() {}, toast() {},
  };
  cache = new Map();
}
freshSheet();

const ctx = {
  console,
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ss, getActive: () => ss,
    getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() {} }), alert: () => 'OK', ButtonSet: {}, Button: { OK: 'OK' } }),
    newDataValidation: () => ({ requireCheckbox() { return this; }, build: () => ({}) }),
  },
  CacheService: { getScriptCache: () => ({
    get: k => cache.has(k) ? cache.get(k) : null,
    put: (k, v) => { cache.set(k, String(v)); },
    remove: k => { cache.delete(k); },
    removeAll: ks => ks.forEach(k => cache.delete(k)),
  }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    formatDate(d, tz, fmt) {
      const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).formatToParts(d);
      const g = t => (parts.find(p => p.type === t) || {}).value;
      return fmt.replace('yyyy', g('year')).replace('MM', g('month')).replace('dd', g('day')).replace('HH', g('hour')).replace('mm', g('minute')).replace('ss', g('second'));
    },
  },
  ContentService: { MimeType: { JSON: 'json' }, createTextOutput: s => ({ s, setMimeType() { return this; }, getContent() { return this.s; } }) },
};
vm.createContext(ctx);
const code = fs.readFileSync(codePath, 'utf8');
vm.runInContext(code + '\n;this.__api = { doPost, setupSheets, TABS, APP_VERSION };', ctx);
const api = ctx.__api;
function setup() { freshSheet(); api.setupSheets(); }
setup();

function tabRows(tabName) {
  const sh = ss.getSheetByName(tabName);
  const vals = sh.getDataRange().getValues();
  const head = vals[0];
  return vals.slice(1).map(v => { const o = {}; head.forEach((h, i) => { o[h] = v[i]; }); return o; });
}

http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/admin')) {
      const q = JSON.parse(body || '{}');
      let out = { ok: true };
      if (q.op === 'reset') setup();
      else if (q.op === 'clearCache') { cache.delete('cfg_skills'); cache.delete('cfg_settings'); }
      else if (q.op === 'setSkill') {
        const sh = ss.getSheetByName('Skills');
        const head = sh.data[0];
        sh.data.forEach((row, i) => { if (i && row[0] === q.skillId) Object.keys(q.patch).forEach(k => { row[head.indexOf(k)] = q.patch[k]; }); });
        cache.delete('cfg_skills');
      } else if (q.op === 'dump') out.rows = tabRows(q.tab);
      res.end(JSON.stringify(out));
      return;
    }
    const out = api.doPost({ postData: { contents: body } });
    res.end(out.getContent());
  });
}).listen(port, () => console.log('Code.gs ' + api.APP_VERSION + ' test server on ' + port));
