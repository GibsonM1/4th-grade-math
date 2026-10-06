/*
 * Guests get their skill list from GUEST_SKILLS in js/api.js, because they never reach the
 * server. If a skill is added to DEFAULT_SKILLS in apps-script/Code.gs and not here, its whole
 * area silently disappears for guests and families. This compares the two lists.
 *
 *   node tests/check-guest-skills.js        (run from the repo root)
 */
const fs = require('fs');

function rows(text, startMarker) {
  const from = text.indexOf(startMarker);
  if (from < 0) throw new Error('could not find ' + startMarker);
  const open = text.indexOf('[', from);
  let depth = 0, end = open;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') { depth--; if (!depth) { end = i; break; } }
  }
  const body = text.slice(open, end + 1);
  const out = [];
  body.replace(/\[\s*'([^']+)'\s*,\s*'((?:[^'\\]|\\.)*)'\s*,\s*'([^']*)'\s*,\s*(\d+)\s*,\s*([\d.]+)\s*,\s*('' |''|\d+)\s*,\s*(\d+)\s*,\s*(true|false)\s*\]/g,
    (m, id, name, zone, items, acc, speed, days, milestone) => {
      out.push({ id, name: name.replace(/\\'/g, "'"), zone, items: +items, acc: +acc,
                 speed: Number(String(speed).replace(/'/g, '') || 0), days: +days, milestone: milestone === 'true' });
      return m;
    });
  return out;
}

const server = rows(fs.readFileSync('apps-script/Code.gs', 'utf8'), 'const DEFAULT_SKILLS');
const guest = rows(fs.readFileSync('js/api.js', 'utf8'), 'const GUEST_SKILLS');
const byId = list => { const m = {}; list.forEach(r => { m[r.id] = r; }); return m; };
const S = byId(server), G = byId(guest);
const problems = [];

Object.keys(S).forEach(id => { if (!G[id]) problems.push('missing from GUEST_SKILLS in js/api.js: ' + id + '  (' + S[id].zone + ')'); });
Object.keys(G).forEach(id => { if (!S[id]) problems.push('in GUEST_SKILLS but not on the server: ' + id); });
Object.keys(S).forEach(id => {
  if (!G[id]) return;
  ['name', 'zone', 'items', 'acc', 'days', 'milestone'].forEach(k => {
    if (String(S[id][k]) !== String(G[id][k])) problems.push(id + ': ' + k + ' is "' + S[id][k] + '" on the server but "' + G[id][k] + '" for guests');
  });
});

console.log('server skills: ' + server.length + '   guest skills: ' + guest.length);
if (problems.length) {
  console.error('\nGuest skill list is out of step:\n  ' + problems.join('\n  '));
  console.error('\nFix: copy the row from DEFAULT_SKILLS in apps-script/Code.gs into GUEST_SKILLS in js/api.js.');
  process.exit(1);
}
console.log('Guest skill list matches the server. ✓');
