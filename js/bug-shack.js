/*
 * Math Realm: bug❤️shack (measuring in tenths and hundredths of a centimeter, then stacking)
 *   bug-shack.html?skill=g4.bug.tenths | g4.bug.hundredths | g4.bug.stack | g4.bug.build
 *
 * Guests line up at the shack and stand next to a magnified measuring tape.
 *   tenths      read the tape in tenths of a cm. Only some marks have numbers, so the
 *               student works out what each small space is worth (4.NF.6, 4.MD.1-2).
 *   hundredths  a magnifier splits one tenth into 10 hundredths; only every 10th mark
 *               is labeled (0.67 cm, 1.04 cm).
 *   stack       one bug stands on another and the tape fogs up. Add the two heights from
 *               the guest book. Every sum is shown as fractions too (70/100 + 45/100), because
 *               adding tenths and hundredths as fractions is 4th grade (4.NF.5, 4.NF.3);
 *               adding decimals as decimals is 5th grade (5.NBT.7).
 *   build       pick two guests whose heights add up to the height of a hanging heart.
 *
 * Boomer the bouncer sometimes writes a badge first, with the mistakes students really make
 * (1.04 read as 1.4, counting marks instead of spaces, 0.7 + 0.45 = 0.52). The student still
 * types their own answer; catching Boomer lights up the sign.
 *
 * Every bug a student measures goes in their guest book (the game's save), and the stack and
 * build games use those heights. Lengths are whole numbers of hundredths (67 means 0.67 cm).
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

  const GAME_ID = 'bug-shack';
  const C = window.MATH_REALM_CATALOG;
  const $ = s => document.querySelector(s);
  const INK = '#2A1F45';
  const STAR_PATH = 'M14 2.8l3.4 7 7.7 1-5.6 5.3 1.4 7.6L14 19.9l-6.9 3.8 1.4-7.6-5.6-5.3 7.7-1z';
  const MODES = {
    'g4.bug.tenths':     { kind: 'measure', tut: 'tenths', places: 1, px: 240, range: 2 },
    'g4.bug.hundredths': { kind: 'measure', tut: 'hundredths', places: 2, px: 240, range: 2 },
    'g4.bug.stack':      { kind: 'stack', tut: 'stack', places: 2, px: 160, range: 3 },
    'g4.bug.build':      { kind: 'build', tut: 'build', places: 2, px: 160, range: 3 },
  };
  const BOOK_MAX = 40;

  const session = MathRealm.session;
  const skillId = new URLSearchParams(location.search).get('skill') || '';
  const skill = (session.skills || []).find(k => k.skillId === skillId);
  const M = MODES[skillId];
  const still = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  /* ── Helpers ── */

  const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const shuffle = list => { const a = list.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const wait = ms => new Promise(r => setTimeout(r, still() ? Math.min(ms, 60) : ms));
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function S(tag, attrs) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k]));
    return e;
  }
  function T(x, y, text, attrs) {
    const t = S('text', Object.assign({ x: x, y: y, fill: INK, 'font-size': 16, 'font-weight': 600 }, attrs || {}));
    t.textContent = text;
    return t;
  }
  function show(id) {
    ['#intro', '#play', '#done', '#missing'].forEach(s => { $(s).hidden = s !== id; });
    window.scrollTo(0, 0);
  }
  // A length in hundredths, written the way a person would: 0.7, 0.67, 1.04, 1
  const dec = h => h % 100 === 0 ? String(h / 100) : h % 10 === 0 ? (h / 100).toFixed(1) : (h / 100).toFixed(2);
  const dec2 = h => (h / 100).toFixed(2);   // always to hundredths: 0.70
  const den10 = h => h % 10 === 0;
  const tenthsOf = h => Math.floor(h / 10) % 10;
  const hundOf = h => h % 10;
  const onesOf = h => Math.floor(h / 100);
  // Fractions as text: 7/10, 67/100, 1 4/100
  function fracText(h, den, improper) {
    const n = den === 10 ? h / 10 : h;
    if (improper || n < den) return n + '/' + den;
    const w = Math.floor(n / den), r = n % den;
    return r ? w + ' ' + r + '/' + den : String(w);
  }
  // Fractions drawn stacked
  function fracNode(n, den, improper) {
    const wrap = el('span', 'mixed');
    const whole = improper ? 0 : Math.floor(n / den), rem = improper ? n : n % den;
    if (whole) wrap.append(el('span', '', String(whole)));
    if (rem || !whole) {
      const f = el('span', 'sf');
      f.append(el('span', 't', String(rem)), el('span', 'b', String(den)));
      wrap.append(f);
    }
    return wrap;
  }
  const hFrac = (h, den, improper) => fracNode(den === 10 ? h / 10 : h, den, improper);

  function updateGems() {
    const s = MathRealm.session;
    $('#gemCount').textContent = s ? Number(s.student.points || 0).toLocaleString() : '0';
  }
  function starRow(have, need, mastered, pop) {
    const row = el('div', 'stars' + (mastered ? ' mastered' : '') + (pop ? ' pop' : ''));
    row.setAttribute('role', 'img');
    row.setAttribute('aria-label', mastered ? 'Mastered' : have + ' of ' + need + ' stars');
    for (let i = 0; i < need; i++) {
      const star = S('svg', { viewBox: '0 0 28 28', class: 'star' + (mastered || i < have ? ' on' : ''), 'aria-hidden': 'true' });
      star.style.setProperty('--i', i);
      star.append(S('path', { d: STAR_PATH }));
      row.append(star);
    }
    return row;
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

  if (!skill || !M) { show('#missing'); return; }
  RealmMusic.setTheme('party');

  /* ── Bugs (original drawings, made for this game) ──
   * Each bug stands upright with its feet at y = 0 and the top of its head exactly at y = -h,
   * so the pointer resting on its head marks its true height. Antennae curl out to the sides,
   * below the top of the head. Outlines, dot eyes and pink cheeks match the realm's critters.
   */

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const F = (fill, extra, sw) => Object.assign({ fill: fill, stroke: INK, 'stroke-width': sw || 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, extra || {});
  let uid = 0;

  function frame(w, h) {
    const r = clamp(Math.min(w * 0.42, h * 0.3), 7, 44);
    const bodyTop = -h + r * 1.55, bodyBot = -3;
    return { w: w, h: h, r: r, hy: -h + r, bodyTop: bodyTop, bodyBot: bodyBot, cy: (bodyTop + bodyBot) / 2, ry: (bodyBot - bodyTop) / 2, rx: w / 2, sw: r < 12 ? 1.5 : 2 };
  }
  function feet(g, f, color) {
    const fw = Math.max(3.5, f.rx * 0.32), fh = Math.max(2.4, fw * 0.5);
    [-1, 1].forEach(s => g.append(S('ellipse', F(color, { cx: s * f.rx * 0.42, cy: -fh, rx: fw, ry: fh }, f.sw))));
  }
  function arms(g, f, color) {
    const y = f.cy - f.ry * 0.15, len = Math.max(5, f.r * 0.55);
    [-1, 1].forEach(s => {
      const d = 'M' + (s * f.rx * 0.92) + ',' + y + ' q' + (s * len * 0.7) + ',' + (-len * 0.2) + ' ' + (s * len) + ',' + (-len * 0.9);
      g.append(S('path', { d: d, fill: 'none', stroke: INK, 'stroke-width': f.sw + 2.4, 'stroke-linecap': 'round' }));
      g.append(S('path', { d: d, fill: 'none', stroke: color, 'stroke-width': f.sw + 0.2, 'stroke-linecap': 'round' }));
    });
  }
  function head(g, f, color, tip) {
    const r = f.r, y0 = -f.h;
    [-1, 1].forEach(s => {
      const x1 = s * r * 0.45, y1 = y0 + r * 0.3, x2 = s * r * 1.32, y2 = y0 + r * 0.42;
      g.append(S('path', { d: 'M' + x1 + ',' + y1 + ' Q' + (s * r * 0.95) + ',' + (y0 + r * 0.02) + ' ' + x2 + ',' + y2, fill: 'none', stroke: INK, 'stroke-width': f.sw, 'stroke-linecap': 'round' }));
      g.append(S('circle', { cx: x2, cy: y2, r: Math.max(1.8, r * 0.13), fill: tip || '#FF7EB6', stroke: INK, 'stroke-width': Math.min(1.5, f.sw) }));
    });
    g.append(S('circle', F(color, { cx: 0, cy: f.hy, r: r }, f.sw)));
    const er = Math.max(1.4, r * 0.14), ey = f.hy - r * 0.05;
    [-1, 1].forEach(s => {
      g.append(S('circle', { cx: s * r * 0.38, cy: ey, r: er, fill: INK }));
      g.append(S('circle', { cx: s * r * 0.38 + er * 0.35, cy: ey - er * 0.38, r: er * 0.36, fill: '#fff' }));
    });
    if (r >= 9) [-1, 1].forEach(s => g.append(S('ellipse', { cx: s * r * 0.62, cy: f.hy + r * 0.3, rx: r * 0.18, ry: r * 0.11, fill: '#FF9CC8', opacity: 0.8 })));
    const sy = f.hy + r * 0.32, sx = r * 0.17;
    g.append(S('path', { d: 'M' + (-sx) + ',' + sy + ' Q0,' + (sy + r * 0.2) + ' ' + sx + ',' + sy, fill: 'none', stroke: INK, 'stroke-width': Math.max(1.2, f.sw * 0.8), 'stroke-linecap': 'round' }));
  }
  function clipBody(g, f) {
    const id = 'bugclip' + (++uid);
    const cp = S('clipPath', { id: id });
    cp.append(S('ellipse', { cx: 0, cy: f.cy, rx: f.rx, ry: f.ry }));
    g.append(cp);
    return 'url(#' + id + ')';
  }

  // min/max: the lengths (in hundredths of a cm) each kind of bug can be
  const KINDS = {
    lady: { name: 'ladybug', aspect: 0.86, min: 20, max: 95,
      pals: [{ body: '#E5484D', spot: INK, head: '#FFE3EA' }, { body: '#FF8A5B', spot: INK, head: '#FFF0E0' }, { body: '#FF7EB6', spot: '#7E2A5A', head: '#FFF0F7' }],
      draw(g, f, p) {
        feet(g, f, INK);
        arms(g, f, '#4A3D66');
        g.append(S('ellipse', F(p.body, { cx: 0, cy: f.cy, rx: f.rx, ry: f.ry }, f.sw)));
        const dots = S('g', { 'clip-path': clipBody(g, f) });
        [[-0.5, -0.45, 0.17], [0.48, -0.5, 0.15], [-0.42, 0.25, 0.2], [0.5, 0.3, 0.16], [0, 0.72, 0.13]].forEach(([x, y, s]) => {
          dots.append(S('circle', { cx: x * f.rx, cy: f.cy + y * f.ry, r: s * Math.min(f.rx, f.ry) * 1.6, fill: p.spot }));
        });
        g.append(dots);
        g.append(S('path', { d: 'M0,' + (f.bodyTop + 1) + ' L0,' + (f.bodyBot - 1), stroke: INK, 'stroke-width': f.sw }));
        g.append(S('ellipse', { cx: -f.rx * 0.45, cy: f.cy - f.ry * 0.62, rx: f.rx * 0.18, ry: f.ry * 0.1, fill: '#fff', opacity: 0.55 }));
        head(g, f, p.head, p.body);
      } },
    bee: { name: 'bumblebee', aspect: 0.76, min: 40, max: 140,
      pals: [{ body: '#FFD84D', stripe: '#3B2F5E', head: '#FFF1B8' }, { body: '#FFB067', stripe: '#3B2F5E', head: '#FFF0DE' }],
      draw(g, f, p) {
        [-1, 1].forEach(s => {
          const cx = s * f.rx * 0.95, cy = f.cy - f.ry * 0.45;
          g.append(S('ellipse', F('#E5F4FF', { cx: cx, cy: cy, rx: f.rx * 0.5, ry: f.ry * 0.36, transform: 'rotate(' + (s * -28) + ' ' + cx + ' ' + cy + ')', opacity: 0.92 }, f.sw)));
        });
        feet(g, f, '#3B2F5E');
        arms(g, f, '#3B2F5E');
        g.append(S('ellipse', F(p.body, { cx: 0, cy: f.cy, rx: f.rx, ry: f.ry }, f.sw)));
        const stripes = S('g', { 'clip-path': clipBody(g, f) });
        [-0.15, 0.3, 0.72].forEach(y => stripes.append(S('rect', { x: -f.rx, y: f.cy + y * f.ry - f.ry * 0.11, width: f.w, height: f.ry * 0.22, fill: p.stripe })));
        g.append(stripes);
        g.append(S('ellipse', { cx: 0, cy: f.cy, rx: f.rx, ry: f.ry, fill: 'none', stroke: INK, 'stroke-width': f.sw }));
        head(g, f, p.head, '#3B2F5E');
      } },
    beetle: { name: 'beetle', aspect: 0.7, min: 50, max: 150,
      pals: [{ body: '#7C5CD6', shine: '#C9A8FF', head: '#E7DDFF' }, { body: '#2FA58A', shine: '#9DF0D6', head: '#DDF7EE' }, { body: '#2D76B5', shine: '#A9D8FF', head: '#E1F1FF' }],
      draw(g, f, p) {
        feet(g, f, INK);
        arms(g, f, '#4A3D66');
        g.append(S('ellipse', F(p.body, { cx: 0, cy: f.cy, rx: f.rx, ry: f.ry }, f.sw)));
        g.append(S('path', { d: 'M0,' + (f.bodyTop + f.ry * 0.25) + ' L0,' + (f.bodyBot - 1), stroke: INK, 'stroke-width': f.sw }));
        g.append(S('path', { d: 'M' + (-f.rx * 0.82) + ',' + (f.cy - f.ry * 0.45) + ' Q0,' + (f.cy - f.ry * 0.2) + ' ' + (f.rx * 0.82) + ',' + (f.cy - f.ry * 0.45), fill: 'none', stroke: INK, 'stroke-width': f.sw }));
        g.append(S('ellipse', { cx: -f.rx * 0.45, cy: f.cy + f.ry * 0.05, rx: f.rx * 0.13, ry: f.ry * 0.3, fill: p.shine, opacity: 0.9 }));
        g.append(S('ellipse', { cx: f.rx * 0.5, cy: f.cy + f.ry * 0.2, rx: f.rx * 0.08, ry: f.ry * 0.16, fill: p.shine, opacity: 0.7 }));
        head(g, f, p.head, p.body);
      } },
    firefly: { name: 'firefly', aspect: 0.64, min: 40, max: 125,
      pals: [{ body: '#9C6234', glow: '#FFF27A', head: '#FFE6C8' }, { body: '#6C4FB3', glow: '#B8FFE4', head: '#EFE6FF' }],
      draw(g, f, p) {
        g.append(S('ellipse', { cx: 0, cy: f.cy + f.ry * 0.5, rx: f.rx * 1.25, ry: f.ry * 0.7, fill: p.glow, opacity: 0.45 }));
        [-1, 1].forEach(s => {
          const cx = s * f.rx * 0.8, cy = f.cy - f.ry * 0.5;
          g.append(S('ellipse', F('#F2F7FF', { cx: cx, cy: cy, rx: f.rx * 0.42, ry: f.ry * 0.34, transform: 'rotate(' + (s * -22) + ' ' + cx + ' ' + cy + ')', opacity: 0.9 }, f.sw)));
        });
        feet(g, f, INK);
        arms(g, f, p.body);
        g.append(S('ellipse', F(p.glow, { cx: 0, cy: f.cy, rx: f.rx, ry: f.ry }, f.sw)));
        const top = S('g', { 'clip-path': clipBody(g, f) });
        top.append(S('rect', { x: -f.rx, y: f.bodyTop, width: f.w, height: f.ry * 1.05, fill: p.body }));
        g.append(top);
        g.append(S('ellipse', { cx: 0, cy: f.cy, rx: f.rx, ry: f.ry, fill: 'none', stroke: INK, 'stroke-width': f.sw }));
        head(g, f, p.head, p.glow);
      } },
    ant: { name: 'ant', aspect: 0.54, min: 30, max: 115,
      pals: [{ body: '#C2552E', head: '#F6C7A6' }, { body: '#4A3D86', head: '#DCD3FF' }],
      draw(g, f, p) {
        const ab = { cy: f.cy + f.ry * 0.38, ry: f.ry * 0.62 }, th = { cy: f.cy - f.ry * 0.55, ry: f.ry * 0.42 };
        [-1, 1].forEach(s => [0.15, 0.55].forEach(t => g.append(S('path', { d: 'M' + (s * f.rx * 0.5) + ',' + (f.cy + f.ry * (t - 0.3)) + ' l' + (s * f.rx * 0.55) + ',' + (f.ry * 0.12) + ' l' + (s * f.rx * 0.1) + ',' + (f.ry * 0.22), fill: 'none', stroke: INK, 'stroke-width': f.sw, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))));
        feet(g, f, INK);
        g.append(S('ellipse', F(p.body, { cx: 0, cy: ab.cy, rx: f.rx * 0.95, ry: ab.ry }, f.sw)));
        g.append(S('ellipse', F(p.body, { cx: 0, cy: th.cy, rx: f.rx * 0.62, ry: th.ry }, f.sw)));
        arms(g, Object.assign({}, f, { cy: th.cy, ry: th.ry, rx: f.rx * 0.62 }), p.body);
        g.append(S('ellipse', { cx: -f.rx * 0.35, cy: ab.cy - ab.ry * 0.4, rx: f.rx * 0.15, ry: ab.ry * 0.18, fill: '#fff', opacity: 0.45 }));
        head(g, f, p.head, p.body);
      } },
    fly: { name: 'butterfly', aspect: 1.1, min: 30, max: 95,
      pals: [{ body: '#5B4B8A', w1: '#FF9CC8', w2: '#C9A8FF', dot: '#FFD84D', head: '#EFE6FF' }, { body: '#2D76B5', w1: '#7CC8FF', w2: '#4FD1AB', dot: '#FFFFFF', head: '#E1F1FF' }, { body: '#A8306C', w1: '#FFD84D', w2: '#FF8A5B', dot: '#FFFFFF', head: '#FFF1E0' }],
      draw(g, f, p) {
        const bw = f.w * 0.2;
        [-1, 1].forEach(s => {
          g.append(S('path', F(p.w1, { d: 'M' + (s * bw * 0.3) + ',' + (f.cy - f.ry * 0.1) + ' C' + (s * f.rx * 0.6) + ',' + (f.bodyTop - f.ry * 0.1) + ' ' + (s * f.rx * 1.05) + ',' + (f.bodyTop + f.ry * 0.1) + ' ' + (s * f.rx * 0.98) + ',' + (f.cy - f.ry * 0.25) + ' C' + (s * f.rx * 0.95) + ',' + (f.cy + f.ry * 0.05) + ' ' + (s * f.rx * 0.5) + ',' + (f.cy + f.ry * 0.1) + ' ' + (s * bw * 0.3) + ',' + (f.cy + f.ry * 0.05) + ' Z' }, f.sw)));
          g.append(S('path', F(p.w2, { d: 'M' + (s * bw * 0.3) + ',' + (f.cy + f.ry * 0.05) + ' C' + (s * f.rx * 0.75) + ',' + (f.cy + f.ry * 0.05) + ' ' + (s * f.rx * 0.85) + ',' + (f.cy + f.ry * 0.75) + ' ' + (s * f.rx * 0.5) + ',' + (f.cy + f.ry * 0.82) + ' C' + (s * f.rx * 0.25) + ',' + (f.cy + f.ry * 0.85) + ' ' + (s * bw * 0.4) + ',' + (f.cy + f.ry * 0.5) + ' ' + (s * bw * 0.3) + ',' + (f.cy + f.ry * 0.05) + ' Z' }, f.sw)));
          g.append(S('circle', { cx: s * f.rx * 0.62, cy: f.cy - f.ry * 0.38, r: Math.max(2, f.rx * 0.11), fill: p.dot, stroke: INK, 'stroke-width': 1.2 }));
        });
        feet(g, Object.assign({}, f, { rx: bw * 1.4 }), INK);
        g.append(S('ellipse', F(p.body, { cx: 0, cy: f.cy + f.ry * 0.1, rx: bw / 2 + 2, ry: f.ry * 0.95 }, f.sw)));
        head(g, f, p.head, p.w1);
      } },
    cater: { name: 'caterpillar', aspect: 0.36, min: 70, max: 199,
      pals: [{ a: '#7CCB5A', b: '#A7E38A', head: '#C6F2AE', tip: '#FFD84D' }, { a: '#7CC8FF', b: '#B9E2FF', head: '#D7EFFF', tip: '#FF7EB6' }, { a: '#FF9CC8', b: '#FFC7E0', head: '#FFE0EE', tip: '#7C5CD6' }],
      draw(g, f, p) {
        const segR = Math.min(f.rx, 30);
        const top = f.bodyTop + segR * 0.2, bot = -segR * 0.85;
        const n = Math.max(2, Math.round((bot - top) / (segR * 1.25)) + 1);
        const step = (bot - top) / (n - 1);
        for (let i = n - 1; i >= 0; i--) {
          const y = top + i * step;
          [-1, 1].forEach(s => g.append(S('ellipse', F(INK, { cx: s * segR * 0.95, cy: y + segR * 0.35, rx: Math.max(2, segR * 0.2), ry: Math.max(1.6, segR * 0.13) }, 1))));
          g.append(S('circle', F(i % 2 ? p.a : p.b, { cx: 0, cy: y, r: segR }, f.sw)));
        }
        head(g, f, p.head, p.tip);
      } },
  };
  const KIND_IDS = Object.keys(KINDS);

  // The drawing of one bug, hPx tall. Width comes from its shape, never wider than maxW.
  function bugShape(bug, hPx, maxW) {
    const K = KINDS[bug.k] || KINDS.lady;
    const w = Math.min(maxW || 190, Math.max(14, hPx * K.aspect));
    const g = S('g');
    const f = frame(w, hPx);
    if (bug.k === 'cater') {
      f.r = clamp(Math.min(w * 0.5, 30), 7, 30);
      f.hy = -hPx + f.r;
      f.bodyTop = -hPx + f.r * 1.6;
      f.rx = Math.min(w / 2, 26);
      f.sw = f.r < 12 ? 1.5 : 2;
    }
    K.draw(g, f, K.pals[(bug.c || 0) % K.pals.length]);
    return g;
  }
  function bugWidth(bug, hPx, maxW) { return Math.min(maxW || 190, Math.max(14, hPx * (KINDS[bug.k] || KINDS.lady).aspect)); }
  // A small picture of a bug for cards, the party strip and the guest book
  function bugIcon(bug, cls) {
    const hPx = 100, w = bugWidth(bug, hPx, 120);
    const pad = 8, half = Math.max(w / 2, hPx * 0.36) + pad;
    const svg = S('svg', { viewBox: (-half) + ' ' + (-hPx - pad) + ' ' + (half * 2) + ' ' + (hPx + pad + 4), 'aria-hidden': 'true' });
    if (cls) svg.setAttribute('class', cls);
    svg.append(bugShape(bug, hPx, 120));
    return svg;
  }

  // Boomer the bouncer: a big friendly beetle in sunglasses with a clipboard
  function boomerShape(claim) {
    const g = S('g', { class: 'boomer' });
    const sh = S('g', { class: 'hop' });
    sh.append(S('ellipse', F('#3B2F5E', { cx: -18, cy: -5, rx: 15, ry: 6 })));
    sh.append(S('ellipse', F('#3B2F5E', { cx: 18, cy: -5, rx: 15, ry: 6 })));
    sh.append(S('ellipse', F('#2FA58A', { cx: 0, cy: -52, rx: 44, ry: 48 })));
    sh.append(S('path', { d: 'M0,-96 L0,-8', stroke: INK, 'stroke-width': 2 }));
    sh.append(S('ellipse', { cx: -22, cy: -60, rx: 7, ry: 18, fill: '#9DF0D6', opacity: 0.8 }));
    sh.append(S('circle', F('#DDF7EE', { cx: 0, cy: -118, r: 30 })));
    // sunglasses
    sh.append(S('path', { d: 'M-24,-126 L24,-126', stroke: INK, 'stroke-width': 3 }));
    [-12, 12].forEach(x => sh.append(S('rect', F(INK, { x: x - 10, y: -129, width: 20, height: 12, rx: 5 }))));
    sh.append(S('path', { d: 'M-17,-125 l5,-2', stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round' }));
    sh.append(S('path', { d: 'M-8,-106 Q0,-100 8,-106', fill: 'none', stroke: INK, 'stroke-width': 2.2, 'stroke-linecap': 'round' }));
    [-1, 1].forEach(s => sh.append(S('ellipse', { cx: s * 19, cy: -108, rx: 5, ry: 3, fill: '#FF9CC8', opacity: 0.8 })));
    [-1, 1].forEach(s => {
      sh.append(S('path', { d: 'M' + (s * 12) + ',-145 Q' + (s * 22) + ',-150 ' + (s * 34) + ',-140', fill: 'none', stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' }));
      sh.append(S('circle', { cx: s * 34, cy: -140, r: 4, fill: '#FFD84D', stroke: INK, 'stroke-width': 1.5 }));
    });
    // clipboard
    sh.append(S('rect', F('#E8B877', { x: -46, y: -84, width: 50, height: 62, rx: 6, transform: 'rotate(-8 -21 -53)' })));
    sh.append(S('rect', F('#FFFFFF', { x: -41, y: -76, width: 40, height: 48, rx: 3, transform: 'rotate(-8 -21 -53)' }, 1.5)));
    if (claim != null) {
      sh.append(T(-21, -52, claim, { 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 800, class: 'num-label', transform: 'rotate(-8 -21 -53)' }));
      sh.append(T(-21, -36, 'cm', { 'text-anchor': 'middle', 'font-size': 11, transform: 'rotate(-8 -21 -53)' }));
    }
    sh.append(S('path', { d: 'M-40,-40 q-10,6 -2,14', fill: 'none', stroke: INK, 'stroke-width': 5, 'stroke-linecap': 'round' }));
    sh.append(S('path', { d: 'M40,-40 q10,6 2,14', fill: 'none', stroke: INK, 'stroke-width': 5, 'stroke-linecap': 'round' }));
    g.append(sh);
    return g;
  }
  function boomerIcon(claim) {
    const svg = S('svg', { viewBox: '-62 -160 124 164', 'aria-hidden': 'true' });
    svg.append(boomerShape(claim));
    return svg;
  }

  const NAMES = ['Pip', 'Juniper', 'Mo', 'Bitsy', 'Zuzu', 'Clover', 'Sunny', 'Pickle', 'Taffy', 'Nell', 'Dash', 'Kiki', 'Rosie', 'Bean',
    'Tilly', 'Ozzie', 'Peaches', 'Wren', 'Fig', 'Gus', 'Marigold', 'Noodle', 'Pepper', 'Sprout', 'Twinkle', 'Opal', 'Hazel', 'Moxie',
    'Poppy', 'Jellybean', 'Lulu', 'Ziggy', 'Daisy', 'Waffles', 'Pebble', 'Coco', 'Sparkle', 'Button', 'Mango', 'Indie', 'Velvet', 'Ruby'];

  /* ── The guest book (this game's save) ── */

  let memory = { v: 1, book: [], tut: {}, stack: { lvl: 1, wins: 0, miss: 0 }, nextId: 1 }, memoryLoaded = false;
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  function kindsFor(h) { return KIND_IDS.filter(k => KINDS[k].min <= h && h <= KINDS[k].max); }
  function newBug(h, avoidNames) {
    const used = new Set(memory.book.map(b => b.n).concat(avoidNames || []));
    const free = NAMES.filter(n => !used.has(n));
    const k = pick(kindsFor(h).length ? kindsFor(h) : ['cater']);
    return { id: memory.nextId++, k: k, c: rnd(0, KINDS[k].pals.length - 1), n: pick(free.length ? free : NAMES), h: h, by: '', d: today() };
  }
  // Adds a bug (or marks it measured by the student). Old bugs leave first, ones the student measured last.
  function remember(bug, byYou) {
    const have = memory.book.find(b => b.id === bug.id);
    if (have) { if (byYou) { have.by = 'you'; have.d = today(); } return; }
    if (byYou) { bug.by = 'you'; bug.d = today(); }
    memory.book.push(bug);
    while (memory.book.length > BOOK_MAX) {
      const i = memory.book.findIndex(b => b.by !== 'you');
      memory.book.splice(i >= 0 ? i : 0, 1);
    }
  }
  function bookBug(h, exclude) {
    const list = memory.book.filter(b => b.h === h && exclude.indexOf(b.id) < 0);
    return list.length ? pick(list) : null;
  }

  /* ── Problems ── */

  // Measuring: how the tape is labeled at each level.
  //   tenths 1      labels every 0.5 cm      tenths 2-3   labels only whole cm
  //   hundredths    the magnifier labels only the tenths at its ends (every 10th mark)
  function makeMeasure(tier, used) {
    let h, tape;
    for (let tries = 0; tries < 200; tries++) {
      if (M.places === 1) {
        if (tier === 1) { h = pick([20, 30, 40, 60, 70, 80, 90]); tape = { labels: 'half' }; }
        else if (tier === 2) { h = Math.random() < 0.55 ? pick([110, 120, 130, 140, 160, 170, 180, 190]) : pick([30, 40, 60, 70, 80, 90]); tape = { labels: 'whole' }; }
        else { h = pick([20, 30, 40, 60, 70, 80, 90, 110, 120, 130, 140, 160, 170, 180, 190]); tape = { labels: 'whole' }; }
      } else {
        tape = { labels: 'half', hideLens: tier >= 4 };   // top level: the magnifier's numbers are gone
        if (tier === 1) h = rnd(3, 9) * 10 + (Math.random() < 0.45 ? 5 : pick([1, 2, 8, 9]));   // on the long middle mark, or next to a label
        else if (tier === 2) { h = rnd(3, 9) * 10 + rnd(1, 9); }
        else {
          const r = Math.random();
          if (r < 0.4) h = 100 + rnd(1, 9);                          // 1.04: a zero in the tenths place
          else if (r < 0.55) h = rnd(4, 18) * 10;                    // 0.70: same as 0.7
          else h = rnd(11, 19) * 10 + rnd(1, 9);
          if (h === 100 || h === 150 || h === 50) h += 1;
        }
      }
      if (used.indexOf(h) < 0) break;
    }
    used.push(h);
    return { h: h, tape: tape, bug: newBug(h) };
  }

  // Regrouping in a sum of two lengths (hundredths): carry from the hundredths, carry from the tenths.
  function carries(a, b) {
    const c1 = hundOf(a) + hundOf(b) >= 10;
    const c2 = tenthsOf(a) + tenthsOf(b) + (c1 ? 1 : 0) >= 10;
    return { c1: c1, c2: c2 };
  }
  // tier 1: no regrouping; 2: one regroup (0.38 + 0.25, 0.7 + 0.6); 3: across a whole with hundredths (0.7 + 0.45, 0.86 + 0.67)
  function tierOf(a, b) {
    const c = carries(a, b);
    if (c.c1 && c.c2) return 3;
    if (c.c2 && (hundOf(a) || hundOf(b))) return 3;
    if (c.c1 || c.c2) return 2;
    return 1;
  }
  function randomLength(shape) {
    if (shape === 't') return rnd(3, 14) * 10;                              // tenths: 0.3 to 1.4
    let h;
    do { h = rnd(30, 145); } while (h % 10 === 0);
    return h;
  }
  // Two lengths whose sum fits the tier. Prefers bugs already in the guest book.
  // Shapes: 'th' a tenths bug and a hundredths bug (0.7 + 0.45, the heart of 4.NF.5), 'hh' two hundredths,
  // 'tt' two tenths. Two tenths can't regroup twice, so the top level uses the other two.
  function makePair(tier, usedPairs) {
    const keyOf = (a, b) => Math.min(a, b) + '+' + Math.max(a, b);
    const okSum = (a, b) => a + b <= 290 && a + b >= 50;
    const r = Math.random();
    const shape = tier === 3 ? (r < 0.6 ? 'th' : 'hh') : (r < 0.5 ? 'th' : r < 0.78 ? 'hh' : 'tt');
    const fits = (a, b) => a !== b && okSum(a, b) && tierOf(a, b) === tier && usedPairs.indexOf(keyOf(a, b)) < 0 &&
      (shape === 'tt' ? den10(a) && den10(b) : shape === 'hh' ? !den10(a) && !den10(b) : den10(a) !== den10(b));
    const book = memory.book.filter(b => b.h >= 30 && b.h <= 150);
    const fromBook = [];
    for (let i = 0; i < book.length; i++) {
      for (let j = i + 1; j < book.length; j++) if (fits(book[i].h, book[j].h)) fromBook.push([book[i], book[j]]);
    }
    if (fromBook.length && Math.random() < 0.75) {
      const pair = pick(fromBook);
      usedPairs.push(keyOf(pair[0].h, pair[1].h));
      return pair[0].h >= pair[1].h ? pair : [pair[1], pair[0]];
    }
    let a = 0, b = 0;
    for (let tries = 0; tries < 800; tries++) {
      a = randomLength(shape === 'hh' ? 'h' : 't');
      b = randomLength(shape === 'tt' ? 't' : 'h');
      if (fits(a, b)) break;
    }
    usedPairs.push(keyOf(a, b));
    const A = bookBug(a, []) || newBug(a);
    const B = bookBug(b, [A.id]) || newBug(b, [A.n]);
    return A.h >= B.h ? [A, B] : [B, A];
  }

  // Build: a target height and 4 or 5 guests to pick from, with at least one pair that reaches it.
  // The wrong choices are the near misses students fall for: one tenth off, 0.08 for 0.8, swapped digits.
  function makeBuild(tier, usedPairs) {
    const pair = makePair(tier, usedPairs);
    const target = pair[0].h + pair[1].h;
    const want = tier === 3 ? 5 : 4;
    const a = pair[0].h, b = pair[1].h;
    const ideas = shuffle([b + 10, b - 10, a + 10, a - 10, b + 5, b - 5]);
    if (!den10(b)) ideas.unshift(hundOf(b) * 10 + tenthsOf(b) + (b >= 100 ? 100 : 0));   // 0.45 → 0.54
    const lens = [];
    ideas.forEach(h => {
      if (lens.length >= want - 2) return;
      if (h < 30 || h > 150 || h === a || h === b || lens.indexOf(h) >= 0) return;
      lens.push(h);
    });
    while (lens.length < want - 2) { const h = randomLength(Math.random() < 0.5 ? 't' : 'h'); if (h !== a && h !== b && lens.indexOf(h) < 0) lens.push(h); }
    const bugs = pair.slice();
    lens.forEach(h => bugs.push(bookBug(h, bugs.map(x => x.id)) || newBug(h, bugs.map(x => x.n))));
    return { target: target, pair: pair, choices: shuffle(bugs) };
  }

  /* ── The scene: the shack, the tape, the magnifier, the guests ── */

  const V = { FLOOR: 528, TX: 198, TW: 42, BX: 360, BOOMX: 534 };
  const LENS = { x: 12, y: 70, w: 138, h: 424, sx: 82, sw: 34, y0: 458, step: 36 };
  const yOf = h => V.FLOOR - h / 100 * M.px;
  const stage = $('#stage');
  const LAYER = {};
  ['bg', 'tape', 'lens', 'actors', 'over'].forEach(n => { LAYER[n] = S('g', { class: 'layer-' + n }); stage.append(LAYER[n]); });
  const sc = { tape: { labels: 'whole', fog: false }, band: null, lens: null, pointer: null, jumps: null, marks: [], heart: null, queue: 0 };
  let signHearts = 0;   // Boomer's mistakes caught this round light up the sign

  function drawBackdrop() {
    const g = LAYER.bg;
    g.replaceChildren();
    const defs = S('defs');
    const glow = S('filter', { id: 'neon', x: '-30%', y: '-60%', width: '160%', height: '220%' });
    glow.append(S('feGaussianBlur', { stdDeviation: 2.6, result: 'b' }));
    const merge = S('feMerge');
    merge.append(S('feMergeNode', { in: 'b' }), S('feMergeNode', { in: 'SourceGraphic' }));
    glow.append(merge);
    const sky = S('linearGradient', { id: 'skyGrad', x1: 0, x2: 0, y1: 0, y2: 1 });
    [['0', '#241A4A'], ['0.7', '#6E3F8F'], ['1', '#FF9CC8']].forEach(([o, c]) => sky.append(S('stop', { offset: o, 'stop-color': c })));
    defs.append(glow, sky);
    g.append(defs);
    // plank wall
    g.append(S('rect', { x: 0, y: 0, width: 600, height: V.FLOOR, fill: '#E3F7EF' }));
    for (let y = 44, row = 0; y < V.FLOOR; y += 44, row++) {
      g.append(S('line', { x1: 0, x2: 600, y1: y, y2: y, stroke: '#CDEFE2', 'stroke-width': 2 }));
      for (let x = (row % 2) * 70 + 40; x < 600; x += 140) g.append(S('line', { x1: x, x2: x, y1: y - 44, y2: y, stroke: '#D6F2E7', 'stroke-width': 2 }));
    }
    // window to the twilight beach
    g.append(S('rect', { x: 472, y: 34, width: 112, height: 98, rx: 10, fill: 'url(#skyGrad)', stroke: INK, 'stroke-width': 3 }));
    g.append(S('circle', { cx: 552, cy: 60, r: 9, fill: '#FFE9A8' }));
    [[490, 50], [510, 74], [536, 44], [568, 86]].forEach(([x, y]) => g.append(S('circle', { cx: x, cy: y, r: 1.4, fill: '#fff' })));
    g.append(S('path', { d: 'M473,112 q14,-7 28,0 t28,0 t28,0 t27,0 L583,131 L473,131 Z', fill: '#2D76B5' }));
    g.append(S('path', { d: 'M473,112 q14,-7 28,0 t28,0 t28,0 t27,0', fill: 'none', stroke: '#7CC8FF', 'stroke-width': 2 }));
    g.append(S('line', { x1: 528, x2: 528, y1: 35, y2: 131, stroke: INK, 'stroke-width': 3 }));
    // neon sign
    const sign = S('g', { class: 'sign' });
    sign.append(S('rect', { x: 462, y: 150, width: 132, height: 46, rx: 12, fill: '#3B2F5E', stroke: INK, 'stroke-width': 2 }));
    const word = (x, t, anchor) => sign.append(T(x, 180, t, { 'font-size': 18, 'font-weight': 800, class: 'num-label', fill: '#FFD6EA', filter: 'url(#neon)', 'text-anchor': anchor }));
    word(511, 'bug', 'end'); word(535, 'shack', 'start');
    sign.append(S('path', { id: 'signHeart', d: heartPath(523, 182, 7), fill: signHearts ? '#FF4F9A' : '#7E2A5A', filter: signHearts ? 'url(#neon)' : '', class: signHearts ? 'heart-glow' : '' }));
    g.append(sign);
    // string lights
    g.append(S('path', { d: 'M0,10 Q75,30 150,12 T300,12 T450,12 T600,10', fill: 'none', stroke: INK, 'stroke-width': 1.5 }));
    ['#FFD84D', '#FF7EB6', '#4FD1AB', '#7CC8FF'].forEach((c, i) => {
      for (let x = 22 + i * 38; x < 600; x += 152) {
        const yy = 13 + 8 * Math.sin((x % 150) / 150 * Math.PI);
        g.append(S('ellipse', { cx: x, cy: yy + 6, rx: 4.5, ry: 6.5, fill: c, stroke: INK, 'stroke-width': 1.2 }));
      }
    });
    // floor boards
    g.append(S('rect', { x: 0, y: V.FLOOR, width: 600, height: 40, fill: '#FBE6C4' }));
    g.append(S('line', { x1: 0, x2: 600, y1: V.FLOOR, y2: V.FLOOR, stroke: INK, 'stroke-width': 2.5 }));
    [0, 1].forEach(r => { for (let x = 30 + r * 50; x < 600; x += 100) g.append(S('line', { x1: x, x2: x, y1: V.FLOOR + 2 + r * 15, y2: V.FLOOR + 15 + r * 15, stroke: '#E8CFA4', 'stroke-width': 2 })); });
    g.append(S('line', { x1: 0, x2: 600, y1: V.FLOOR + 16, y2: V.FLOOR + 16, stroke: '#E8CFA4', 'stroke-width': 2 }));
    if (M.kind !== 'measure') {   // a beach ball and a little palm by the door
      g.append(S('path', { d: 'M70,' + (V.FLOOR - 6) + ' C66,' + (V.FLOOR - 70) + ' 82,' + (V.FLOOR - 120) + ' 92,' + (V.FLOOR - 150), fill: 'none', stroke: '#9C6234', 'stroke-width': 9, 'stroke-linecap': 'round' }));
      [[-40, -8], [-20, -32], [14, -36], [40, -10], [30, 14]].forEach(([dx, dy]) => g.append(S('path', F('#4FD1AB', { d: 'M92,' + (V.FLOOR - 150) + ' q' + (dx * 0.6) + ',' + (dy - 18) + ' ' + dx + ',' + (dy + 26) + ' q' + (-dx * 0.2) + ',' + (-dy * 0.4 - 16) + ' ' + (-dx) + ',' + (-dy - 26) + ' Z' }, 1.8))));
      g.append(S('path', F('#E8B877', { d: 'M48,' + V.FLOOR + ' L54,' + (V.FLOOR - 30) + ' L90,' + (V.FLOOR - 30) + ' L96,' + V.FLOOR + ' Z' })));
      const bx = 150, by = V.FLOOR - 20;
      g.append(S('circle', F('#FFFFFF', { cx: bx, cy: by, r: 20 })));
      g.append(S('path', { d: 'M' + bx + ',' + (by - 20) + ' Q' + (bx - 16) + ',' + by + ' ' + bx + ',' + (by + 20) + ' Q' + (bx - 30) + ',' + by + ' ' + bx + ',' + (by - 20), fill: '#FF7EB6' }));
      g.append(S('path', { d: 'M' + bx + ',' + (by - 20) + ' Q' + (bx + 16) + ',' + by + ' ' + bx + ',' + (by + 20) + ' Q' + (bx + 30) + ',' + by + ' ' + bx + ',' + (by - 20), fill: '#7CC8FF' }));
      g.append(S('circle', { cx: bx, cy: by, r: 20, fill: 'none', stroke: INK, 'stroke-width': 2 }));
    }
  }
  function heartPath(cx, by, r) {   // a heart with its bottom tip at (cx, by)
    return 'M' + cx + ',' + by + ' C' + (cx - r * 2.2) + ',' + (by - r * 1.2) + ' ' + (cx - r * 1.3) + ',' + (by - r * 2.9) + ' ' + cx + ',' + (by - r * 1.85) +
      ' C' + (cx + r * 1.3) + ',' + (by - r * 2.9) + ' ' + (cx + r * 2.2) + ',' + (by - r * 1.2) + ' ' + cx + ',' + by + ' Z';
  }
  function lightSign() {
    signHearts++;
    const h = document.getElementById('signHeart');
    if (h) { h.setAttribute('fill', '#FF4F9A'); h.setAttribute('filter', 'url(#neon)'); h.setAttribute('class', 'heart-glow'); }
  }

  const label = (x, y, text, big, anchor) => T(x, y, text, { 'text-anchor': anchor || 'end', 'font-size': big ? 24 : 18, 'font-weight': big ? 800 : 600, class: big ? 'num-label' : '' });

  function renderTape() {
    const g = LAYER.tape;
    g.replaceChildren();
    const t = sc.tape, top = yOf(M.range * 100) - 12, right = V.TX + V.TW;
    g.append(S('rect', { x: V.TX, y: top, width: V.TW, height: V.FLOOR - top, rx: 5, fill: '#FFD84D', stroke: INK, 'stroke-width': 2 }));
    g.append(S('rect', { x: V.TX + 4, y: top + 5, width: 5, height: V.FLOOR - top - 10, rx: 2.5, fill: '#FFF1B8', opacity: 0.85 }));
    g.append(S('rect', { x: V.TX - 3, y: V.FLOOR, width: V.TW + 6, height: 9, rx: 2, fill: '#CFC8E3', stroke: INK, 'stroke-width': 2 }));
    g.append(T(right + 8, top + 14, 'cm', { 'font-size': 17, 'font-weight': 800, class: 'num-label' }));
    if (sc.band) g.append(S('rect', { x: V.TX + 1, y: yOf(sc.band[1]), width: V.TW - 2, height: yOf(sc.band[0]) - yOf(sc.band[1]), fill: '#7CC8FF', opacity: 0.55 }));
    for (let h = 0; h <= M.range * 100; h += 10) {
      const whole = h % 100 === 0, half = h % 50 === 0 && !whole;
      const len = whole ? 30 : half ? 21 : 13;   // the 0.5 marks are always a little longer
      const yy = yOf(h);
      g.append(S('line', { x1: right, x2: right - len, y1: yy, y2: yy, stroke: INK, 'stroke-width': whole ? 3 : half ? 2.4 : 1.8 }));
      if (whole || (t.labels === 'half' && half) || t.labels === 'all') g.append(label(V.TX - 8, yy + 7, dec(h), whole));
    }
    if (t.fog) {
      const fog = S('g', { class: 'fog' + (t.fog === 'clear' ? ' clear' : ''), id: 'fog' });
      fog.append(S('rect', { x: V.TX - 48, y: top - 26, width: V.TW + 90, height: V.FLOOR - top + 20, rx: 26, fill: '#F7FCFA' }));
      for (let y = top; y < V.FLOOR - 20; y += 46) {
        [V.TX - 46, V.TX + V.TW + 40].forEach((x, i) => fog.append(S('circle', { cx: x + (i ? 2 : -2), cy: y + (i ? 23 : 0), r: 18, fill: '#F7FCFA' })));
      }
      [[0.2, '?'], [0.5, '?'], [0.8, '?']].forEach(([f, q]) => fog.append(T(V.TX + V.TW / 2 - 8, top + (V.FLOOR - top) * f, q, { 'text-anchor': 'middle', 'font-size': 30, 'font-weight': 800, class: 'num-label', fill: '#B9AEDB' })));
      fog.append(T(V.TX - 8, V.FLOOR + 7, '0', { 'text-anchor': 'end', 'font-size': 24, 'font-weight': 800, class: 'num-label' }));
      g.append(fog);
    }
  }
  function clearFog() {
    const f = document.getElementById('fog');
    sc.tape.fog = 'clear';
    if (f) f.classList.add('clear');
  }

  const lensY = h => LENS.y0 - (h - sc.lens.from) * LENS.step;
  function renderLens() {
    const g = LAYER.lens;
    g.replaceChildren();
    if (!sc.lens) return;
    const from = sc.lens.from, right = LENS.sx + LENS.sw;
    g.append(S('path', { d: 'M' + V.TX + ',' + yOf(from + 10) + ' L' + (LENS.x + LENS.w) + ',' + (LENS.y + 14) + ' L' + (LENS.x + LENS.w) + ',' + (LENS.y + LENS.h - 14) + ' L' + V.TX + ',' + yOf(from) + ' Z', fill: '#7CC8FF', opacity: 0.22 }));
    g.append(S('rect', { x: LENS.x, y: LENS.y, width: LENS.w, height: LENS.h, rx: 22, fill: '#FFFFFF', stroke: '#7CC8FF', 'stroke-width': 6 }));
    g.append(T(LENS.x + LENS.w / 2, LENS.y - 10, 'Zoomed in', { 'text-anchor': 'middle', 'font-size': 15, fill: '#2D76B5' }));
    g.append(S('rect', { x: LENS.sx, y: lensY(from + 10) - 10, width: LENS.sw, height: LENS.step * 10 + 20, rx: 4, fill: '#FFD84D', stroke: INK, 'stroke-width': 2 }));
    for (let i = 0; i <= 10; i++) {
      const end = i === 0 || i === 10, mid = i === 5;
      const yy = lensY(from + i);
      g.append(S('line', { x1: right, x2: right - (end ? 28 : mid ? 20 : 12), y1: yy, y2: yy, stroke: INK, 'stroke-width': end ? 3 : mid ? 2.4 : 1.8 }));
      if (end && !sc.lens.hideLabels) g.append(T(LENS.sx - 7, yy + 7, dec(from + i), { 'text-anchor': 'end', 'font-size': 21, 'font-weight': 800, class: 'num-label' }));
    }
  }

  function pill(g, x, y, text, fill, color) {
    const w = text.length * 9.2 + 18;
    g.append(S('rect', { x: x - w / 2, y: y - 15, width: w, height: 25, rx: 12.5, fill: fill || '#FFF1B8', stroke: INK, 'stroke-width': 1.6 }));
    g.append(T(x, y + 3, text, { 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 800, class: 'num-label', fill: color || INK }));
  }
  function arrowLeft(g, x, y, color) {
    g.append(S('polygon', { points: x + ',' + y + ' ' + (x + 13) + ',' + (y - 8) + ' ' + (x + 13) + ',' + (y + 8), fill: color, stroke: INK, 'stroke-width': 1.4, 'stroke-linejoin': 'round' }));
  }

  // Everything drawn on top: the pointer, counting jumps, circled labels, the heart.
  function renderOver() {
    const g = LAYER.over;
    g.replaceChildren();
    const right = V.TX + V.TW;
    sc.marks.forEach(m => {
      if (m.where === 'lens' && sc.lens) g.append(S('ellipse', { cx: LENS.sx - 20, cy: lensY(m.h), rx: 26, ry: 16, fill: 'none', stroke: '#E8A90C', 'stroke-width': 3 }));
      else if (m.where === 'tape') g.append(S('ellipse', { cx: V.TX - 20, cy: yOf(m.h), rx: 25, ry: 16, fill: 'none', stroke: '#E8A90C', 'stroke-width': 3 }));
    });
    if (sc.heart) {
      const hy = yOf(sc.heart.h);
      g.append(S('line', { x1: V.BX, x2: V.BX, y1: 16, y2: hy - 36, stroke: INK, 'stroke-width': 1.6, 'stroke-dasharray': '3 3' }));
      g.append(S('path', F('#FF4F9A', { d: heartPath(V.BX, hy, 13), class: sc.heart.lit ? 'heart-glow' : '', filter: sc.heart.lit ? 'url(#neon)' : '' })));
      g.append(S('path', { d: 'M' + (V.BX - 10) + ',' + (hy - 26) + ' q4,-5 9,-2', fill: 'none', stroke: '#fff', 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0.85 }));
      pill(g, V.BX + 62, hy - 16, sc.heart.tag, '#FFE3F0');
    }
    const p = sc.pointer;
    if (p) {
      const yy = yOf(p.h), col = '#D2448A';
      g.append(S('line', { x1: V.TX - 2, x2: right, y1: yy, y2: yy, stroke: col, 'stroke-width': 3 }));
      g.append(S('line', { x1: right + 12, x2: V.BX - 26, y1: yy, y2: yy, stroke: col, 'stroke-width': 2.4, 'stroke-dasharray': '6 5' }));
      g.append(S('rect', { x: V.BX - 30, y: yy - 4, width: 60, height: 5, rx: 2.5, fill: col, opacity: 0.85 }));
      arrowLeft(g, right, yy, col);
      if (sc.lens && p.h >= sc.lens.from && p.h <= sc.lens.from + 10) {
        const ly = lensY(p.h), lr = LENS.sx + LENS.sw;
        g.append(S('line', { x1: LENS.sx - 2, x2: lr, y1: ly, y2: ly, stroke: col, 'stroke-width': 3 }));
        arrowLeft(g, lr, ly, col);
      }
      if (p.text) pill(g, right + 52, yy - 20, p.text, p.fill || '#FFF1B8');
    }
    if (sc.jumps) drawJumps(g, sc.jumps);
  }

  // Count the spaces: an arc for each space, numbered 1, 2, 3... (or one arc with a value, like "0.1 cm")
  function drawJumps(g, j) {
    const inLens = j.where === 'lens';
    const x0 = inLens ? LENS.sx + LENS.sw + 2 : V.TX + V.TW + 2;
    const Y = inLens ? lensY : yOf;
    const n = Math.round(Math.abs(j.to - j.from) / j.step), dir = j.to > j.from ? 1 : -1;
    for (let k = 0; k < n; k++) {
      const y1 = Y(j.from + dir * k * j.step), y2 = Y(j.from + dir * (k + 1) * j.step), mid = (y1 + y2) / 2;
      g.append(S('path', { d: 'M' + x0 + ',' + y1 + ' Q' + (x0 + 16) + ',' + mid + ' ' + x0 + ',' + y2, fill: 'none', stroke: '#6C4FB3', 'stroke-width': 2.4 }));
      if (j.text) {
        // keep the label clear of the pointer
        const py = sc.pointer ? Y(sc.pointer.h) : -999;
        let at = mid;
        for (const off of [0, 28, -28, 54, -54]) { const yy = mid + off; if (Math.abs(yy - py) >= 24 && yy < V.FLOOR - 10) { at = yy; break; } }
        if (at !== mid) g.append(S('line', { x1: x0 + 12, x2: x0 + 22, y1: mid, y2: at, stroke: '#6C4FB3', 'stroke-width': 1.6 }));
        pill(g, x0 + 22 + j.text.length * 4.6, at, j.text, '#EFE7FF', '#6C4FB3');
        continue;
      }
      g.append(S('circle', { cx: x0 + 22, cy: mid, r: 9, fill: '#6C4FB3' }));
      g.append(T(x0 + 22, mid + 4.5, String(k + 1), { 'text-anchor': 'middle', 'font-size': 12, 'font-weight': 800, fill: '#fff' }));
    }
  }
  function redraw() { renderTape(); renderLens(); renderOver(); syncData(); }

  /* ── Guests on the stage ── */

  let actors = [];
  function actor(bug, maxW) {
    const g = S('g', { class: 'bug' });
    const hop = S('g', { class: 'hop' });
    hop.append(bugShape(bug, bug.h / 100 * M.px, maxW || (M.kind === 'measure' ? 190 : 170)));
    g.append(hop);
    LAYER.actors.append(g);
    const a = { g: g, bug: bug, x: 0, y: V.FLOOR };
    actors.push(a);
    return a;
  }
  function place(a, x, y) {
    a.x = x; a.y = y;
    a.g.style.transform = 'translate(' + x + 'px,' + y + 'px)';
  }
  async function moveTo(a, x, y, ms, hop) {
    const from = 'translate(' + a.x + 'px,' + a.y + 'px)', to = 'translate(' + x + 'px,' + y + 'px)';
    if (!still() && ms > 0) {
      const frames = hop
        ? [{ transform: from }, { transform: 'translate(' + ((a.x + x) / 2) + 'px,' + (Math.min(a.y, y) - 46) + 'px)' }, { transform: to }]
        : [{ transform: from }, { transform: to }];
      a.g.classList.add('walking');
      const anim = a.g.animate(frames, { duration: ms, easing: hop ? 'ease-in-out' : 'ease-out' });
      await anim.finished.catch(() => {});
      a.g.classList.remove('walking');
    }
    place(a, x, y);
  }
  function clearActors() { actors.forEach(a => a.g.remove()); actors = []; }
  function dance(a, on) { a.g.classList.toggle('dance', on !== false); }

  let boomerG = null;
  function showBoomer(claim) {
    hideBoomer();
    boomerG = boomerShape(claim);
    boomerG.setAttribute('transform', 'translate(' + V.BOOMX + ',' + V.FLOOR + ') scale(0.92)');
    boomerG.classList.add('fade-in');
    LAYER.actors.append(boomerG);
  }
  function hideBoomer() { if (boomerG) { boomerG.remove(); boomerG = null; } }

  // Little guests waiting in line at the door (tenths game only; the magnifier needs that space otherwise)
  let queueG = null;
  function drawQueue(n) {
    if (queueG) queueG.remove();
    queueG = S('g', { 'aria-hidden': 'true' });
    LAYER.bg.append(queueG);
    if (M.kind !== 'measure' || M.places !== 1) return;
    for (let i = 0; i < Math.min(n, 4); i++) {
      const b = { k: KIND_IDS[(i * 3 + sc.queue) % KIND_IDS.length], c: i };
      const hPx = 54 + ((i * 17 + sc.queue * 7) % 26);
      const g = bugShape(b, hPx, 44);
      g.setAttribute('transform', 'translate(' + (140 - i * 38) + ',' + V.FLOOR + ')');
      g.setAttribute('opacity', 0.9);
      queueG.append(g);
    }
  }

  // Test hooks: the current state as data attributes (no student data here).
  function syncData() {
    const d = $('#play').dataset;
    d.phase = phase;
    d.answer = cur && cur.answer != null ? String(cur.answer) : '';
    d.item = String(results.length);
    d.parts = cur && cur.kind === 'stack' ? cur.a + ',' + cur.b : cur && cur.kind === 'build' ? (cur.type === 'missing' ? cur.target + ',' + cur.pair[0].h : cur.choices.map(b => b.h).join(',')) : '';
    d.type = cur && cur.type ? cur.type : '';
    d.level = cur && cur.lvl ? String(cur.lvl) : '';
    d.part = cur && cur.parts && cur.parts[cur.pi] ? cur.parts[cur.pi].k : '';
  }

  /* ── Answer boxes: O . t h ──
   * Each digit has its own box. Click a box (or use the arrow keys) to pick it; the picked box stays
   * highlighted, typing writes there, Backspace erases. Readings are typed normally (left to right);
   * rtl boxes (sums) fill from the right, hundredths first, like adding on paper.
   */
  function decimalBox(o) {
    const places = o.places, cols = places + 1, step = o.rtl ? -1 : 1;
    const box = el('div', 'dbox' + (o.small ? ' small' : ''));
    box.style.gridTemplateColumns = 'var(--cell) .45em var(--cell)' + (places === 2 ? ' var(--cell)' : '');
    if (o.heads !== false) {
      [['O', 'ones'], ['', ''], ['t', 'tenths'], ['h', 'hundredths']].slice(0, places + 2).forEach(([t, title]) => {
        const h = el('span', 'head', t);
        if (title) h.title = title;
        box.append(h);
      });
    }
    const input = el('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.inputMode = o.rtl ? 'numeric' : 'decimal';
    input.setAttribute('aria-label', o.label + (o.rtl ? '. Type the ' + (places === 2 ? 'hundredths' : 'tenths') + ' digit first.' : '') + ' Use the arrow keys to move between digits.');
    const PLACE = ['ones', 'tenths', 'hundredths'];
    const cells = [];
    let vals = new Array(cols).fill(''), cursor = o.rtl ? cols - 1 : 0, locked = false, typedLast = false, touched = false;
    const mk = i => {
      const c = el('span', 'cell');
      c.setAttribute('aria-hidden', 'true');
      c.addEventListener('pointerdown', e => {
        if (locked || input.disabled) return;
        e.preventDefault();
        cursor = i;
        typedLast = false;
        input.focus({ preventScroll: true });
        paint();
      });
      cells.push(c);
      return c;
    };
    box.append(mk(0), el('span', 'pt', '.'), mk(1));
    if (places === 2) box.append(mk(2));
    box.append(input);
    const SENT = ' ';   // keeps Backspace working on phone keyboards
    input.value = SENT;

    function paint() {
      const focused = document.activeElement === input && !input.disabled;
      cells.forEach((c, i) => {
        if (locked) return;
        c.textContent = vals[i];
        c.classList.remove('ghost');
        c.classList.toggle('cur', touched && i === cursor && !input.disabled);
        c.classList.toggle('live', focused && i === cursor);
      });
    }
    function changed() { input.value = SENT; paint(); if (o.onChange) o.onChange(); }
    function put(d) {
      if (cursor < 0 || cursor >= cols) return;
      vals[cursor] = d;
      typedLast = true;
      const nx = cursor + step;
      if (nx >= 0 && nx < cols) cursor = nx;
      else cursor = -9;   // past the last box: nothing highlighted until they pick one
    }
    // Backspace: right after typing, erase that digit; on a box you picked, erase it, then keep going back
    function back() {
      if (!typedLast && cursor >= 0 && cursor < cols && vals[cursor]) { vals[cursor] = ''; return; }
      typedLast = false;
      const prev = cursor === -9 ? (o.rtl ? 0 : cols - 1) : cursor - step;
      if (prev < 0 || prev >= cols) return;
      cursor = prev;
      vals[cursor] = '';
    }
    function typeText(text) {
      String(text).split('').forEach(ch => {
        if (/[0-9]/.test(ch)) put(ch);
        else if (ch === '.' || ch === ',') {
          if (o.rtl) { if (o.onDot) o.onDot(); }
          else cursor = 1;   // jump to the tenths
        }
      });
      changed();
    }
    function move(d) {
      typedLast = false;
      if (cursor === -9) cursor = o.rtl ? 0 : cols - 1;
      else cursor = Math.max(0, Math.min(cols - 1, cursor + d));
      paint();
    }
    input.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') { e.preventDefault(); if (o.onEnter) o.onEnter(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); move(1); return; }
      if (e.key === 'Home') { e.preventDefault(); cursor = 0; paint(); return; }
      if (e.key === 'End') { e.preventDefault(); cursor = cols - 1; paint(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); back(); changed(); return; }
      if (e.key === 'Delete') { e.preventDefault(); if (cursor >= 0 && cursor < cols) vals[cursor] = ''; changed(); return; }
      if (e.key.length === 1) { e.preventDefault(); typeText(e.key); }
    });
    // Phone keyboards often skip keydown, so catch the text here too
    input.addEventListener('beforeinput', e => {
      e.preventDefault();
      if (e.inputType.indexOf('delete') === 0) { back(); changed(); }
      else if (e.data) typeText(e.data);
    });
    input.addEventListener('input', () => { input.value = SENT; });
    input.addEventListener('focus', () => { touched = true; paint(); });
    input.addEventListener('blur', paint);
    box.addEventListener('pointerdown', e => {
      if (e.target === box && !locked && !input.disabled) { e.preventDefault(); input.focus({ preventScroll: true }); }
    });
    paint();

    const api = {
      el: box,
      input: input,
      value() {
        if (vals.every(v => v === '')) return null;
        return Number(vals[0] || 0) * 100 + Number(vals[1] || 0) * 10 + (places === 2 ? Number(vals[2] || 0) : 0);
      },
      filled() { return vals.filter(v => v !== '').length; },
      typed() {
        if (o.rtl) return (vals[0] || '0') + '.' + vals.slice(1).map(v => v || '0').join('');
        const t = vals[1] || '', h = vals[2] || '';
        if (!t && !h) return vals[0] || '0';
        return (vals[0] || '0') + '.' + (t || '0') + h;
      },
      // Show an answer (ok = theirs, shown = the game's). A tenth among hundredths gets a faint 0.
      set(h, cls) {
        const v = [String(onesOf(h)), String(tenthsOf(h)), String(hundOf(h))].slice(0, cols);
        cells.forEach((c, i) => {
          c.textContent = v[i];
          c.classList.remove('cur', 'live');
          c.classList.toggle('ghost', i === 2 && hundOf(h) === 0 && !o.noGhost);
        });
        vals = v.slice();
        locked = true;
        input.disabled = true;
        box.classList.remove('bad', 'off');
        if (cls) box.classList.add(cls);
      },
      clear() {
        vals = new Array(cols).fill('');
        cursor = o.rtl ? cols - 1 : 0;
        locked = false;
        box.classList.remove('ok', 'shown', 'bad');
        paint();
      },
      bad() { box.classList.remove('bad'); void box.offsetWidth; box.classList.add('bad'); },
      enable(on) { if (locked) return; input.disabled = !on; box.classList.toggle('off', !on); paint(); },
      focus() { if (!input.disabled) { input.focus({ preventScroll: true }); paint(); } },
      place: () => PLACE[cursor] || '',
    };
    return api;
  }

  // A number box for a fraction's top: 70 in 70/100
  function numInput(label, onEnter) {
    const i = el('input', 'num');
    i.type = 'text';
    i.inputMode = 'numeric';
    i.autocomplete = 'off';
    i.maxLength = 3;
    i.setAttribute('aria-label', label);
    i.addEventListener('input', () => { i.value = i.value.replace(/[^0-9]/g, '').slice(0, 3); });
    i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); onEnter(); } });
    return i;
  }
  function fracWithInput(input, den) {
    const f = el('span', 'sf');
    const t = el('span', 't');
    t.append(input);
    f.append(t, el('span', 'b', String(den)));
    return f;
  }
  function markInput(i, cls) {
    i.classList.remove('ok', 'bad', 'shown');
    void i.offsetWidth;
    if (cls) i.classList.add(cls);
  }

  // The sum (or difference) written on paper: helper row, two numbers, a rule, the answer.
  //   rows[i]: a length in hundredths, 'input' (the student writes it), or null (blank until picked)
  //   answer:  'input' (typed from the right), a length to show, or null for "?"
  //   helper:  'carry' (tap to write a 1) or 'scratch' (little boxes for regrouping when subtracting)
  function paperSum(opts) {
    const cols = opts.cols, places = cols - 1, op = opts.op || '+';
    const p = el('div', 'paper');
    if (opts.size) p.style.fontSize = opts.size;
    p.style.gridTemplateColumns = 'var(--op) var(--cell) .45em var(--cell)' + (places === 2 ? ' var(--cell)' : '');
    const cell = (cls, text) => { const c = el('span', cls, text); p.append(c); return c; };
    cell('', ''); cell('head', 'O'); cell('head', ''); cell('head', 't'); if (places === 2) cell('head', 'h');
    const carry = {}, scratch = [];
    if (opts.helper === 'carry') {
      const carryBox = (into, on) => {
        const c = el('button', 'carry' + (on ? ' on' : ''), on ? '1' : '');
        c.type = 'button';
        c.setAttribute('aria-label', 'Carry a 1 into the ' + into);
        c.setAttribute('aria-pressed', String(!!on));
        c.disabled = !!opts.still;
        c.addEventListener('click', () => {
          const now = c.textContent !== '1';
          c.textContent = now ? '1' : '';
          c.classList.toggle('on', now);
          c.setAttribute('aria-pressed', String(now));
          c.blur();
          if (opts.refocus) opts.refocus();
        });
        p.append(c);
        return c;
      };
      const pre = opts.showCarry || {};
      cell('', '');
      carry.o = carryBox('ones', pre.o);
      cell('', '');
      if (places === 2) { carry.t = carryBox('tenths', pre.t); cell('', ''); } else cell('', '');
    } else if (opts.helper === 'scratch') {
      cell('', '');
      const mkS = place => {
        const i = el('input', 'scr');
        i.type = 'text'; i.inputMode = 'numeric'; i.maxLength = 2; i.autocomplete = 'off';
        i.setAttribute('aria-label', 'Scratch space over the ' + place + ' (for regrouping)');
        i.addEventListener('input', () => { i.value = i.value.replace(/[^0-9]/g, '').slice(0, 2); });
        i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (opts.refocus) opts.refocus(); } });
        if (opts.still) i.disabled = true;
        p.append(i);
        scratch.push(i);
        return i;
      };
      mkS('ones'); cell('', ''); mkS('tenths'); if (places === 2) mkS('hundredths');
    }
    const rowBoxes = [null, null], rowCells = [null, null];
    function fillCells(cs, h) {
      const v = h == null ? ['?', '?', '?'] : [String(onesOf(h)), String(tenthsOf(h)), String(hundOf(h))];
      cs.forEach((c, i) => {
        c.textContent = v[i];
        c.className = 'c' + (h == null ? ' q' : '') + (h != null && i === 2 && hundOf(h) === 0 ? ' ghost' : '');   // 0.7 = 0.70
      });
    }
    [0, 1].forEach(r => {
      cell('op', r ? op : '');
      const spec = opts.rows[r];
      if (spec === 'input') {
        const bx = decimalBox({ places: places, heads: false, label: (r ? 'Second' : 'First') + ' height, in centimeters', onEnter: opts.onRowEnter, noGhost: false });
        bx.el.classList.add('inrow');
        p.append(bx.el);
        rowBoxes[r] = bx;
      } else {
        const cs = [cell('c', '')];
        cell('pt', '.');
        cs.push(cell('c', ''));
        if (places === 2) cs.push(cell('c', ''));
        rowCells[r] = cs;
        fillCells(cs, spec);
      }
    });
    const rule = el('span', 'rule');
    rule.style.gridColumn = '1 / -1';
    p.append(rule);
    cell('', '');
    let box = null, ans = [];
    if (opts.answer === 'input') {
      box = decimalBox({ places: places, rtl: true, heads: false, label: op === '+' ? 'The total height' : 'The missing height', onEnter: opts.onEnter, onDot: opts.onDot, onChange: opts.onChange });
      p.append(box.el);
    } else {
      ans = [cell('c q', '?'), cell('pt', '.'), cell('c q', '?')];
      if (places === 2) ans.push(cell('c q', '?'));
    }
    const key = el('p', 'key', 'O = ones, t = tenths' + (places === 2 ? ',\nh = hundredths' : ''));
    key.style.gridColumn = '1 / -1';
    p.append(key);
    function showAnswer(h, cls) {
      if (box) { box.set(h, cls || 'shown'); return; }
      const v = [String(onesOf(h)), '.', String(tenthsOf(h)), String(hundOf(h))];
      ans.forEach((c, i) => { c.textContent = v[i]; c.classList.remove('q'); });
    }
    if (typeof opts.answer === 'number') showAnswer(opts.answer);
    return {
      el: p, box: box, rows: rowBoxes, carry: carry, showAnswer: showAnswer,
      setRow(r, h) { if (rowCells[r]) fillCells(rowCells[r], h); else if (rowBoxes[r] && h != null) rowBoxes[r].set(h, 'shown'); },
      showCarries(x, y) {
        const c = carries(x, y);
        const set = (btn, on) => { if (!btn) return; btn.textContent = on ? '1' : ''; btn.classList.toggle('on', on); btn.disabled = true; };
        set(carry.t, places === 2 && c.c1);
        set(carry.o, places === 2 ? c.c2 : tenthsOf(x) + tenthsOf(y) >= 10);
      },
      lock() { Object.keys(carry).forEach(k => { carry[k].disabled = true; }); scratch.forEach(i => { i.disabled = true; }); },
    };
  }

  // A bug's card from the guest book
  function bugCard(bug, asFraction) {
    const c = el('div', 'bugcard');
    c.append(bugIcon(bug));
    const t = el('span');
    const len = el('span', 'len');
    if (asFraction) len.append(hFrac(bug.h, den10(bug.h) ? 10 : 100), document.createTextNode(' cm'));
    else len.textContent = dec(bug.h) + ' cm';
    t.append(el('span', 'who', bug.n + ' the ' + KINDS[bug.k].name), len);
    t.append(el('span', 'by', bug.by === 'you' ? '✓ You measured this one' : 'From the guest book'));
    c.append(t);
    return c;
  }

  /* ── Round state ── */

  let phase = 'idle', cur = null, results = [], round = null, tier = 1, used = [], usedPairs = [];
  let boomer = { made: 0, caught: 0 };

  function caption(text, tone) {
    const c = $('#caption');
    c.textContent = text;
    c.className = 'caption' + (tone ? ' ' + tone : '');
  }
  function controls(list) {
    const box = $('#controls');
    box.replaceChildren();
    list.forEach(b => {
      const btn = el('button', 'btn' + (b.soft ? ' btn-soft' : ''), b.label);
      btn.type = 'button';
      if (b.id) btn.id = b.id;
      btn.disabled = !!b.disabled;
      btn.addEventListener('click', () => { btn.blur(); b.on(); });
      box.append(btn);
    });
    const first = box.querySelector('button:not([disabled])');
    if (first && !list.some(b => b.noFocus)) first.focus();
    syncData();
  }
  function tip(text) { $('#tip').textContent = text || ''; }
  function work(...kids) { $('#workarea').replaceChildren(...kids); }

  const UNIT_WORD = { measure: 'Guest', stack: 'Stack', build: 'Heart' };
  function paintParty(hidden) {
    const box = $('#party');
    box.replaceChildren();
    box.style.visibility = hidden ? 'hidden' : '';
    const n = skill.minItems;
    box.append(el('span', 'count', UNIT_WORD[M.kind] + ' ' + Math.min(results.length + 1, n) + ' of ' + n));
    const slots = el('div', 'slots');
    for (let i = 0; i < n; i++) {
      const r = results[i];
      const s = el('span', 'slot' + (r ? (r.first ? ' first' : r.correct ? ' helped' : ' missed') : i === results.length ? ' now' : ''));
      if (r && r.bug) s.append(bugIcon(r.bug));
      slots.append(s);
    }
    box.append(slots);
  }

  function maxTier() {
    const m = session.mastery[skillId] || {};
    return M.kind === 'measure' && M.places === 2 && ((m.days || 0) >= 1 || m.status === 'mastered') ? 4 : 3;
  }
  function startTier() {
    const m = session.mastery[skillId] || {};
    return (m.days || 0) >= 1 || m.status === 'mastered' ? 2 : 1;
  }
  function startRound() {
    results = []; used = []; usedPairs = []; boomer = { made: 0, caught: 0 }; signHearts = 0;
    tier = startTier();
    round = MathRealm.startRound(GAME_ID, skillId);
    show('#play');
    drawBackdrop();
    sc.queue = 0;
    paintParty();
    nextProblem();
  }
  function nextProblem() {
    if (results.length >= skill.minItems) { endRound(); return; }
    tip('');
    paintParty();
    if (M.kind === 'measure') startMeasure();
    else if (M.kind === 'stack') startStack();
    else startBuild();
  }
  // One problem is done: record it once, then climb or ease the level.
  function finish(rec) {
    round.record({ prompt: rec.prompt, answer: rec.answer.slice(0, 60), correct: rec.correct, hintUsed: rec.hintUsed });
    const first = rec.correct && !rec.hintUsed;
    results.push({ first: first, correct: rec.correct, bug: rec.bug });
    if (first) tier = Math.min(maxTier(), tier + 1);
    else if (!rec.correct) tier = Math.max(1, tier - 1);
    paintParty();
    paintPartyCount();
    controls([{ label: results.length >= skill.minItems ? 'See the party' : nextLabel(), id: 'nextBtn', on: leaveAndNext }]);
  }
  function paintPartyCount() { const c = $('#party .count'); if (c) c.textContent = UNIT_WORD[M.kind] + ' ' + results.length + ' of ' + skill.minItems; }
  function nextLabel() { return M.kind === 'measure' ? 'Next guest' : M.kind === 'stack' ? 'Next stack' : 'Next heart'; }
  async function leaveAndNext() {
    phase = 'leaving';
    controls([]);
    hideBoomer();
    // the guests head into the party
    await Promise.all(actors.map(a => moveTo(a, 680, a.y, 700)));
    sc.queue++;
    nextProblem();
  }
  const PRAISE = ['Yes!', 'Nailed it!', 'Groovy!', 'Right on!', 'Perfect!'];

  /* ── Measuring ── */

  function measureClaim(h) {
    const opts = [];
    if (M.places === 1) {
      if (h > 100) opts.push({ v: h / 10, why: 'He counted ' + (h / 10) + ' spaces, but ' + (h / 10) + ' tenths is 1 whole and ' + (h / 10 - 10) + ' tenths, not ' + dec2(h / 10) + '.' });
      else opts.push({ v: h / 10, why: 'He wrote ' + (h / 10) + ' hundredths, but each space on this tape is a tenth.' });
      opts.push({ v: h + 10, why: 'He counted the marks instead of the spaces, so he got one tenth too many.' });
    } else {
      const t = Math.floor(h / 10) * 10, d = hundOf(h);
      if (h > 100 && h < 110) opts.push({ v: 100 + d * 10, why: dec(100 + d * 10) + ' would be ' + d + ' tenths past 1, but the pointer is only ' + d + ' hundredths past 1.' });
      if (d) opts.push({ v: t, why: 'He stopped at ' + dec(t) + ' and forgot the hundredths.' });
      opts.push({ v: h + 1, why: 'He counted the marks instead of the spaces, so he got one hundredth too many.' });
      if (d > 1) opts.push({ v: h - 1, why: 'He counted one hundredth too few.' });
    }
    return Math.random() < 0.6 ? opts[0] : pick(opts);
  }
  function labelStep() { return M.places === 2 ? 10 : sc.tape.labels === 'half' ? 50 : 100; }
  function scaleWords() {
    if (M.places === 1) return 'Each small space on this tape is one tenth of a centimeter (0.1 cm), because 10 spaces make 1 cm.';
    const f = sc.lens.from;
    return 'In the magnifier, the tenth from ' + dec(f) + ' to ' + dec(f + 10) + ' is split into 10 tiny spaces, so each tiny space is one hundredth of a centimeter (0.01 cm).';
  }
  function whereWords(h) {
    if (M.places === 2) {
      const f = sc.lens.from;
      return h === f + 10 ? 'The pointer is right on a labeled mark in the magnifier.' : 'The pointer is past ' + dec(f) + '. Count the tiny spaces up from ' + dec(f) + '.';
    }
    const base = Math.floor(h / labelStep()) * labelStep();
    return 'The pointer is between ' + dec(base) + ' and ' + dec(base + labelStep()) + '. Count the spaces up from ' + dec(base) + '.';
  }
  function measureHintMarks() {
    if (M.places === 2) {
      sc.lens.hideLabels = false;
      const f = sc.lens.from;
      sc.marks = [{ h: f, where: 'lens' }];
      sc.jumps = { from: f, to: f + 1, step: 1, where: 'lens', text: '0.01' };
    } else {
      const base = Math.floor(cur.h / labelStep()) * labelStep();
      sc.marks = [{ h: base, where: 'tape' }];
      sc.jumps = { from: base, to: base + 10, step: 10, where: 'tape', text: '0.1 cm' };
    }
    renderLens();
    renderOver();
  }
  function measureFeedback(v) {
    const h = cur.h, sp = M.places === 2 ? '0.01' : '0.1';
    if (v > M.range * 100 + 40) return 'You wrote ' + dec(v) + ' cm. That would be taller than this whole tape! Each small space is only ' + sp + ' cm.';
    if (M.places === 1) {
      if (Math.abs(v - h) === 10) return 'So close, just one space off! Count the spaces between the marks, not the marks themselves. ' + whereWords(h);
      if (v === h / 10) return 'You wrote ' + dec2(v) + ' cm, which is ' + v + ' hundredths. Each space on this tape is a tenth. ' + whereWords(h);
      if (h > 100 && v === h - 100) return 'You found the tenths, but the pointer is past the 1 cm mark. Don\'t forget the whole centimeter!';
    } else {
      const t = Math.floor(h / 10) * 10, d = hundOf(h);
      if (d && v === t) return 'You found the tenth, ' + dec(t) + '. The pointer is a little past it, so there are some hundredths too. Count the tiny spaces in the magnifier.';
      if (h > 100 && h < 110 && v === 100 + d * 10) return 'You wrote ' + dec(v) + ' cm. That would be ' + d + ' tenths past 1: ' + d + ' big spaces on the tape. The pointer is only ' + d + ' tiny spaces past 1, and each tiny space is one hundredth.';
      if (Math.abs(v - h) === 1) return 'So close, just one tiny space off! Count the spaces between the marks, not the marks themselves. ' + whereWords(h);
      if (h > 100 && v === h - 100) return 'You found the tenths and hundredths, but the bug is taller than 1 cm. Don\'t forget the whole centimeter!';
      if (d && v === d * 10 + tenthsOf(h) + onesOf(h) * 100) return 'Check the order of the digits: tenths come right after the decimal point, then hundredths.';
    }
    return 'Not quite. ' + scaleWords() + ' ' + whereWords(h);
  }
  function measureExplain() {
    const h = cur.h, nm = cur.bug.n;
    if (M.places === 1) {
      const st = labelStep(), base = Math.floor(h / st) * st, above = base + st;
      const down = above - h <= 20 && h - base >= 60;
      const from = down ? above : base, n = Math.abs(h - from) / 10;
      sc.jumps = { from: from, to: h, step: 10, where: 'tape' };
      sc.marks = [{ h: from, where: 'tape' }];
      const steps = [];
      for (let k = 1; k <= n; k++) steps.push(dec(from + (down ? -k : k) * 10));
      return nm + ' is ' + dec(h) + ' cm tall. Start at ' + dec(from) + ' and count ' + (down ? 'down ' : 'up ') + n + (n === 1 ? ' space' : ' spaces') +
        (n <= 5 ? ': ' + steps.join(', ') : ' to ' + dec(h)) + '. That\'s ' + fracText(h, 10) + ' cm.';
    }
    const f = sc.lens.from;
    sc.lens.hideLabels = false;
    const down = f + 10 - h <= 3 && h - f > 5;
    const from = down ? f + 10 : f, n = Math.abs(h - from);
    sc.jumps = n ? { from: from, to: h, step: 1, where: 'lens' } : null;
    sc.marks = [{ h: from, where: 'lens' }];
    if (!n) return nm + ' is right on the ' + dec(h) + ' mark: ' + dec(h) + ' cm, which is the same as ' + dec2(h) + ' cm (' + fracText(h, 100) + ' cm).';
    const steps = [];
    for (let k = 1; k <= n; k++) steps.push(dec2(from + (down ? -k : k)));
    return nm + ' is ' + dec(h) + ' cm tall. In the magnifier, start at ' + dec(from) + ' and count ' + (down ? 'down ' : 'up ') + n + (n === 1 ? ' tiny space' : ' tiny spaces') +
      (n <= 4 ? ': ' + steps.join(', ') : ': ' + steps[0] + ', ' + steps[1] + ', … ' + steps[n - 1]) + '. That\'s ' + fracText(h, 100) + ' cm.';
  }
  function measureEquals(h) {
    const box = el('div', 'equals');
    box.append(el('span', '', dec(h) + ' cm'), el('span', '', '='));
    if (M.places === 2 && den10(h)) box.append(el('span', '', dec2(h) + ' cm'), el('span', '', '='));
    box.append(hFrac(h, M.places === 1 ? 10 : 100), el('span', 'word', 'cm'));
    return box;
  }

  async function startMeasure() {
    phase = 'walking';
    const p = makeMeasure(tier, used);
    cur = Object.assign(p, { kind: 'measure', answer: p.h, tries: 0, helped: false, typed: [], claim: null });
    sc.tape = Object.assign({ fog: false }, p.tape);
    sc.lens = M.places === 2 ? { from: den10(p.h) ? p.h - 10 : Math.floor(p.h / 10) * 10, hideLabels: !!p.tape.hideLens } : null;
    sc.band = sc.lens ? [sc.lens.from, sc.lens.from + 10] : null;
    sc.pointer = null; sc.jumps = null; sc.marks = []; sc.heart = null;
    clearActors();
    hideBoomer();
    drawQueue(skill.minItems - results.length - 1);
    redraw();
    stage.setAttribute('aria-label', cur.bug.n + ' the ' + KINDS[cur.bug.k].name + ' stands next to the measuring tape. A pointer marks the top of the bug\'s head.');

    cur.box = decimalBox({ places: M.places, label: 'Height in centimeters', onEnter: checkMeasure });
    cur.box.enable(false);
    const say = el('div', 'say');
    say.append(el('span', '', cur.bug.n + ' is'), cur.box.el, el('span', 'unit', 'cm'), el('span', '', 'tall.'));
    cur.equals = el('div', 'equals');
    cur.note = el('div', 'note');
    work(say, cur.equals, cur.note);
    caption('Here comes ' + cur.bug.n + ' the ' + KINDS[cur.bug.k].name + '!');
    controls([{ label: 'Check', id: 'checkBtn', disabled: true, on: () => {} }, { label: 'Hint', soft: true, disabled: true, on: () => {} }]);

    const a = actor(cur.bug);
    place(a, -100, V.FLOOR);
    await moveTo(a, V.BX, V.FLOOR, 1000);
    cur.actor = a;
    sc.pointer = { h: cur.h };
    redraw();

    if (tier >= 2 && results.length >= 2 && Math.random() < 0.4) {
      cur.claim = Math.random() < 0.7 ? measureClaim(cur.h) : { v: cur.h, right: true };
      boomer.made += cur.claim.right ? 0 : 1;
      showBoomer(dec(cur.claim.v));
      const b = el('div', 'bubble');
      b.append(document.createTextNode('Boomer wrote '), el('b', '', dec(cur.claim.v) + ' cm'), document.createTextNode('. Is he right?'));
      cur.note.append(boomerIcon(null), b);
      caption('Boomer the bouncer already wrote ' + cur.bug.n + '\'s badge: ' + dec(cur.claim.v) + ' cm. Read the tape yourself. How tall is ' + cur.bug.n + '?', 'boomer');
    } else {
      caption(sc.lens && sc.lens.hideLabels
        ? 'The magnifier has no numbers now! Use the big tape to find which tenth it shows (the blue part). How tall is ' + cur.bug.n + '?'
        : 'Read the tape where the pointer touches it. How tall is ' + cur.bug.n + '?');
    }
    tip(M.places === 2 ? 'Count the hundredths in the magnifier. Press Enter to check.' : 'Type the height, then press Enter.');
    phase = 'answer';
    cur.box.enable(true);
    controls([{ label: 'Check', id: 'checkBtn', noFocus: true, on: checkMeasure }, { label: 'Hint', soft: true, id: 'hintBtn', noFocus: true, on: measureHint }]);
    cur.box.focus();
    round.shown();
    syncData();
  }

  function measureHint() {
    if (phase !== 'answer') return;
    cur.helped = true;
    measureHintMarks();
    caption('Hint: ' + scaleWords() + ' ' + whereWords(cur.h));
    const hb = $('#hintBtn');
    if (hb) hb.disabled = true;
    cur.box.focus();
  }

  function checkMeasure() {
    if (phase !== 'answer') return;
    const v = cur.box.value();
    if (v === null) { tip('Type the height in the boxes first.'); cur.box.focus(); return; }
    tip('');
    cur.typed.push(cur.box.typed());
    const h = cur.h;
    if (v === h) {
      phase = 'shown';
      cur.box.set(h, 'ok');
      cur.equals.replaceWith(cur.equals = measureEquals(h));
      sc.pointer.text = dec(h) + ' cm';
      sc.jumps = null; sc.marks = [];
      redraw();
      dance(cur.actor);
      RealmFX.correct();
      let msg = (cur.tries ? 'You got it! ' : pick(PRAISE) + ' ') + cur.bug.n + ' is ' + dec(h) + ' cm tall.';
      if (M.places === 2 && den10(h)) msg += ' ' + dec(h) + ' is the same as ' + dec2(h) + '.';
      msg += boomerVerdict(true);
      caption(msg, 'good');
      remember(cur.bug, true);
      finish({ prompt: 'Measure ' + dec(h) + ' cm', answer: cur.typed.join(' → '), correct: true, hintUsed: cur.helped || cur.tries > 0, bug: cur.bug });
      return;
    }
    RealmFX.wrong();
    cur.box.bad();
    cur.tries++;
    if (cur.tries === 1) {
      measureHintMarks();
      caption(measureFeedback(v) + ' Try again!', 'bad');
      cur.box.clear();
      cur.box.focus();
      return;
    }
    phase = 'shown';
    const why = measureExplain();
    cur.box.set(h, 'shown');
    cur.equals.replaceWith(cur.equals = measureEquals(h));
    sc.pointer.text = dec(h) + ' cm';
    redraw();
    caption(why + boomerVerdict(false), 'bad');
    remember(cur.bug, false);
    finish({ prompt: 'Measure ' + dec(h) + ' cm', answer: cur.typed.join(' → '), correct: false, hintUsed: true, bug: cur.bug });
  }

  // What happened with Boomer's badge (said after the answer)
  function boomerVerdict(right) {
    const c = cur.claim;
    if (!c) return '';
    hideBoomer();
    if (c.right) return ' Boomer got this one right!';
    const fooled = cur.typed.some(t => Math.round(Number(t) * 100) === c.v);
    if (right && !fooled) {
      boomer.caught++;
      lightSign();
      RealmFX.fanfare();
      return ' You caught Boomer\'s mistake! ' + c.why;
    }
    return ' Boomer was wrong too: ' + c.why.charAt(0).toLowerCase() + c.why.slice(1);
  }

  /* ── Stacking: add the two heights on paper ──
   * Every stack is added on paper, with the decimal points lined up and tap-to-carry boxes.
   * Scaffolds come off as the student succeeds (LEVEL_UP first-try stacks per level) and come back
   * after two misses in a row:
   *   1  both heights are on the paper; type the total, hundredths first
   *   2  then write the total as a fraction: 70/100 + 45/100 = ?/100
   *   3  then write all three fractions
   *   4  the paper is blank: copy the heights from the guest book into the right places first
   *   5  the guest book shows fractions (6/10, 55/100): write them as decimals, add, write the total fraction
   * Fractions sit beside every sum because adding tenths and hundredths as fractions is 4th grade
   * (4.NF.5, 4.NF.3); adding decimals as decimals is 5th grade (5.NBT.7).
   */
  const LEVEL_UP = 4;
  const LEVEL_NEWS = {
    2: 'New challenge! After you add, write the total as a fraction too.',
    3: 'New challenge! Now you write all the fractions.',
    4: 'New challenge! Copy the heights onto the paper yourself. Line up the decimal points!',
    5: 'New challenge! The guest book shows fractions now. Write them as decimals on the paper.',
  };
  let levelNews = '';
  function stackLevel() { const s = memory.stack || {}; return clamp(Number(s.lvl) || 1, 1, 5); }
  function levelAfter(first, right) {
    const s = memory.stack = Object.assign({ lvl: 1, wins: 0, miss: 0 }, memory.stack || {});
    if (first) {
      s.miss = 0;
      if (++s.wins >= LEVEL_UP && s.lvl < 5) { s.lvl++; s.wins = 0; levelNews = LEVEL_NEWS[s.lvl]; }
    } else if (!right) {
      if (++s.miss >= 2 && s.lvl > 1) { s.lvl--; s.wins = 0; s.miss = 0; }
    } else s.miss = 0;
  }
  const colsFor = (a, b) => den10(a) && den10(b) ? 2 : 3;
  function noCarrySum(a, b) {
    return (onesOf(a) + onesOf(b)) * 100 + ((tenthsOf(a) + tenthsOf(b)) % 10) * 10 + (hundOf(a) + hundOf(b)) % 10;
  }
  // As fractions: 70/100 + 45/100 = 115/100 = 1 15/100. ask: 'total' or 'all' puts boxes in the tops.
  function fracAsk(a, b, total, o) {
    o = o || {};
    const op = o.op || '+';
    const den = o.den || (a != null && b != null && colsFor(a, b) === 2 ? 10 : 100), n = h => den === 10 ? h / 10 : h;
    const box = el('div', 'fr'), inputs = [];
    box.append(el('span', 'word', o.word || 'As fractions:'));
    const part = (h, ask, label) => {
      if (ask) {
        const i = numInput(label, o.onEnter || (() => {}));
        i.disabled = true;
        inputs.push({ input: i, answer: n(h) });
        return fracWithInput(i, den);
      }
      if (h == null) return document.createTextNode('?');
      return hFrac(h, den, true);
    };
    const all = o.ask === 'all';
    box.append(part(a, all, 'First height as a fraction'), document.createTextNode(op), part(b, all, 'Second height as a fraction'), document.createTextNode('='));
    if (o.ask) box.append(part(total, true, (op === '+' ? 'The total' : 'The difference') + ' in ' + (den === 10 ? 'tenths' : 'hundredths')));
    else if (total == null) box.append(document.createTextNode('?'));
    else {
      box.append(hFrac(total, den, true));
      if (total >= 100) box.append(document.createTextNode('='), hFrac(total, den));
    }
    return { el: box, inputs: inputs };
  }
  const fracLine = (a, b, total, op) => fracAsk(a, b, total, { op: op }).el;

  function stackClaim(a, b) {
    const t = a + b, opts = [];
    if (den10(a) !== den10(b)) {
      const tt = den10(a) ? a : b, hh = den10(a) ? b : a, v = tt / 10 + hh;
      if (v !== t) opts.push({ v: v, why: 'He lined up the digits on the right instead of the decimal points, as if ' + dec(tt) + ' were ' + dec2(tt / 10) + '.' });
    }
    const nc = noCarrySum(a, b);
    if (nc !== t) opts.push({ v: nc, why: 'He forgot to regroup. 10 hundredths make 1 tenth, and 10 tenths make 1 whole.' });
    if (den10(a) && den10(b) && t >= 100) opts.push({ v: t / 10, why: (t / 10) + ' tenths is 1 whole and ' + (t / 10 - 10) + ' tenths, not ' + dec2(t / 10) + '.' });
    opts.push({ v: t + 10, why: 'He added one tenth too many.' });
    return Math.random() < 0.5 ? opts[0] : pick(opts);
  }

  // What went wrong in a sum a + b when the student wrote v
  function sumFeedback(a, b, v) {
    const t = a + b, c = carries(a, b), cols = colsFor(a, b);
    if (den10(a) !== den10(b)) {
      const tt = den10(a) ? a : b, hh = den10(a) ? b : a;
      if (v === tt / 10 + hh) return 'Line up the decimal points! ' + dec(tt) + ' is ' + (tt / 10) + ' tenths, the same as ' + tt + ' hundredths (' + dec2(tt) + ').';
    }
    if (den10(a) && den10(b) && t >= 100 && v === t / 10) return (a / 10) + ' tenths + ' + (b / 10) + ' tenths = ' + (t / 10) + ' tenths. That\'s 1 whole and ' + (t / 10 - 10) + ' tenths, so write a 1 in the ones place.';
    if (v === noCarrySum(a, b) && (c.c1 || c.c2)) {
      if (cols === 3 && c.c1) { const s = hundOf(a) + hundOf(b); return 'Check your regrouping. In the hundredths, ' + hundOf(a) + ' + ' + hundOf(b) + ' = ' + s + '. That\'s 1 tenth and ' + (s - 10) + ' hundredths: write ' + (s - 10) + ' and carry 1 to the tenths.'; }
      const s = tenthsOf(a) + tenthsOf(b) + (c.c1 ? 1 : 0);
      return 'Check your regrouping. In the tenths, ' + s + ' tenths is 1 whole and ' + (s - 10) + ' tenths: write ' + (s - 10) + ' and carry 1 to the ones.';
    }
    const want = String(cols === 2 ? t / 10 : t).padStart(cols, '0'), got = String(cols === 2 ? Math.floor(v / 10) : v).padStart(cols, '0');
    if (got.split('').reverse().join('') === want && got !== want) return 'It looks like you typed from the left. In a sum, start on the right: type the ' + (cols === 3 ? 'hundredths' : 'tenths') + ' digit first.';
    return 'Add one column at a time, starting on the right. Remember: 10 hundredths make 1 tenth, and 10 tenths make 1 whole.';
  }
  function sumExplain(a, b) {
    const t = a + b, cols = colsFor(a, b), parts = [];
    let carry = 0;
    if (cols === 3) {
      const s = hundOf(a) + hundOf(b);
      parts.push('Hundredths: ' + hundOf(a) + ' + ' + hundOf(b) + ' = ' + s + (s >= 10 ? ', so write ' + (s - 10) + ' and carry 1.' : '.'));
      carry = s >= 10 ? 1 : 0;
    }
    const s2 = tenthsOf(a) + tenthsOf(b) + carry;
    parts.push('Tenths: ' + tenthsOf(a) + ' + ' + tenthsOf(b) + (carry ? ' + 1' : '') + ' = ' + s2 + (s2 >= 10 ? ', so write ' + (s2 - 10) + ' and carry 1.' : '.'));
    parts.push('Ones: ' + (onesOf(a) + onesOf(b) + (s2 >= 10 ? 1 : 0)) + '.');
    return dec(a) + ' + ' + dec(b) + ' = ' + dec(t) + '. ' + parts.join(' ');
  }
  function placeWords(h) {
    const o = onesOf(h), t = tenthsOf(h), u = hundOf(h);
    return dec(h) + ' has ' + o + (o === 1 ? ' one, ' : ' ones, ') + t + (t === 1 ? ' tenth' : ' tenths') + (u ? ' and ' + u + (u === 1 ? ' hundredth' : ' hundredths') : '') + '.';
  }
  const asFrac = h => fracText(h, den10(h) ? 10 : 100);

  async function startStack() {
    phase = 'walking';
    const [A, B] = makePair(tier, usedPairs);
    const total = A.h + B.h, lvl = stackLevel();
    const ask = lvl === 1 ? '' : lvl === 3 || lvl === 4 ? 'all' : 'total';
    cur = { kind: 'stack', a: A.h, b: B.h, A: A, B: B, answer: total, lvl: lvl, ask: ask, tries: 0, helped: false, typed: [], claim: null, missed: false, retried: false };
    const parts = [];
    if (lvl >= 4) parts.push({ k: 'rows', tries: 0 });
    parts.push({ k: 'sum', tries: 0 });
    if (ask) parts.push({ k: 'fracs', tries: 0 });
    cur.parts = parts;
    cur.pi = 0;
    sc.tape = { labels: 'whole', fog: true };
    sc.lens = null; sc.band = null; sc.pointer = null; sc.jumps = null; sc.marks = []; sc.heart = null;
    clearActors();
    hideBoomer();
    redraw();
    stage.setAttribute('aria-label', B.n + ' is standing on ' + A.n + '\'s head. The measuring tape is foggy.');

    const cards = el('div', 'cards');
    cards.append(bugCard(A, lvl === 5), bugCard(B, lvl === 5));
    const cols = colsFor(A.h, B.h);
    cur.paper = paperSum({ cols: cols, rows: lvl >= 4 ? ['input', 'input'] : [A.h, B.h], answer: 'input', helper: 'carry', size: '1.5rem',
      onEnter: checkPart, onRowEnter: checkPart, refocus: focusPart,
      onDot: () => tip('No need to type the decimal point. It\'s already there! Start with the ' + (cols === 3 ? 'hundredths' : 'tenths') + ' digit.') });
    cur.paper.box.enable(false);
    cur.paper.rows.forEach(r => { if (r) r.enable(false); });
    cur.side = el('div', 'side');
    if (lvl < 5) paintFracs();
    const row = el('div', 'mathrow');
    row.append(cur.paper.el, cur.side);
    work(cards, row);
    caption(B.n + ' climbs onto ' + A.n + ' to see the band!');
    controls([{ label: 'Check', disabled: true, on: () => {} }, { label: 'Hint', soft: true, disabled: true, on: () => {} }]);

    const a1 = actor(A), a2 = actor(B);
    place(a1, -100, V.FLOOR);
    place(a2, -100, V.FLOOR);
    await moveTo(a1, V.BX, V.FLOOR, 900);
    await moveTo(a2, V.BX - 120, V.FLOOR, 600);
    await moveTo(a2, V.BX, yOf(A.h), 600, true);
    cur.actors = [a1, a2];
    sc.pointer = { h: total, text: '? cm', fill: '#EFE7FF' };
    redraw();
    if (lvl <= 3 && tier >= 2 && results.length >= 2 && Math.random() < 0.4) {
      cur.claim = Math.random() < 0.7 ? stackClaim(A.h, B.h) : { v: total, right: true };
      boomer.made += cur.claim.right ? 0 : 1;
      showBoomer(dec(cur.claim.v));
    }
    phase = 'answer';
    round.shown();
    startPart(true);
  }
  function paintFracs() {
    const f = fracAsk(cur.a, cur.b, cur.ask ? cur.answer : null, { ask: cur.ask, onEnter: checkPart });
    cur.fr = f;
    cur.side.replaceChildren(f.el);
  }
  function focusPart() {
    const p = cur.parts[cur.pi];
    if (!p) return;
    if (p.k === 'rows') { const r = cur.paper.rows.find(x => x && x.value() === null) || cur.paper.rows[0]; r.focus(); }
    else if (p.k === 'sum') cur.paper.box.focus();
    else { const i = cur.fr.inputs.find(x => !x.input.disabled && !x.input.value) || cur.fr.inputs.find(x => !x.input.disabled); if (i) i.input.focus(); }
  }
  function partWords(p, first) {
    const A = cur.A, B = cur.B, cols = colsFor(cur.a, cur.b);
    if (p.k === 'rows') return cur.lvl === 5
      ? 'The tape is foggy! The guest book gives the heights as fractions: ' + asFrac(A.h) + ' cm and ' + asFrac(B.h) + ' cm. Write them as decimals on the paper. Line up the decimal points!'
      : 'The tape is foggy! Copy the heights onto the paper: ' + A.n + ' is ' + dec(A.h) + ' cm, and ' + B.n + ' is ' + dec(B.h) + ' cm. Put each digit under its place.';
    if (p.k === 'sum') {
      const start = cur.claim ? 'Boomer says the stack is ' + dec(cur.claim.v) + ' cm tall. Is he right? ' : first ? 'The tape is foggy! How tall is the stack? ' : 'Now add. ';
      return start + 'Add ' + dec(cur.a) + ' + ' + dec(cur.b) + ' on paper, starting with the ' + (cols === 3 ? 'hundredths' : 'tenths') + '.';
    }
    return cur.ask === 'all' ? 'Now write the stack as fractions. Fill in the tops.' : 'Now write the total as a fraction. Fill in the top.';
  }
  function startPart(first) {
    const p = cur.parts[cur.pi];
    const rows = cur.paper.rows.filter(Boolean);
    rows.forEach(r => r.enable(p.k === 'rows'));
    cur.paper.box.enable(p.k === 'sum');
    if (cur.fr) cur.fr.inputs.forEach(x => { if (!x.input.classList.contains('ok') && !x.input.classList.contains('shown')) x.input.disabled = p.k !== 'fracs'; });
    if (p.k === 'sum' && cur.lvl === 5 && !cur.fr) paintFracs();
    if (p.k === 'fracs' && cur.fr) cur.fr.inputs.forEach(x => { x.input.disabled = false; });
    const news = first && levelNews ? levelNews + ' ' : '';
    if (first) levelNews = '';
    caption(news + partWords(p, first), cur.claim && p.k === 'sum' ? 'boomer' : '');
    tip(p.k === 'sum' ? 'Type the ' + (colsFor(cur.a, cur.b) === 3 ? 'hundredths' : 'tenths') + ' digit first. Tap a carry box to write a 1.'
      : p.k === 'rows' ? 'Click a box to pick it. Use Tab to move to the next height.' : 'Type each top number, then press Enter.');
    controls([{ label: 'Check', id: 'checkBtn', noFocus: true, on: checkPart }, { label: 'Hint', soft: true, id: 'hintBtn', noFocus: true, disabled: p.hinted, on: stackHint }]);
    focusPart();
    syncData();
  }
  function stackHint() {
    if (phase !== 'answer') return;
    const p = cur.parts[cur.pi];
    cur.helped = true;
    p.hinted = true;
    let t;
    if (p.k === 'rows') t = cur.lvl === 5
      ? (den10(cur.a) ? cur.a / 10 + '/10 is ' + (cur.a / 10) + ' tenths' : cur.a + '/100 is ' + cur.a + ' hundredths') + ', so it\'s written ' + dec(cur.a) + '. Each digit goes under its place: O, t, h.'
      : 'Line up the decimal points. ' + placeWords(cur.a) + ' Put each digit under O, t or h.';
    else if (p.k === 'sum') {
      t = 'Add one column at a time, starting on the right. ';
      if (den10(cur.a) !== den10(cur.b)) t += dec(den10(cur.a) ? cur.a : cur.b) + ' has no hundredths, so think of it as ' + dec2(den10(cur.a) ? cur.a : cur.b) + '. ';
      t += '10 hundredths make 1 tenth, and 10 tenths make 1 whole.';
    } else t = fracWords(true);
    caption('Hint: ' + t);
    const hb = $('#hintBtn');
    if (hb) hb.disabled = true;
    focusPart();
  }
  function fracWords(gentle) {
    const a = cur.a, b = cur.b, t = a + b, den = colsFor(a, b) === 2 ? 10 : 100, n = h => den === 10 ? h / 10 : h;
    const conv = [a, b].filter(h => den === 100 && den10(h)).map(h => dec(h) + ' = ' + h + '/100');
    if (gentle) return (conv.length ? 'Each tenth is 10 hundredths, so ' + conv.join(' and ') + '. ' : '') + 'Then add the tops: ' + n(a) + ' + ' + n(b) + '. The bottom stays ' + den + '.';
    return n(a) + '/' + den + ' + ' + n(b) + '/' + den + ' = ' + n(t) + '/' + den + '.';
  }
  function checkPart() {
    if (phase !== 'answer' || cur.kind !== 'stack') return;
    const p = cur.parts[cur.pi];
    if (p.k === 'rows') {
      const r = cur.paper.rows, v = r.map(x => x.value());
      if (v.some(x => x === null)) { tip('Write both heights on the paper first.'); focusPart(); return; }
      cur.typed.push(r[0].typed() + '+' + r[1].typed());
      const want = [cur.a, cur.b], ok = v.map((x, i) => x === want[i]);
      if (ok[0] && ok[1]) { RealmFX.correct(); r.forEach((x, i) => x.set(want[i], 'ok')); return partDone(p); }
      RealmFX.wrong();
      p.tries++;
      const i = ok[0] ? 1 : 0, h = want[i], wrong = v[i];
      if (p.tries === 1) {
        r.forEach((x, k) => { if (!ok[k]) { x.bad(); x.clear(); } });
        let why = placeWords(h);
        if (wrong * 10 === h) why = 'You wrote ' + dec2(wrong) + ', which is ' + wrong + ' hundredths. ' + why;
        caption('Check ' + [cur.A, cur.B][i].n + '\'s height' + (cur.lvl === 5 ? ' (' + asFrac(h) + ' cm)' : '') + '. ' + why + ' Try again!', 'bad');
        focusPart();
        return;
      }
      cur.missed = true;
      r.forEach((x, k) => x.set(want[k], ok[k] ? 'ok' : 'shown'));
      caption('Here are the heights, lined up: ' + dec(cur.a) + ' and ' + dec(cur.b) + '. ' + placeWords(h), 'bad');
      return partDone(p, true);
    }
    if (p.k === 'sum') {
      const box = cur.paper.box, cols = colsFor(cur.a, cur.b), v = box.value();
      if (v === null || box.filled() < cols - 1) { tip('Fill in each column, starting with the ' + (cols === 3 ? 'hundredths' : 'tenths') + '.'); box.focus(); return; }
      tip('');
      cur.typed.push(box.typed());
      if (v === cur.answer) { RealmFX.correct(); box.set(cur.answer, 'ok'); cur.paper.lock(); return partDone(p); }
      RealmFX.wrong();
      box.bad();
      p.tries++;
      if (p.tries === 1) { caption(sumFeedback(cur.a, cur.b, v) + ' Try again!', 'bad'); box.clear(); box.focus(); return; }
      cur.missed = true;
      box.set(cur.answer, 'shown');
      cur.paper.showCarries(cur.a, cur.b);
      caption('The stack is ' + dec(cur.answer) + ' cm. ' + sumExplain(cur.a, cur.b), 'bad');
      return partDone(p, true);
    }
    // fractions
    const list = cur.fr.inputs;
    if (list.some(x => x.input.value === '')) { tip('Fill in every top number first.'); focusPart(); return; }
    cur.typed.push(list.map(x => x.input.value).join('/'));
    const ok = list.map(x => Number(x.input.value) === x.answer);
    if (ok.every(Boolean)) { RealmFX.correct(); list.forEach(x => { markInput(x.input, 'ok'); x.input.disabled = true; }); return partDone(p); }
    RealmFX.wrong();
    p.tries++;
    if (p.tries === 1) {
      list.forEach((x, i) => { if (!ok[i]) { markInput(x.input, 'bad'); x.input.value = ''; } else { markInput(x.input, 'ok'); x.input.disabled = true; } });
      caption('Not quite. ' + fracWords(true) + ' Try again!', 'bad');
      focusPart();
      return;
    }
    cur.missed = true;
    list.forEach((x, i) => { x.input.value = String(x.answer); markInput(x.input, ok[i] ? 'ok' : 'shown'); x.input.disabled = true; });
    caption(fracWords(false), 'bad');
    partDone(p, true);
  }
  function partDone(p, shown) {
    if (p.tries > 0) cur.retried = true;
    cur.pi++;
    if (cur.pi < cur.parts.length) {
      if (!shown) {
        startPart(false);
        const c = $('#caption');
        caption('Yes! ' + c.textContent, 'good');
      } else {
        const why = $('#caption').textContent;
        startPart(false);
        caption(why + ' ' + partWords(cur.parts[cur.pi], false), 'bad');
      }
      return;
    }
    stackSolved(!cur.missed);
  }
  function stackSolved(right) {
    phase = 'shown';
    const a = cur.a, b = cur.b, t = a + b;
    cur.paper.lock();
    if (!cur.ask) cur.side.replaceChildren(fracLine(a, b, t));
    else { const tail = el('div', 'fr'); if (t >= 100) { tail.append(document.createTextNode('= '), hFrac(t, colsFor(a, b) === 2 ? 10 : 100)); cur.side.append(tail); } }
    clearFog();
    sc.pointer = { h: t, text: dec(t) + ' cm' };
    renderOver();
    const helped = cur.helped || cur.retried;
    if (right) {
      RealmFX.correct();
      cur.actors.forEach(x => dance(x));
      caption((helped ? 'You got it! ' : pick(PRAISE) + ' ') + dec(a) + ' + ' + dec(b) + ' = ' + dec(t) + ' cm' + (cur.claim && !cur.claim.right ? '.' : '. The fog clears, and the tape agrees!') + boomerVerdict(true), 'good');
    } else {
      caption($('#caption').textContent + ' The fog clears: the stack is ' + dec(t) + ' cm.' + boomerVerdict(false), 'bad');
    }
    levelAfter(right && !helped, right);
    remember(cur.A, false);
    remember(cur.B, false);
    finish({ prompt: dec(a) + ' + ' + dec(b) + ' (level ' + cur.lvl + ')', answer: cur.typed.join(' → '), correct: right, hintUsed: !right || helped, bug: cur.B });
  }

  /* ── Building: reach the heart ──
   * pick     choose two guests whose heights add to the heart's height. Their heights fill the paper
   *          and the student adds them (hundredths first) before stacking.
   * missing  one guest is already standing there. Subtract on paper to find how tall the guest on top
   *          must be; then a guest that tall arrives. Shown as fractions too (125/100 − 80/100 = 45/100),
   *          which is subtracting like fractions (4.NF.3a); subtracting decimals as decimals is 5.NBT.7.
   */
  async function startBuild() {
    phase = 'walking';
    const p = makeBuild(tier, usedPairs);
    const missing = tier >= 2 && results.length >= 2 && Math.random() < 0.4;
    cur = { kind: 'build', type: missing ? 'missing' : 'pick', target: p.target, pair: p.pair, choices: p.choices, picked: [], answer: p.target, tries: 0, helped: false, typed: [] };
    sc.tape = { labels: 'whole', fog: true };
    sc.lens = null; sc.band = null; sc.pointer = null; sc.jumps = null; sc.marks = [];
    sc.heart = { h: p.target, tag: dec(p.target) + ' cm', lit: false };
    clearActors();
    hideBoomer();
    redraw();
    stage.setAttribute('aria-label', 'A heart hangs ' + dec(p.target) + ' centimeters above the floor. The measuring tape is foggy.');
    if (missing) return startMissing();
    const cards = el('div', 'cards');
    cur.buttons = p.choices.map((bug, i) => {
      const btn = el('button', 'bugcard');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', bug.n + ' the ' + KINDS[bug.k].name + ', ' + dec(bug.h) + ' centimeters (key ' + (i + 1) + ')');
      btn.append(el('span', 'key', String(i + 1)), bugIcon(bug), el('span', 'len', dec(bug.h) + ' cm'), el('span', 'who', bug.n));
      btn.addEventListener('click', () => { btn.blur(); togglePick(i); });
      cards.append(btn);
      return btn;
    });
    cur.paper = paperSum({ cols: 3, rows: [null, null], answer: 'input', helper: 'carry', size: '1.3rem',
      onEnter: doStack, refocus: () => cur.paper.box.focus(), onChange: updateStackBtn,
      onDot: () => tip('No need to type the decimal point. Start with the hundredths digit.') });
    cur.side = el('div', 'side');
    const row = el('div', 'mathrow');
    row.append(cur.paper.el, cur.side);
    work(cards, row);
    phase = 'pick';
    paintPicks();
    caption('Hang the heart! It hangs ' + dec(p.target) + ' cm up. Pick two guests whose heights add up to exactly ' + dec(p.target) + ' cm. Add them on paper, then press Stack them!');
    tip('Pick two guests (click them or press 1–5), then add on paper.');
    round.shown();
    syncData();
  }
  function goalLine() {
    const g = el('div', 'fr');
    g.append(el('span', 'word inline', 'The heart:'), document.createTextNode(dec(cur.target) + ' cm ='), hFrac(cur.target, 100, true));
    return g;
  }
  function paintCards() {
    const pk = cur.picked;
    cur.buttons.forEach((b, i) => {
      const at = pk.indexOf(i);
      b.setAttribute('aria-pressed', String(at >= 0));
      const old = b.querySelector('.pos');
      if (old) old.remove();
      if (at >= 0) b.append(el('span', 'pos', at === 0 ? 'bottom' : 'top'));
      b.disabled = phase !== 'pick';
    });
  }
  function pickedHeights() { return [0, 1].map(i => cur.picked.length > i ? cur.choices[cur.picked[i]].h : null); }
  function paintPicks() {
    paintCards();
    const [a, b] = pickedHeights();
    cur.paper.setRow(0, a);
    cur.paper.setRow(1, b);
    cur.paper.box.clear();
    cur.paper.box.enable(phase === 'pick' && b !== null);
    cur.side.replaceChildren(goalLine(), fracAsk(a, b, null, { den: 100 }).el);
    if (phase === 'pick') {
      controls([{ label: 'Stack them!', id: 'stackBtn', disabled: true, noFocus: true, on: doStack }, { label: 'Hint', soft: true, id: 'hintBtn', noFocus: true, disabled: cur.helped, on: buildHint }]);
      updateStackBtn();
    }
  }
  function updateStackBtn() {
    const sb = $('#stackBtn');
    if (sb) sb.disabled = !(cur.picked.length === 2 && cur.paper.box.filled() >= 2);
  }
  function togglePick(i) {
    if (phase !== 'pick' || cur.type !== 'pick' || i < 0 || i >= cur.choices.length) return;
    const pk = cur.picked, at = pk.indexOf(i);
    if (at >= 0) pk.splice(at, 1);
    else if (pk.length < 2) pk.push(i);
    else pk[1] = i;
    if (actors.length) { clearActors(); sc.pointer = null; sc.tape.fog = true; redraw(); }
    paintPicks();
    if (pk.length === 2) {
      cur.paper.box.focus();
      tip('Add on paper, hundredths first. Then press Stack them!');
    }
  }
  function buildHint() {
    if (phase !== 'pick' && phase !== 'answer') return;
    cur.helped = true;
    const t = cur.target;
    if (cur.type === 'missing') {
      caption('Hint: the heart is at ' + t + ' hundredths, and ' + cur.G.n + ' is ' + cur.G.h + ' hundredths. Subtract one column at a time, starting with the hundredths. If a top digit is too small, regroup: trade 1 tenth for 10 hundredths, or 1 whole for 10 tenths.');
    } else if (cur.picked.length) {
      const x = cur.choices[cur.picked[0]];
      caption('Hint: the heart is at ' + t + ' hundredths (' + dec(t) + ' cm). ' + x.n + ' is ' + x.h + ' hundredths (' + dec(x.h) + ' cm). How many more hundredths do you need? Look for a guest that tall.');
    } else {
      caption('Hint: pick one guest first. Then work out how much more height you need. Thinking in hundredths helps: ' + dec(t) + ' cm is ' + t + ' hundredths.');
    }
    const hb = $('#hintBtn');
    if (hb) hb.disabled = true;
    if (cur.type === 'missing') cur.paper.box.focus();
  }
  async function stackPair(A, B, keep) {
    if (!keep) clearActors();
    const a1 = keep || actor(A), a2 = actor(B);
    if (!keep) { place(a1, -100, V.FLOOR); await moveTo(a1, V.BX, V.FLOOR, 800); }
    place(a2, -100, V.FLOOR);
    await moveTo(a2, V.BX - 120, V.FLOOR, 500);
    await moveTo(a2, V.BX, yOf(A.h), 600, true);
    return [a1, a2];
  }
  async function doStack() {
    if (phase !== 'pick' || cur.picked.length < 2) return;
    const box = cur.paper.box;
    if (box.filled() < 2) { tip('Add the two heights on paper first, starting with the hundredths.'); box.focus(); return; }
    phase = 'stacking';
    const A = cur.choices[cur.picked[0]], B = cur.choices[cur.picked[1]];
    const sum = A.h + B.h, t = cur.target, said = box.value();
    cur.typed.push(dec(A.h) + '+' + dec(B.h) + '=' + box.typed());
    paintCards();
    box.enable(false);
    controls([]);
    caption('Up they go…');
    const pair = await stackPair(A, B);
    clearFog();
    sc.pointer = { h: sum, text: sum === t ? null : dec(sum) + ' cm' };
    renderOver();
    const reach = sum === t, addOK = said === sum;
    if (reach && addOK) {
      box.set(sum, 'ok');
      cur.paper.lock();
      cur.side.replaceChildren(goalLine(), fracAsk(A.h, B.h, sum, { den: 100 }).el);
      sc.heart.lit = true;
      renderOver();
      pair.forEach(x => dance(x));
      RealmFX.correct();
      caption(((cur.helped || cur.tries) ? 'You did it! ' : pick(PRAISE) + ' ') + 'The heart is hung! ' + dec(A.h) + ' + ' + dec(B.h) + ' = ' + dec(t) + ' cm.', 'good');
      return buildFinish(true);
    }
    RealmFX.wrong();
    cur.tries++;
    const diff = Math.abs(sum - t);
    const off = diff >= 100 ? dec(diff) + ' cm' : diff % 10 === 0 ? (diff / 10) + (diff === 10 ? ' tenth' : ' tenths') : diff + (diff === 1 ? ' hundredth' : ' hundredths');
    let msg;
    if (reach) msg = 'These two guests do reach the heart! But check your addition: ' + sumFeedback(A.h, B.h, said);
    else if (addOK) msg = 'Your addition is right: the stack is ' + dec(sum) + ' cm. The heart is at ' + dec(t) + ' cm, so it\'s ' + off + ' too ' + (sum > t ? 'tall' : 'short') + '.';
    else msg = 'The stack is ' + dec(sum) + ' cm, not ' + dec(said) + ' cm, so check your addition too. The heart is at ' + dec(t) + ' cm, ' + off + (sum > t ? ' lower' : ' higher') + '.';
    if (cur.tries === 1) {
      caption(msg + ' Try again!', 'bad');
      phase = 'pick';
      if (!reach) cur.picked = [];
      paintPicks();
      if (reach) box.focus();
      return;
    }
    // Second miss: show one way that works
    const [P, Q] = cur.pair;
    cur.picked = [cur.choices.indexOf(P), cur.choices.indexOf(Q)];
    phase = 'stacking';
    paintPicks();
    controls([]);
    cur.paper.box.set(t, 'shown');
    cur.paper.showCarries(P.h, Q.h);
    cur.side.replaceChildren(goalLine(), fracAsk(P.h, Q.h, t, { den: 100 }).el);
    caption('Here\'s one way: ' + dec(P.h) + ' + ' + dec(Q.h) + ' = ' + dec(t) + '. The heart is at ' + t + ' hundredths. ' + P.n + ' is ' + P.h + ' hundredths, and ' + t + ' − ' + P.h + ' = ' + Q.h + ', so the other guest is ' + dec(Q.h) + ' cm.', 'bad');
    sc.pointer = null;
    sc.tape.fog = 'clear';
    renderOver();
    const again = await stackPair(P, Q);
    sc.pointer = { h: t };
    sc.heart.lit = true;
    renderOver();
    again.forEach(x => dance(x));
    buildFinish(false);
  }

  // Missing guest: subtract to find the height of the guest who goes on top
  function subParts(T, G) {   // column by column, regrouping when the top digit is too small
    let o = onesOf(T), t = tenthsOf(T), h = hundOf(T);
    const out = [];
    if (h < hundOf(G)) {
      if (t > 0) t--; else { o--; t = 9; out.push('There are no tenths to trade, so trade 1 whole for 10 tenths first.'); }
      out.push('Hundredths: ' + h + ' is less than ' + hundOf(G) + ', so trade 1 tenth for 10 hundredths: ' + (h + 10) + ' − ' + hundOf(G) + ' = ' + (h + 10 - hundOf(G)) + '.');
    } else out.push('Hundredths: ' + h + ' − ' + hundOf(G) + ' = ' + (h - hundOf(G)) + '.');
    if (t < tenthsOf(G)) { o--; out.push('Tenths: ' + t + ' is less than ' + tenthsOf(G) + ', so trade 1 whole for 10 tenths: ' + (t + 10) + ' − ' + tenthsOf(G) + ' = ' + (t + 10 - tenthsOf(G)) + '.'); }
    else out.push('Tenths: ' + t + ' − ' + tenthsOf(G) + ' = ' + (t - tenthsOf(G)) + '.');
    out.push('Ones: ' + o + ' − ' + onesOf(G) + ' = ' + (o - onesOf(G)) + '.');
    return out.join(' ');
  }
  function noBorrowDiff(T, G) {
    const d = (x, y) => Math.abs(x - y);
    return d(onesOf(T), onesOf(G)) * 100 + d(tenthsOf(T), tenthsOf(G)) * 10 + d(hundOf(T), hundOf(G));
  }
  function subFeedback(v) {
    const T = cur.target, G = cur.G.h, X = T - G;
    if (v === T + G) return 'That\'s adding! To find the missing height, subtract: ' + dec(T) + ' − ' + dec(G) + '.';
    if (den10(G) && v === T - G / 10) return 'Line up the decimal points! ' + dec(G) + ' is ' + (G / 10) + ' tenths, the same as ' + G + ' hundredths (' + dec2(G) + ').';
    if (v === noBorrowDiff(T, G) && v !== X) return 'Watch the regrouping! When a top digit is smaller than the one below it, trade 1 from the place on its left. Don\'t just subtract the smaller digit from the bigger one.';
    const want = String(X).padStart(3, '0'), got = String(v).padStart(3, '0');
    if (got.split('').reverse().join('') === want && got !== want) return 'It looks like you typed from the left. Start on the right: type the hundredths digit first.';
    return 'Subtract one column at a time, starting with the hundredths. As fractions, it\'s ' + T + '/100 − ' + G + '/100.';
  }
  async function startMissing() {
    const [G, X] = cur.pair;
    cur.G = G; cur.X = X; cur.answer = X.h;
    const cards = el('div', 'cards');
    const q = el('div', 'bugcard');
    const qt = el('span');
    qt.append(el('span', 'who', 'The guest on top'), el('span', 'len', '? cm'), el('span', 'by', 'Subtract to find out'));
    q.append(qt);
    cards.append(bugCard(G), q);
    cur.paper = paperSum({ cols: 3, op: '−', rows: [cur.target, G.h], answer: 'input', helper: 'scratch', size: '1.45rem',
      onEnter: checkMissing, refocus: () => cur.paper.box.focus(),
      onDot: () => tip('No need to type the decimal point. Start with the hundredths digit.') });
    cur.paper.box.enable(false);
    cur.side = el('div', 'side');
    cur.side.append(goalLine(), fracAsk(cur.target, G.h, null, { op: '−', den: 100 }).el);
    const row = el('div', 'mathrow');
    row.append(cur.paper.el, cur.side);
    work(cards, row);
    caption(G.n + ' (' + dec(G.h) + ' cm) wants to hang the heart at ' + dec(cur.target) + ' cm.');
    controls([{ label: 'Check', disabled: true, on: () => {} }, { label: 'Hint', soft: true, disabled: true, on: () => {} }]);
    const a = actor(G);
    place(a, -100, V.FLOOR);
    await moveTo(a, V.BX, V.FLOOR, 900);
    cur.base = a;
    caption(G.n + ' (' + dec(G.h) + ' cm) wants to hang the heart at ' + dec(cur.target) + ' cm. How tall must the guest on top be? Subtract on paper: ' + dec(cur.target) + ' − ' + dec(G.h) + '.');
    tip('Hundredths digit first. Use the small boxes on top to regroup.');
    phase = 'answer';
    cur.paper.box.enable(true);
    controls([{ label: 'Check', id: 'checkBtn', noFocus: true, on: checkMissing }, { label: 'Hint', soft: true, id: 'hintBtn', noFocus: true, on: buildHint }]);
    cur.paper.box.focus();
    round.shown();
    syncData();
  }
  // A guest of height h climbs onto the waiting guest
  async function guestOnTop(h) {
    const bug = bookBug(h, [cur.G.id]) || newBug(h, [cur.G.n]);
    actors.filter(a => a !== cur.base).forEach(a => a.g.remove());
    actors = [cur.base];
    const [, top] = await stackPair(cur.G, bug, cur.base);
    return { bug: bug, actor: top };
  }
  async function checkMissing() {
    if (phase !== 'answer' || cur.type !== 'missing') return;
    const box = cur.paper.box, v = box.value();
    if (v === null || box.filled() < 2) { tip('Fill in each column, starting with the hundredths.'); box.focus(); return; }
    cur.typed.push(box.typed());
    const T = cur.target, X = cur.X.h, G = cur.G.h;
    phase = 'stacking';
    controls([]);
    if (v === X) {
      box.set(X, 'ok');
      cur.paper.lock();
      cur.side.replaceChildren(goalLine(), fracAsk(T, G, X, { op: '−', den: 100 }).el);
      caption('Let\'s see! A guest who is ' + dec(X) + ' cm tall climbs up…');
      const g = await guestOnTop(X);
      clearFog();
      sc.heart.lit = true;
      sc.pointer = { h: T };
      renderOver();
      dance(g.actor); dance(cur.base);
      RealmFX.correct();
      caption(((cur.helped || cur.tries) ? 'You did it! ' : pick(PRAISE) + ' ') + dec(T) + ' − ' + dec(G) + ' = ' + dec(X) + '. ' + g.bug.n + ' is ' + dec(X) + ' cm tall and reaches the heart exactly!', 'good');
      cur.X = g.bug;
      return buildFinish(true);
    }
    RealmFX.wrong();
    box.bad();
    cur.tries++;
    if (cur.tries === 1) {
      let show = '';
      if (v >= 20 && v <= 190) {   // let them see a guest that tall try it
        caption('Let\'s try a guest who is ' + dec(v) + ' cm tall…');
        await guestOnTop(v);
        clearFog();
        sc.pointer = { h: G + v, text: dec(G + v) + ' cm' };
        renderOver();
        show = 'A ' + dec(v) + ' cm guest makes the stack ' + dec(G + v) + ' cm: too ' + (G + v > T ? 'tall' : 'short') + '. ';
      }
      caption(show + subFeedback(v) + ' Try again!', 'bad');
      phase = 'answer';
      box.clear();
      controls([{ label: 'Check', id: 'checkBtn', noFocus: true, on: checkMissing }, { label: 'Hint', soft: true, id: 'hintBtn', noFocus: true, disabled: cur.helped, on: buildHint }]);
      box.focus();
      return;
    }
    box.set(X, 'shown');
    cur.paper.lock();
    cur.side.replaceChildren(goalLine(), fracAsk(T, G, X, { op: '−', den: 100 }).el);
    caption(dec(T) + ' − ' + dec(G) + ' = ' + dec(X) + '. ' + subParts(T, G), 'bad');
    const g = await guestOnTop(X);
    clearFog();
    sc.heart.lit = true;
    sc.pointer = { h: T };
    renderOver();
    dance(g.actor);
    cur.X = g.bug;
    buildFinish(false);
  }
  function buildFinish(right) {
    phase = 'shown';
    tip('');
    if (cur.type === 'pick') {
      paintCards();
      cur.choices.forEach(b => remember(b, false));
    } else { remember(cur.G, false); remember(cur.X, false); }
    const prompt = cur.type === 'missing' ? 'Missing: ' + dec(cur.target) + ' − ' + dec(cur.G.h) : 'Reach ' + dec(cur.target) + ' from ' + cur.choices.map(b => dec(b.h)).join(', ');
    const bug = cur.type === 'missing' ? cur.X : cur.choices[cur.picked[1]] || cur.pair[1];
    finish({ prompt: prompt, answer: cur.typed.join(' → '), correct: right, hintUsed: !right || cur.helped || cur.tries > 0, bug: bug });
  }

  document.addEventListener('keydown', e => {
    if ($('#play').hidden || e.ctrlKey || e.metaKey || e.altKey) return;
    const typing = e.target && (e.target.tagName === 'INPUT');
    if (phase === 'pick' && !typing && /^[1-9]$/.test(e.key)) { e.preventDefault(); togglePick(Number(e.key) - 1); return; }
    if (phase === 'pick' && e.key === 'Enter' && !typing && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); doStack(); }
  });


  /* ── Tutorials: shown the first time, replayable from the start screen ── */

  const TB = (k, c, n, h) => ({ k: k, c: c, n: n, h: h, by: '' });
  function bigText(...parts) {
    const p = el('p', 'tut-big');
    parts.forEach(x => p.append(typeof x === 'string' ? document.createTextNode(x) : x));
    return p;
  }
  function stand(bug) { const a = actor(bug); place(a, V.BX, V.FLOOR); return a; }
  function standOn(bottom, top) { const a = stand(bottom); const b = actor(top); place(b, V.BX, yOf(bottom.h)); return [a, b]; }
  function resetScene(tape) {
    sc.tape = Object.assign({ labels: 'whole', fog: false }, tape || {});
    sc.lens = null; sc.band = null; sc.pointer = null; sc.jumps = null; sc.marks = []; sc.heart = null;
    clearActors();
    hideBoomer();
  }
  const TUTORIALS = {
    tenths: () => [
      { say: 'This is the shack\'s measuring tape. It\'s magnified, so tiny bugs look big! Only the whole centimeters have numbers: 0, 1 and 2.',
        scene() { resetScene(); }, big: () => bigText('What is each small space worth?') },
      { say: 'Count the spaces from 0 up to 1. There are 10 equal spaces.',
        scene() { resetScene(); sc.jumps = { from: 0, to: 100, step: 10, where: 'tape' }; }, big: () => bigText('10 spaces = 1 cm') },
      { say: 'So each space is one tenth of a centimeter. One tenth can be written 1/10 or 0.1.',
        scene() { resetScene({ labels: 'all' }); }, big: () => bigText('1 space = ', fracNode(1, 10), ' cm = 0.1 cm') },
      { say: 'Lulu the ladybug stands on 0. The pointer touches the tape 7 spaces up, so Lulu is 7 tenths of a centimeter tall.',
        scene() { resetScene(); stand(TB('lady', 0, 'Lulu', 70)); sc.pointer = { h: 70, text: '0.7 cm' }; sc.jumps = { from: 0, to: 70, step: 10, where: 'tape' }; },
        big: () => bigText(fracNode(7, 10), ' cm = 0.7 cm') },
      { say: 'Taller bugs go past 1. Start at 1 and count up: 1.1, 1.2, 1.3. Sprout is 1 whole centimeter and 3 tenths.',
        scene() { resetScene(); stand(TB('cater', 0, 'Sprout', 130)); sc.pointer = { h: 130, text: '1.3 cm' }; sc.marks = [{ h: 100, where: 'tape' }]; sc.jumps = { from: 100, to: 130, step: 10, where: 'tape' }; },
        big: () => bigText(fracNode(13, 10), ' cm = 1.3 cm') },
    ],
    hundredths: () => [
      { say: 'Pip is taller than 0.6 cm but not as tall as 0.7 cm. To measure Pip exactly, zoom in!',
        scene() { resetScene({ labels: 'half' }); stand(TB('bee', 0, 'Pip', 67)); sc.pointer = { h: 67 }; sc.band = [60, 70]; }, big: () => bigText('Between 0.6 and 0.7') },
      { say: 'The magnifier shows only the tenth from 0.6 to 0.7, split into 10 tiny spaces. Only the ends have numbers.',
        scene() { resetScene({ labels: 'half' }); stand(TB('bee', 0, 'Pip', 67)); sc.pointer = { h: 67 }; sc.band = [60, 70]; sc.lens = { from: 60 }; sc.jumps = { from: 60, to: 70, step: 1, where: 'lens' }; },
        big: () => bigText('10 tiny spaces = 1 tenth') },
      { say: 'Each tiny space is one hundredth of a centimeter. One hundredth can be written 1/100 or 0.01.',
        scene() { resetScene({ labels: 'half' }); stand(TB('bee', 0, 'Pip', 67)); sc.pointer = { h: 67 }; sc.band = [60, 70]; sc.lens = { from: 60 }; sc.jumps = { from: 60, to: 61, step: 1, where: 'lens', text: '0.01' }; },
        big: () => bigText('1 tiny space = ', fracNode(1, 100), ' cm = 0.01 cm') },
      { say: 'Start at 0.6 and count up 7 tiny spaces: 0.61, 0.62, … 0.67. Pip is 0.67 cm tall. (0.6 is the same as 0.60, so 60 hundredths and 7 more make 67 hundredths.)',
        scene() { resetScene({ labels: 'half' }); stand(TB('bee', 0, 'Pip', 67)); sc.pointer = { h: 67, text: '0.67 cm' }; sc.band = [60, 70]; sc.lens = { from: 60 }; sc.marks = [{ h: 60, where: 'lens' }]; sc.jumps = { from: 60, to: 67, step: 1, where: 'lens' }; },
        big: () => bigText(fracNode(67, 100), ' cm = 0.67 cm') },
      { say: 'Watch out for zeros! Bean is just 4 tiny spaces past 1: that\'s 1 and 4 hundredths, 1.04 cm. (1.4 cm would be 4 whole tenths past 1.)',
        scene() { resetScene({ labels: 'half' }); stand(TB('beetle', 2, 'Bean', 104)); sc.pointer = { h: 104, text: '1.04 cm' }; sc.band = [100, 110]; sc.lens = { from: 100 }; sc.marks = [{ h: 100, where: 'lens' }]; sc.jumps = { from: 100, to: 104, step: 1, where: 'lens' }; },
        big: () => bigText(fracNode(104, 100), ' cm = 1.04 cm') },
    ],
    stack: () => {
      const scene = fog => () => { resetScene({ fog: fog }); standOn(TB('lady', 0, 'Lulu', 70), TB('bee', 0, 'Mo', 45)); sc.pointer = fog === true ? { h: 115, text: '? cm', fill: '#EFE7FF' } : { h: 115, text: '1.15 cm' }; };
      const paperWith = (o) => () => { const r = el('div', 'mathrow'); r.append(paperSum(Object.assign({ cols: 3, rows: [70, 45], helper: 'carry', still: true, size: '1.6rem' }, o)).el); return r; };
      return [
        { say: 'Mo (0.45 cm) climbs onto Lulu (0.7 cm) to see the band. When guests stack up, the tape gets foggy! But the guest book has both heights, so you can add them.',
          scene: scene(true), big: () => bigText('0.7 cm + 0.45 cm = ?') },
        { say: 'Write the heights on paper with the decimal points lined up: ones under ones, tenths under tenths. A faint 0 shows that 0.7 is the same as 0.70.',
          scene: scene(true), big: paperWith({ answer: null }) },
        { say: 'Add from the right. Hundredths: 0 + 5 = 5. Tenths: 7 + 4 = 11 tenths, so write 1 and carry 1 to the ones (tap the box over the ones to write it). Ones: 0 + 0 + 1 = 1.',
          scene: scene(true), big: paperWith({ answer: 115, showCarry: { o: true } }) },
        { say: 'The stack is 1.15 cm. As fractions, that\'s 70/100 + 45/100 = 115/100. The fog clears, and the tape agrees!',
          scene: scene('clear'), big: () => { const r = el('div', 'mathrow'); r.append(paperSum({ cols: 3, rows: [70, 45], helper: 'carry', still: true, showCarry: { o: true }, answer: 115, size: '1.4rem' }).el, fracLine(70, 45, 115)); return r; } },
      ];
    },
    build: () => {
      const heart = lit => ({ h: 125, tag: '1.25 cm', lit: !!lit });
      return [
        { say: 'Hang the heart! This heart hangs 1.25 cm up. Pick two guests whose heights add up to exactly 1.25 cm.',
          scene() { resetScene({ fog: true }); sc.heart = heart(); }, big: () => bigText('? + ? = 1.25 cm') },
        { say: 'Say you pick Gus (0.8 cm) and Zuzu (0.45 cm). Their heights go on the paper. Add from the right: 0 + 5 = 5. 8 + 4 = 12 tenths, so write 2 and carry 1. 0 + 0 + 1 = 1.',
          scene() { resetScene({ fog: true }); sc.heart = heart(); },
          big: () => { const r = el('div', 'mathrow'); r.append(paperSum({ cols: 3, rows: [80, 45], helper: 'carry', still: true, showCarry: { o: true }, answer: 125, size: '1.5rem' }).el, fracLine(80, 45, 125)); return r; } },
        { say: 'Your paper says 1.25 cm, the same as the heart. Press Stack them! Zuzu climbs onto Gus and reaches the heart exactly.',
          scene() { resetScene({ fog: 'clear' }); sc.heart = heart(true); standOn(TB('beetle', 0, 'Gus', 80), TB('fly', 0, 'Zuzu', 45)); sc.pointer = { h: 125 }; },
          big: () => bigText('0.8 + 0.45 = 1.25 cm') },
        { say: 'Sometimes one guest is already waiting. Subtract to find how tall the guest on top must be: 1.25 − 0.80. Tenths: 2 is less than 8, so trade 1 whole for 10 tenths: 12 − 8 = 4. The guest on top must be 0.45 cm.',
          scene() { resetScene({ fog: true }); sc.heart = heart(); stand(TB('beetle', 0, 'Gus', 80)); },
          big: () => { const r = el('div', 'mathrow'); r.append(paperSum({ cols: 3, op: '−', rows: [125, 80], helper: 'none', answer: 45, size: '1.5rem' }).el, fracLine(125, 80, 45, '−')); return r; } },
      ];
    },
  };
  let tut = null;
  function runTutorial() {
    tut = { list: TUTORIALS[M.tut](), i: 0 };
    phase = 'tutorial';
    show('#play');
    drawBackdrop();
    drawQueue(0);
    paintParty(true);
    tip('');
    tutSlide();
  }
  function tutSlide() {
    const s = tut.list[tut.i];
    s.scene();
    redraw();
    caption(s.say);
    const dots = el('div', 'tut-dots');
    tut.list.forEach((x, i) => dots.append(el('span', i === tut.i ? 'on' : '')));
    work(s.big(), dots);
    const last = tut.i === tut.list.length - 1;
    const go = { measure: 'Let\'s measure!', stack: 'Let\'s stack!', build: 'Let\'s build!' }[M.kind];
    const list = [{ label: last ? go : 'Next', id: 'tutNext', on: () => { if (last) { memory.tut[M.tut] = true; startRound(); } else { tut.i++; tutSlide(); } } }];
    if (tut.i > 0) list.push({ label: 'Back', soft: true, on: () => { tut.i--; tutSlide(); } });
    else list.push({ label: 'Skip', soft: true, on: () => { memory.tut[M.tut] = true; startRound(); } });
    controls(list);
    syncData();
  }

  /* ── Start screen ── */

  const zone = C.zones.find(z => z.zone === skill.zone);
  $('#zoneName').textContent = zone ? zone.title : 'bug❤️shack';
  $('#skillTitle').textContent = skill.name;
  document.title = 'bug❤️shack: ' + skill.name;
  const avatar = (() => {
    const eq = session.shop && session.shop.equipped;
    return (eq && eq.avatar && RealmSprites.critter(eq.avatar)) || RealmSprites.cafeCritters(session)[0];
  })();
  function hosts(box, extraBugs) {
    box.replaceChildren();
    const me = el('div', 'host');
    if (avatar) me.append(RealmSprites.critterSvg(avatar));
    me.append(el('span', '', 'You'));
    const bo = el('div', 'host');
    bo.append(boomerIcon(null), el('span', '', 'Boomer, the bouncer'));
    box.append(me, bo);
    if (extraBugs && extraBugs.length) {
      const party = el('div', 'host slots');
      extraBugs.forEach((b, i) => { const s = el('span', 'slot first'); s.style.animationDelay = (i * -0.11) + 's'; s.append(bugIcon(b)); party.append(s); });
      box.append(party);
    }
  }
  hosts($('#hosts'));
  const mine = session.mastery[skillId] || { status: '', days: 0 };
  $('#introStars').replaceChildren(starRow(Math.min(mine.days || 0, skill.daysNeeded), skill.daysNeeded, mine.status === 'mastered', false));
  function rulesText() {
    const need = Math.ceil(skill.minItems * skill.minAccuracy - 1e-9);
    const what = { measure: 'guests', stack: 'stacks', build: 'hearts' }[M.kind];
    const lines = [];
    if (M.kind === 'measure') {
      lines.push('Bugs are lining up for the party! Each guest stands next to the shack\'s magnified measuring tape. Read the tape where the pointer touches it, and type the bug\'s height in centimeters.');
      lines.push(M.places === 1
        ? 'Only some marks have numbers, so work out what each small space is worth.'
        : 'The magnifier zooms in on one tenth of a centimeter and splits it into 10 tiny spaces. Only every 10th mark has a number' + (maxTier() === 4 ? ', and once you\'re strong, the magnifier\'s numbers disappear!' : '.'));
      lines.push('Boomer the bouncer sometimes writes a guest\'s badge first. He makes mistakes! Measure for yourself and catch him when he\'s wrong.');
    } else if (M.kind === 'stack') {
      lines.push('Guests stand on each other\'s heads to see the band, and the tape gets foggy. Use the heights in your guest book and add them up.');
      lines.push('Add on paper with the decimal points lined up, starting with the hundredths. Tap a carry box to write a 1. As you get stronger, you\'ll write the fractions and copy the heights onto the paper yourself.');
    } else {
      lines.push('Hang hearts all over the shack! Each heart hangs at a height. Pick two guests whose heights add up to exactly that height, add them on paper, then press Stack them!');
      lines.push('Sometimes one guest is already waiting. Subtract on paper to find how tall the guest on top must be.');
    }
    lines.push(mine.status === 'mastered'
      ? 'You already mastered this one! Playing keeps it sharp.'
      : 'To earn today\'s star: finish all ' + skill.minItems + ' ' + what + ' and get at least ' + need + ' right on the first try, without a hint.');
    const box = $('#rules');
    box.replaceChildren();
    lines.forEach((t, i) => box.append(el('p', '', t)));
    box.lastChild.style.fontWeight = '600';
  }
  rulesText();
  function paintBook() {
    const box = $('#book');
    box.replaceChildren();
    const mineBugs = memory.book.filter(b => b.by === 'you');
    if (!memory.book.length) {
      box.append(el('span', 'label', M.kind === 'measure' ? 'Every guest you measure goes in your guest book.' : 'Your guest book is empty. New guests will bring their own badges, and bugs you measure join the book.'));
      return;
    }
    box.append(el('span', 'label', 'Your guest book: ' + memory.book.length + (memory.book.length === 1 ? ' bug' : ' bugs') + (mineBugs.length ? ' (' + mineBugs.length + ' measured by you)' : '')));
    memory.book.slice(-14).forEach(b => box.append(bugIcon(b, 'mini')));
  }
  paintBook();

  function sanitize(st) {
    if (!st || st.v !== 1 || !Array.isArray(st.book)) return null;
    const book = st.book.filter(b => b && KINDS[b.k] && Number.isInteger(b.h) && b.h >= 10 && b.h <= 199 && typeof b.n === 'string').slice(-BOOK_MAX);
    const nextId = Math.max(Number(st.nextId) || 1, ...book.map(b => (Number(b.id) || 0) + 1));
    return { v: 1, book: book, tut: st.tut && typeof st.tut === 'object' ? st.tut : {}, stack: { lvl: clamp(Number(st.stack && st.stack.lvl) || 1, 1, 5), wins: Number(st.stack && st.stack.wins) || 0, miss: Number(st.stack && st.stack.miss) || 0 }, nextId: nextId };
  }
  show('#intro');
  MathRealm.loadState(GAME_ID).then(d => {
    if (d.ok) {
      memoryLoaded = true;
      const st = sanitize(d.state);
      if (st) memory = st;
    }
    paintBook();
    rulesText();
    const b = $('#startBtn');
    b.disabled = false;
    b.textContent = { measure: 'Open the door!', stack: 'Start stacking!', build: 'Start building!' }[M.kind];
    $('#tutBtn').disabled = false;
    b.focus();
  });
  $('#startBtn').addEventListener('click', () => { if (memory.tut[M.tut]) startRound(); else runTutorial(); });
  $('#tutBtn').addEventListener('click', () => runTutorial());
  $('#againBtn').addEventListener('click', () => startRound());

  /* ── The end of the round ── */

  async function endRound() {
    phase = 'over';
    controls([]);
    const firsts = results.filter(r => r.first).length;
    $('#resTitle').textContent = firsts >= Math.ceil(skill.minItems * skill.minAccuracy - 1e-9) ? 'What a party!' : 'Party\'s over… for now!';
    $('#resRight').textContent = firsts + ' of ' + results.length;
    $('#resRightLabel').textContent = { measure: 'guests measured right on the first try', stack: 'stacks added right on the first try', build: 'hearts hung on the first try' }[M.kind];
    $('#resCaughtBox').hidden = !boomer.made;
    $('#resCaught').textContent = boomer.caught + ' of ' + boomer.made;
    $('#resGems').textContent = '…';
    $('#resGemsLabel').textContent = 'saving your party';
    $('#resStars').replaceChildren();
    $('#resMsg').hidden = true;
    $('#resTicket').hidden = true;
    $('#againBtn').disabled = true;
    hosts($('#resHosts'), results.map(r => r.bug).filter(Boolean).slice(0, 8));
    show('#done');
    const saves = [results.length ? round.finish() : Promise.resolve({ ok: false, error: 'no_attempts' })];
    if (memoryLoaded) saves.push(MathRealm.saveState(GAME_ID, memory));
    const [res] = await Promise.all(saves);
    showResult(res);
    paintBook();
    $('#againBtn').disabled = false;
    $('#againBtn').focus();
    syncData();
  }

  function showResult(res) {
    const msg = $('#resMsg');
    msg.replaceChildren();
    const line = t => msg.append(el('p', '', t));
    if (res.guest) {
      $('#resGems').textContent = '—';
      $('#resGemsLabel').textContent = 'guest mode';
      line('Nice work! Nothing is saved in guest mode, so no ' + C.pointsName + ' or stars yet.');
      line('Log in with your class code to start earning ' + C.pointsName + ', stars and golden tickets.');
      msg.hidden = false;
      return;
    }
    if (res.ok) {
      $('#resGems').textContent = '+' + res.points.total;
      $('#resGemsLabel').textContent = C.pointsName + ' (you have ' + Number(res.points.balance).toLocaleString() + ')';
      updateGems();
      const m = res.mastery, mastered = m.status === 'mastered';
      $('#resStars').replaceChildren(starRow(Math.min(m.days, m.daysNeeded), m.daysNeeded, mastered, m.newlyMastered || res.round.qualifies));
      if (m.newlyMastered) { line('You mastered ' + skill.name + (/[?!.]$/.test(skill.name) ? '' : '!')); RealmFX.fanfare(); RealmFX.confetti(); }
      else if (mastered) line('You already mastered this one. Groovy work!');
      else if (res.round.qualifies) { line('This party earned today\'s star!'); RealmFX.fanfare(); RealmFX.confetti(); }
      else if (results.length < skill.minItems) line('For today\'s star, finish all ' + skill.minItems + '. Try again!');
      else line('For today\'s star, get ' + Math.round(skill.minAccuracy * 100) + '% right on the first try, without a hint. You can do it!');
      if (res.ticket) {
        const wrap = $('#resTicket');
        const stub = el('div', 'ticket');
        stub.append(el('strong', '', res.ticket.code), el('span', '', res.ticket.skillName));
        wrap.replaceChildren(stub, el('p', '', 'A golden ticket! Show this code to your teacher to trade it for a prize.'));
        wrap.hidden = false;
        RealmFX.confetti();
      }
    } else if (res.queued) {
      $('#resGems').textContent = 'Saved';
      $('#resGemsLabel').textContent = 'on this computer';
      line('The internet dropped, so your party is saved on this computer. It will send by itself when the internet is back.');
    } else if (res.error !== 'no_attempts') {
      $('#resGems').textContent = '—';
      $('#resGemsLabel').textContent = 'not saved';
      line(MathRealm.errorMessage(res.error, true));
    } else {
      $('#resGems').textContent = '0';
      $('#resGemsLabel').textContent = C.pointsName;
    }
    msg.hidden = !msg.childNodes.length;
  }
})();
