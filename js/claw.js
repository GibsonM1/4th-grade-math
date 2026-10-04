/*
 * Math Realm: Critter Claw (in the Sprite Shop)
 *
 * The student pays gems, steers the claw over a prize and drops it. The page sends
 * which prize the claw closed on; the SERVER decides win or lose (Settings tab:
 * clawCost, clawWinRate, clawPityAfter, clawDailyLimit), so odds can't be faked.
 * Lost grabs are played out with suspense: the prize slips while rising, the grip
 * is too weak, or it wobbles off right at the edge of the chute.
 */
(function () {
  'use strict';
  if (!MathRealm.requireLogin()) return;

  const C = window.MATH_REALM_CATALOG;
  const $ = s => document.querySelector(s);
  const INK = '#2A1F45';
  const HOME_X = 492, REST_Y = 178, MIN_X = 92, MAX_X = 492, SPEED = 190, TIME = 15;
  const SLOT_WORD = { hat: 'hat', face: 'glasses', neck: 'necklace', wrist: 'bracelet', feet: 'shoes' };
  const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let items = [], owned = [], equipped = {}, balance = 0, claw = {}, pile = [];
  let mode = 'loading', cx = HOME_X, cy = REST_Y, open = 1, carry = null, dir = 0, timeLeft = TIME, timerId = 0, lastWhirr = 0;

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function S(tag, attrs) { const e = document.createElementNS('http://www.w3.org/2000/svg', tag); Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k])); return e; }
  const wait = ms => new Promise(r => setTimeout(r, still ? ms * 0.3 : ms));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  function tween(ms, fn, easing) {
    ms = still ? ms * 0.3 : ms;
    return new Promise(done => {
      const t0 = performance.now();
      const step = now => { const k = Math.min(1, (now - t0) / ms); fn(easing ? easing(k) : k); if (k < 1) requestAnimationFrame(step); else done(); };
      requestAnimationFrame(step);
    });
  }
  function status(text, tone) { const s = $('#status'); s.textContent = text; s.className = 'status' + (tone ? ' ' + tone : ''); }
  function setGems(n) { balance = n; $('#gemCount').textContent = Number(n).toLocaleString(); }

  /* ── Top bar and music ── */

  RealmMusic.setTheme('arcade');
  $('#gemName').textContent = C.pointsName;
  [
    { btn: $('#soundBtn'), label: 'Sounds', get: () => RealmFX.soundOn, flip: () => RealmFX.toggleSound() },
    { btn: $('#musicBtn'), label: 'Music', get: () => RealmMusic.on, flip: () => RealmMusic.toggle() },
  ].forEach(t => {
    const paint = () => { t.btn.textContent = t.label + ': ' + (t.get() ? 'on' : 'off'); t.btn.setAttribute('aria-pressed', String(t.get())); };
    paint();
    t.btn.addEventListener('click', () => { t.flip(); paint(); t.btn.blur(); });
  });

  /* ── The machine ── */

  const svg = $('#machine');
  const layer = {};
  function build() {
    svg.replaceChildren();
    // cabinet
    svg.append(S('rect', { x: 20, y: 18, width: 560, height: 566, rx: 38, fill: '#FF7EB6', stroke: INK, 'stroke-width': 4 }));
    svg.append(S('rect', { x: 34, y: 30, width: 532, height: 542, rx: 30, fill: 'none', stroke: '#FFC2DD', 'stroke-width': 4 }));
    // marquee with blinking bulbs
    svg.append(S('rect', { x: 64, y: 34, width: 472, height: 72, rx: 22, fill: '#6C4FB3', stroke: INK, 'stroke-width': 3 }));
    for (let i = 0; i < 16; i++) svg.append(S('circle', { class: 'bulb' + (i % 2 ? ' b2' : ''), cx: 84 + i * 28.8, cy: 44, r: 5, fill: '#FFD84D' }));
    for (let i = 0; i < 16; i++) svg.append(S('circle', { class: 'bulb' + (i % 2 ? '' : ' b2'), cx: 84 + i * 28.8, cy: 96, r: 5, fill: '#FFD84D' }));
    const title = S('text', { x: 300, y: 82, 'text-anchor': 'middle', 'font-size': 36, 'font-weight': 800, fill: '#FFD84D', 'font-family': 'Grandstander, sans-serif', stroke: INK, 'stroke-width': 1.5, 'paint-order': 'stroke' });
    title.textContent = 'CRITTER CLAW';
    svg.append(title);
    // window and back wall
    svg.append(S('rect', { x: 60, y: 118, width: 480, height: 362, rx: 16, fill: '#DDF1FF', stroke: INK, 'stroke-width': 3 }));
    [[110, 170], [210, 230], [330, 160], [420, 250], [160, 300], [380, 320], [260, 290]].forEach(([x, y]) => svg.append(S('path', { d: star(x, y, 6), fill: '#FFFFFF', opacity: 0.8 })));
    svg.append(S('rect', { x: 70, y: 126, width: 460, height: 9, rx: 4.5, fill: '#B9C3D6', stroke: INK, 'stroke-width': 2 }));
    // plushy pile of soft balls
    const balls = ['#FFC2DD', '#C9F0E2', '#FFF1B8', '#D9CCF6', '#CFE8FF'];
    for (let i = 0; i < 26; i++) svg.append(S('circle', { cx: 74 + (i * 37) % 370, cy: 462 - (i % 3) * 9, r: 20 + (i % 4) * 3, fill: balls[i % balls.length], stroke: '#FFFFFF', 'stroke-width': 2 }));
    svg.append(S('rect', { x: 62, y: 466, width: 388, height: 12, fill: '#F7D5E8' }));
    // prizes
    layer.prizes = S('g');
    svg.append(layer.prizes);
    // chute (glass box) on the right
    svg.append(S('rect', { x: 452, y: 300, width: 84, height: 178, fill: '#FFFFFF', opacity: 0.55, stroke: INK, 'stroke-width': 3 }));
    svg.append(S('path', { d: 'M452,300 L470,286 M536,300 L536,286', stroke: INK, 'stroke-width': 3 }));
    const pt = S('text', { x: 494, y: 400, 'text-anchor': 'middle', 'font-size': 18, 'font-weight': 800, fill: '#C2477F', 'font-family': 'Grandstander, sans-serif' });
    pt.textContent = 'PRIZE';
    svg.append(pt);
    svg.append(S('path', { d: 'M482,412 L494,428 L506,412 Z', fill: '#C2477F' }));
    // the claw (drawn above the prizes)
    layer.cable = S('line', { x1: cx, y1: 135, x2: cx, y2: cy - 10, stroke: INK, 'stroke-width': 3 });
    layer.claw = S('g');
    layer.left = S('g'); layer.right = S('g');
    const prong = side => S('path', { d: 'M0,8 C' + (side * 20) + ',18 ' + (side * 24) + ',34 ' + (side * 12) + ',46 L' + (side * 6) + ',42', fill: 'none', stroke: INK, 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
    layer.left.append(prong(-1)); layer.right.append(prong(1));
    layer.claw.append(layer.left, layer.right);
    layer.claw.append(S('rect', { x: -16, y: -12, width: 32, height: 22, rx: 7, fill: '#B9C3D6', stroke: INK, 'stroke-width': 3 }));
    layer.claw.append(S('circle', { cx: 0, cy: -1, r: 4, fill: '#FFD84D', stroke: INK, 'stroke-width': 1.5 }));
    layer.carry = S('g');
    svg.append(layer.cable, layer.carry, layer.claw);
    // glass gleam on top of everything inside
    svg.append(S('path', { d: 'M90,124 L170,124 L80,300 L64,300 Z', fill: '#FFFFFF', opacity: 0.35, 'pointer-events': 'none' }));
    // front panel and prize door
    svg.append(S('rect', { x: 60, y: 492, width: 480, height: 72, rx: 14, fill: '#C2477F', stroke: INK, 'stroke-width': 3 }));
    svg.append(S('rect', { x: 452, y: 500, width: 84, height: 56, rx: 10, fill: INK }));
    layer.door = S('g');
    svg.append(layer.door);
    const coin = S('text', { x: 250, y: 535, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, fill: '#FFF1B8', 'font-family': 'Lexend, sans-serif' });
    coin.textContent = 'Win prizes for your critter!';
    svg.append(coin);
    drawClaw();
  }
  function star(x, y, r) {
    let d = '';
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + (x + rr * Math.cos(a)).toFixed(1) + ',' + (y + rr * Math.sin(a)).toFixed(1); }
    return d + 'Z';
  }
  function drawClaw(sway) {
    const rot = sway || 0;
    layer.claw.setAttribute('transform', 'translate(' + cx + ',' + cy + ') rotate(' + rot + ')');
    layer.cable.setAttribute('x1', cx); layer.cable.setAttribute('x2', cx); layer.cable.setAttribute('y2', cy - 10);
    const a = 6 + open * 24;
    layer.left.setAttribute('transform', 'rotate(' + a + ' 0 6)');
    layer.right.setAttribute('transform', 'rotate(' + (-a) + ' 0 6)');
    if (carry) carry.node.setAttribute('transform', 'translate(' + cx + ',' + (cy + 46) + ') rotate(' + rot + ')');
  }

  // Prize pile: the prizes this student hasn't won yet
  const SPOTS = [[100, 442], [154, 442], [208, 442], [262, 442], [316, 442], [370, 442], [420, 442], [127, 398], [181, 398], [235, 398], [289, 398], [343, 398], [397, 398]];
  function fillPile() {
    const left = items.filter(i => i.kind === 'accessory' && owned.indexOf(i.itemId) < 0 && RealmSprites.accessory(i.itemId));
    for (let i = left.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = left[i]; left[i] = left[j]; left[j] = t; }
    pile = left.slice(0, SPOTS.length).map((it, i) => ({ item: it, x: SPOTS[i][0], y: SPOTS[i][1] }));
    // back row first so the front row draws on top
    layer.prizes.replaceChildren();
    pile.slice().sort((a, b) => a.y - b.y).forEach(p => {
      p.node = S('g');
      const inner = S('g', { class: 'prize-idle', transform: 'scale(1.3)' });
      inner.append(S('ellipse', { cx: 0, cy: 18, rx: 18, ry: 4, fill: INK, opacity: 0.12 }));
      inner.append(RealmSprites.prizeG(p.item.itemId));
      p.node.append(inner);
      p.node.setAttribute('transform', 'translate(' + p.x + ',' + p.y + ')');
      layer.prizes.append(p.node);
    });
  }
  function prizeUnderClaw() {
    const near = pile.filter(p => Math.abs(p.x - cx) <= 26);
    near.sort((a, b) => b.y - a.y || Math.abs(a.x - cx) - Math.abs(b.x - cx));
    return near[0] || null;
  }

  /* ── Panel ── */

  function renderPanel() {
    const winRate = Number(claw.winRate) || 0;
    $('#odds').textContent = winRate > 0
      ? 'Each try costs ' + claw.cost + ' ' + C.pointsName + '. About 1 in ' + Math.round(1 / winRate) + ' grabs wins a prize. Grabbing nothing never wins, so aim carefully!'
      : 'Each try costs ' + claw.cost + ' ' + C.pointsName + '.';
    const pity = Number(claw.pityAfter) || 0;
    $('#luckyBox').hidden = !pity;
    if (pity) {
      const m = Math.min(claw.misses || 0, pity);
      $('#lucky').replaceChildren(...Array.from({ length: pity }, (_, i) => el('span', i < m ? 'on' : '')));
      $('#luckyCount').textContent = m + ' of ' + pity;
      $('#luckyNote').textContent = 'Every miss fills one spot. When the meter is full, your next grab on a prize always wins!';
    }
    $('#plays').textContent = claw.playsLeft == null ? '' : claw.playsLeft === 1 ? '1 play left today.' : claw.playsLeft + ' plays left today.';
    const btn = $('#playBtn');
    const why = !pile.length ? 'empty' : claw.playsLeft === 0 ? 'limit' : balance < claw.cost ? 'gems' : '';
    btn.disabled = mode !== 'idle' || !!why;
    btn.textContent = why === 'gems' ? 'Need ' + (claw.cost - balance) + ' more ' + C.pointsName
      : why === 'limit' ? 'Come back tomorrow!' : why === 'empty' ? 'Machine empty!' : 'Play for ' + claw.cost + ' ' + C.pointsName;
  }
  function controls(on) {
    ['#leftBtn', '#rightBtn', '#dropBtn'].forEach(s => { $(s).disabled = !on; });
  }

  /* ── Playing ── */

  function insertCoin() {
    if (mode !== 'idle') return;
    mode = 'steer';
    $('#reveal').hidden = true;
    RealmFX.correct();
    status('Steer the claw over a prize, then press DROP!');
    controls(true);
    renderPanel();
    timeLeft = TIME;
    $('#timer').textContent = timeLeft;
    clearInterval(timerId);
    timerId = setInterval(() => {
      timeLeft--;
      $('#timer').textContent = Math.max(0, timeLeft);
      if (timeLeft <= 0) dropClaw();
    }, 1000);
    requestAnimationFrame(steerLoop);
    $('#dropBtn').focus();
  }

  let lastT = 0;
  function steerLoop(now) {
    if (mode !== 'steer') return;
    const dt = lastT ? Math.min(0.05, (now - lastT) / 1000) : 0;
    lastT = now;
    if (dir) {
      cx = Math.max(MIN_X, Math.min(MAX_X, cx + dir * SPEED * dt));
      if (now - lastWhirr > 240) { RealmFX.whirr(260); lastWhirr = now; }
      drawClaw(-dir * 3);
    } else drawClaw();
    requestAnimationFrame(steerLoop);
  }

  async function dropClaw() {
    if (mode !== 'steer') return;
    mode = 'busy';
    clearInterval(timerId);
    $('#timer').textContent = '';
    dir = 0; lastT = 0;
    controls(false);
    renderPanel();
    const target = prizeUnderClaw();
    const asked = MathRealm.claw(target ? target.item.itemId : '');   // the server decides while the claw drops
    status('Here goes...');
    const depth = target ? target.y - 48 : 404;
    RealmFX.whirr(1100);
    await tween(1100, k => { cy = lerp(REST_Y, depth, k); drawClaw(); }, ease);
    RealmFX.grab();
    await tween(320, k => { open = 1 - k; drawClaw(); });
    RealmMusic.duck(true);
    RealmFX.drumroll(1300);
    const [res] = await Promise.all([asked, wait(1300)]);

    if (!res.ok) {
      await tween(300, k => { open = k; drawClaw(); });
      await tween(900, k => { cy = lerp(depth, REST_Y, k); drawClaw(); }, ease);
      cx = HOME_X; drawClaw();
      RealmMusic.duck(false);
      status(MathRealm.errorMessage(res.error, true), 'miss');
      if (res.error === 'claw_limit') claw.playsLeft = 0;
      mode = 'idle';
      renderPanel();
      return;
    }
    setGems(res.balance);
    owned = res.owned; equipped = res.equipped;
    claw.misses = res.misses; claw.playsLeft = res.playsLeft;

    if (res.win) await winRun(target, depth, res.item);
    else await loseRun(target, depth);
    RealmMusic.duck(false);
    mode = 'idle';
    renderPanel();
  }

  function attach(p) {
    carry = p;
    layer.carry.append(p.node);   // draw it with the claw
    drawClaw();
  }
  function detach() {
    const p = carry;
    carry = null;
    if (p) layer.prizes.append(p.node);
    return p;
  }
  async function fallTo(p, x, fromY, toY) {
    await tween(420, k => p.node.setAttribute('transform', 'translate(' + x + ',' + lerp(fromY, toY, k * k) + ')'));
    await tween(240, k => p.node.setAttribute('transform', 'translate(' + x + ',' + (toY - Math.sin(k * Math.PI) * 14) + ')'));
    RealmFX.clunk();
  }
  async function rise(depth, ms, onStep) {
    RealmFX.whirr(ms);
    await tween(ms, k => { cy = lerp(depth, REST_Y, k); drawClaw(Math.sin(k * 18) * 2.5); if (onStep) onStep(k); }, ease);
  }
  async function toChute(ms) {
    const from = cx;
    RealmFX.whirr(ms);
    await tween(ms, k => { cx = lerp(from, HOME_X, k); drawClaw(Math.sin(k * 12) * 4); }, ease);
  }
  async function release() {
    RealmFX.grab();
    await tween(300, k => { open = k; drawClaw(); });
  }

  async function winRun(target, depth, item) {
    attach(target);
    status('It grabbed something...');
    await rise(depth, 1500);
    status('Hold on... hold on...');
    await toChute(1300);
    await release();
    const p = detach();
    await fallTo(p, HOME_X, REST_Y + 46, 470);
    p.node.remove();
    pile = pile.filter(x => x !== p);
    // pops out of the prize door
    const shown = S('g', { transform: 'translate(494,528) scale(0.9)' });
    shown.append(RealmSprites.prizeG(item.itemId));
    layer.door.replaceChildren(shown);
    RealmFX.fanfare();
    RealmFX.confetti();
    status('You won the ' + item.name + '!', 'win');
    showReveal(item);
  }

  async function loseRun(target, depth) {
    if (!target) {
      await rise(depth, 1200);
      status('The claw grabbed nothing but fluff! Line it up right over a prize.', 'miss');
      await toChute(900);
      await release();
      RealmFX.aww();
      return;
    }
    const style = Math.random() < 0.4 ? 'slip' : Math.random() < 0.45 ? 'weak' : 'edge';
    attach(target);
    if (style === 'weak') {
      status('It grabbed something...');
      let dropped = false;
      await rise(depth, 1400, k => {
        if (!dropped && k > 0.18) { dropped = true; const p = detach(); fallTo(p, p.x, cy + 46, p.y); status('Oh no, the grip was too weak!', 'miss'); RealmFX.aww(); }
      });
      await toChute(900);
      await release();
      return;
    }
    if (style === 'slip') {
      status('It grabbed something...');
      let dropped = false;
      await rise(depth, 1600, k => {
        if (!dropped && k > 0.5) { dropped = true; const p = detach(); fallTo(p, p.x, cy + 46, p.y); status('It slipped! So close...', 'miss'); RealmFX.aww(); }
      });
      await toChute(900);
      await release();
      return;
    }
    // edge: it gets almost all the way, then wobbles off
    status('It grabbed something...');
    await rise(depth, 1500);
    status('Hold on... hold on...');
    const from = cx, stopX = 438;
    RealmFX.whirr(1000);
    await tween(1000, k => { cx = lerp(from, stopX, k); drawClaw(Math.sin(k * 10) * 4); }, ease);
    RealmFX.drumroll(900);
    await tween(900, k => drawClaw(Math.sin(k * Math.PI * 6) * 9));
    const p = detach();
    p.x = 420; p.y = 442;
    await fallTo(p, p.x, cy + 46, p.y);
    status('SO close! It wobbled right off the edge!', 'miss');
    RealmFX.aww();
    await toChute(500);
    await release();
  }

  /* ── The prize reveal ── */

  function showReveal(item) {
    const box = $('#reveal');
    box.replaceChildren();
    const slot = RealmSprites.accessory(item.itemId).slot;
    const pet = equipped.avatar ? RealmSprites.critter(equipped.avatar) : null;
    const big = el('div', 'big');
    big.append(RealmSprites.prizeSvg(item.itemId));
    box.append(el('h2', '', 'You won!'), big, el('p', '', 'New ' + SLOT_WORD[slot] + ' for your collection: ' + item.name + '.'));
    const row = el('div', 'row');
    if (pet) {
      const put = el('button', 'btn', 'Put it on ' + pet.name);
      put.type = 'button';
      put.addEventListener('click', async () => {
        put.disabled = true;
        const d = await MathRealm.equip(slot, item.itemId);
        if (!d.ok) { put.disabled = false; status(MathRealm.errorMessage(d.error, true)); return; }
        equipped = d.equipped;
        const outfit = {};
        RealmSprites.SLOTS.forEach(s => { if (equipped[s]) outfit[s] = equipped[s]; });
        const wear = el('div', 'wear');
        wear.append(RealmSprites.critterSvg(pet, 'idle', outfit));
        big.replaceWith(wear);
        put.remove();
        RealmFX.correct();
        status(pet.name + ' is wearing the ' + item.name + '!', 'win');
      });
      row.append(put);
    } else {
      box.append(el('p', '', 'Pick an avatar critter in the shop, and then you can dress it up!'));
    }
    const again = el('button', 'btn btn-soft', 'Keep playing');
    again.type = 'button';
    again.addEventListener('click', () => { box.hidden = true; layer.door.replaceChildren(); });
    row.append(again);
    box.append(row);
    box.hidden = false;
  }

  /* ── Controls ── */

  function hold(btn, d) {
    const on = e => { e.preventDefault(); if (mode === 'steer') { dir = d; btn.classList.add('held'); } };
    const off = () => { if (dir === d) dir = 0; btn.classList.remove('held'); };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointerleave', off);
    btn.addEventListener('pointercancel', off);
  }
  hold($('#leftBtn'), -1);
  hold($('#rightBtn'), 1);
  $('#dropBtn').addEventListener('click', dropClaw);
  $('#playBtn').addEventListener('click', insertCoin);
  document.addEventListener('keydown', e => {
    if (mode !== 'steer') return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); dir = -1; }
    else if (e.key === 'ArrowRight') { e.preventDefault(); dir = 1; }
    else if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); dropClaw(); }
  });
  document.addEventListener('keyup', e => {
    if ((e.key === 'ArrowLeft' && dir === -1) || (e.key === 'ArrowRight' && dir === 1)) dir = 0;
  });

  /* ── Start ── */

  build();
  setGems((MathRealm.student || {}).points || 0);
  MathRealm.shop().then(d => {
    if (!d.ok) { status(MathRealm.errorMessage(d.error, true), 'miss'); return; }
    items = d.items; owned = d.owned; equipped = d.equipped; claw = d.claw || {};
    setGems(d.balance);
    fillPile();
    mode = 'idle';
    status(pile.length ? (RealmFX.soundOn ? 'Ready! Press Play to start.' : 'Ready! Press Play to start. (Turn on Sounds for the full arcade experience.)')
      : "You've won every prize in the machine. Amazing!");
    renderPanel();
  });
})();
