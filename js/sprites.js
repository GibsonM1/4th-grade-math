/*
 * Math Realm: sprites (shared by the Sprite Shop, the Critter Café, the map and the race)
 *
 *   RealmSprites.critters                 every critter: the 5 starters everyone has, plus shop critters
 *   RealmSprites.critter(id)              one critter { id, name, species, plural, food, color, dot, draw }
 *   RealmSprites.critterSvg(critter, cls) an <svg> of it (feet at the bottom)
 *   RealmSprites.cafeCritters(session)    starters + critters this student has adopted
 *   RealmSprites.unicornStyle(id)         { body, mane, mane2, horn, eye } colors for the race unicorn
 *   RealmSprites.unicornSvg(style)        an <svg> of a unicorn in that style (for the shop)
 *
 * All drawings are original. Critters are drawn facing forward, feet at y = 0,
 * inside the box x -62..62, y -132..4.
 */
(function () {
  'use strict';
  const INK = '#2A1F45';
  function S(tag, attrs) {
    const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
    Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k]));
    return e;
  }

  /* ── Starter critters (moved here unchanged from the Critter Café) ── */

  const line = { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' };
  const fill = (f, extra) => Object.assign({ fill: f }, line, extra || {});
  function eyes(g, y, dx) {
    [-dx, dx].forEach(x => {
      g.append(S('circle', { cx: x, cy: y, r: 3.4, fill: INK }));
      g.append(S('circle', { cx: x + 1.1, cy: y - 1.2, r: 1.1, fill: '#fff' }));
    });
  }
  function cheeks(g, y, dx) {
    [-dx, dx].forEach(x => g.append(S('ellipse', { cx: x, cy: y, rx: 4.5, ry: 2.6, fill: '#FF9CC8', opacity: 0.75 })));
  }
  function smile(g, y) {
    g.append(S('path', { d: 'M-5,' + y + ' Q-2.5,' + (y + 3) + ' 0,' + (y - 0.5) + ' Q2.5,' + (y + 3) + ' 5,' + y, fill: 'none', stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' }));
  }
  function drawBunny(g) {
    const body = '#EDE6FA';
    [[-11, -10], [11, 10]].forEach(([x, r]) => {
      g.append(S('ellipse', fill(body, { cx: x, cy: -104, rx: 8, ry: 24, transform: 'rotate(' + r + ' ' + x + ' -104)' })));
      g.append(S('ellipse', { cx: x, cy: -102, rx: 3.6, ry: 16, fill: '#FFC2DD', transform: 'rotate(' + r + ' ' + x + ' -102)' }));
    });
    g.append(S('ellipse', fill(body, { cx: -14, cy: -5, rx: 12, ry: 6 })));
    g.append(S('ellipse', fill(body, { cx: 14, cy: -5, rx: 12, ry: 6 })));
    g.append(S('ellipse', fill(body, { cx: 0, cy: -32, rx: 28, ry: 28 })));
    g.append(S('ellipse', { cx: 0, cy: -27, rx: 16, ry: 18, fill: '#FFFFFF' }));
    g.append(S('ellipse', fill(body, { cx: -11, cy: -13, rx: 7, ry: 5 })));
    g.append(S('ellipse', fill(body, { cx: 11, cy: -13, rx: 7, ry: 5 })));
    g.append(S('circle', fill(body, { cx: 0, cy: -70, r: 24 })));
    eyes(g, -73, 9);
    cheeks(g, -63, 15);
    g.append(S('ellipse', { cx: 0, cy: -65, rx: 3.6, ry: 2.6, fill: '#FF7EB6' }));
    smile(g, -60);
  }
  function drawPuppy(g) {
    const body = '#E8B877', light = '#FFF4E2', ear = '#9C6234';
    g.append(S('ellipse', fill(body, { cx: -14, cy: -5, rx: 12, ry: 6 })));
    g.append(S('ellipse', fill(body, { cx: 14, cy: -5, rx: 12, ry: 6 })));
    g.append(S('ellipse', fill(body, { cx: 0, cy: -31, rx: 27, ry: 28 })));
    g.append(S('ellipse', { cx: 0, cy: -27, rx: 14, ry: 16, fill: light }));
    g.append(S('circle', fill(body, { cx: 0, cy: -70, r: 25 })));
    g.append(S('path', fill(ear, { d: 'M-18,-88 C-36,-88 -42,-62 -33,-48 C-26,-50 -21,-62 -17,-74 Z' })));
    g.append(S('path', fill(ear, { d: 'M18,-88 C36,-88 42,-62 33,-48 C26,-50 21,-62 17,-74 Z' })));
    g.append(S('ellipse', { cx: 9, cy: -77, rx: 7.5, ry: 6.5, fill: '#C98F4E' }));
    eyes(g, -76, 9);
    g.append(S('ellipse', { cx: 0, cy: -62, rx: 11, ry: 8, fill: light }));
    g.append(S('ellipse', { cx: 0, cy: -66, rx: 4.6, ry: 3.2, fill: INK }));
    smile(g, -60);
    g.append(S('rect', fill('#D2448A', { x: -16, y: -49, width: 32, height: 6, rx: 3 })));
    g.append(S('circle', fill('#FFD84D', { cx: 0, cy: -40, r: 3.8, 'stroke-width': 1.5 })));
  }
  function drawKitten(g) {
    const body = '#FFB067', light = '#FFF0DE';
    g.append(S('path', { d: 'M20,-14 C44,-18 46,-48 32,-58', fill: 'none', stroke: INK, 'stroke-width': 11, 'stroke-linecap': 'round' }));
    g.append(S('path', { d: 'M20,-14 C44,-18 46,-48 32,-58', fill: 'none', stroke: body, 'stroke-width': 7, 'stroke-linecap': 'round' }));
    g.append(S('ellipse', fill(body, { cx: -13, cy: -5, rx: 11, ry: 6 })));
    g.append(S('ellipse', fill(body, { cx: 13, cy: -5, rx: 11, ry: 6 })));
    g.append(S('ellipse', fill(body, { cx: 0, cy: -31, rx: 25, ry: 28 })));
    g.append(S('ellipse', { cx: 0, cy: -27, rx: 13, ry: 16, fill: light }));
    g.append(S('path', fill(body, { d: 'M-23,-78 L-19,-103 L-3,-91 Z' })));
    g.append(S('path', fill(body, { d: 'M23,-78 L19,-103 L3,-91 Z' })));
    g.append(S('path', { d: 'M-19,-83 L-17,-97 L-9,-90 Z', fill: '#FFC2DD' }));
    g.append(S('path', { d: 'M19,-83 L17,-97 L9,-90 Z', fill: '#FFC2DD' }));
    g.append(S('circle', fill(body, { cx: 0, cy: -70, r: 24 })));
    g.append(S('path', { d: 'M-6,-93 L-4,-85 M0,-94 L0,-86 M6,-93 L4,-85', stroke: '#D9792E', 'stroke-width': 3, 'stroke-linecap': 'round' }));
    eyes(g, -72, 9);
    cheeks(g, -62, 15);
    g.append(S('path', { d: 'M-3.5,-66 L3.5,-66 L0,-62.5 Z', fill: '#FF7EB6' }));
    smile(g, -60);
    g.append(S('path', { d: 'M-9,-63 L-27,-67 M-9,-60 L-27,-58 M9,-63 L27,-67 M9,-60 L27,-58', stroke: INK, 'stroke-width': 1.4, 'stroke-linecap': 'round' }));
  }
  function drawTurtle(g) {
    const skin = '#A9DC8E';
    g.append(S('ellipse', fill(skin, { cx: -28, cy: -8, rx: 11, ry: 7 })));
    g.append(S('ellipse', fill(skin, { cx: 28, cy: -8, rx: 11, ry: 7 })));
    g.append(S('path', fill('#4FB07A', { d: 'M-44,-16 C-44,-70 44,-70 44,-16 Z' })));
    g.append(S('path', { d: 'M-12,-40 L0,-48 L12,-40 L12,-27 L0,-21 L-12,-27 Z M-36,-24 L-22,-28 L-18,-40 L-28,-50 M36,-24 L22,-28 L18,-40 L28,-50', fill: '#7BCB98', stroke: '#2F7A50', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }));
    g.append(S('rect', fill('#3E8F62', { x: -48, y: -20, width: 96, height: 10, rx: 5 })));
    g.append(S('circle', fill(skin, { cx: 0, cy: -70, r: 20 })));
    eyes(g, -72, 7);
    cheeks(g, -64, 12);
    smile(g, -63);
  }
  // Comet, the same unicorn as on the Unicorn Racetrack
  function drawUnicorn(g) {
    const pal = { body: '#EAF4FF', mane: '#4FD1AB', mane2: '#7CC8FF' };
    const u = S('g', { transform: 'translate(-2,0) scale(1.05)' });
    [-24, -12, 12, 24].forEach(x => u.append(S('rect', { x: x - 3.5, y: -24, width: 7, height: 24, rx: 3.5, fill: pal.body, stroke: INK, 'stroke-width': 2 })));
    u.append(S('path', fill(pal.mane, { d: 'M-26,-38 C-46,-42 -52,-22 -42,-10 C-40,-24 -34,-28 -24,-30 Z' })));
    u.append(S('ellipse', fill(pal.body, { cx: 0, cy: -36, rx: 30, ry: 16 })));
    u.append(S('path', fill(pal.body, { d: 'M14,-44 C18,-58 22,-64 28,-68 L40,-60 C33,-54 29,-46 27,-34 Z' })));
    u.append(S('path', fill(pal.body, { d: 'M25,-72 C33,-80 49,-76 54,-65 C56,-58 50,-55 43,-57 L30,-56 Z' })));
    u.append(S('path', fill(pal.body, { d: 'M29,-74 L31,-85 L37,-75 Z' })));
    u.append(S('path', fill(pal.mane2, { d: 'M27,-74 C15,-72 18,-62 9,-58 C16,-56 11,-48 5,-45 C12,-45 18,-49 22,-52 C19,-58 25,-64 31,-68 Z' })));
    u.append(S('path', fill('#FFD84D', { d: 'M37,-76 L46,-98 L42,-74 Z' })));
    u.append(S('circle', { cx: 42, cy: -66, r: 2.4, fill: INK }));
    u.append(S('ellipse', { cx: 47, cy: -60, rx: 3.2, ry: 2, fill: '#FF9CC8', opacity: 0.85 }));
    g.append(u);
  }

  /* ── Shop critters ── */

  function feetAndBody(g, body, light, opts) {
    const o = opts || {};
    g.append(S('ellipse', fill(o.feet || body, { cx: -14, cy: -5, rx: 12, ry: 6 })));
    g.append(S('ellipse', fill(o.feet || body, { cx: 14, cy: -5, rx: 12, ry: 6 })));
    g.append(S('ellipse', fill(body, { cx: 0, cy: -31, rx: o.rx || 26, ry: o.ry || 28 })));
    if (light) g.append(S('ellipse', { cx: 0, cy: -27, rx: (o.rx || 26) * 0.52, ry: 16, fill: light }));
  }
  function drawFox(g) {
    const body = '#F08A3C', light = '#FFF3E6';
    g.append(S('path', fill(body, { d: 'M18,-16 C46,-14 56,-46 40,-66 C40,-48 32,-34 20,-30 Z' })));
    g.append(S('path', fill(light, { d: 'M44,-60 C40,-66 38,-70 40,-66 C48,-58 50,-50 46,-44 C46,-50 46,-56 44,-60 Z' })));
    g.append(S('path', fill(light, { d: 'M40,-66 C30,-58 46,-46 48,-52 C52,-60 46,-68 40,-66 Z' })));
    feetAndBody(g, body, light, { feet: '#3A2A3F' });
    g.append(S('path', fill(body, { d: 'M-24,-80 L-20,-110 L-2,-92 Z' })));
    g.append(S('path', fill(body, { d: 'M24,-80 L20,-110 L2,-92 Z' })));
    g.append(S('path', { d: 'M-21,-101 L-20,-110 L-14,-104 Z M21,-101 L20,-110 L14,-104 Z', fill: INK }));
    g.append(S('circle', fill(body, { cx: 0, cy: -70, r: 24 })));
    g.append(S('path', { d: 'M-22,-66 C-14,-56 -6,-52 0,-52 C6,-52 14,-56 22,-66 C16,-60 8,-60 0,-62 C-8,-60 -16,-60 -22,-66 Z', fill: light }));
    eyes(g, -74, 9);
    g.append(S('ellipse', { cx: 0, cy: -63, rx: 4, ry: 3, fill: INK }));
    smile(g, -58);
  }
  function drawHamster(g) {
    const body = '#F4C27A', light = '#FFF6E8';
    g.append(S('ellipse', fill(body, { cx: -14, cy: -4, rx: 10, ry: 5 })));
    g.append(S('ellipse', fill(body, { cx: 14, cy: -4, rx: 10, ry: 5 })));
    g.append(S('ellipse', fill(body, { cx: 0, cy: -38, rx: 33, ry: 34 })));
    g.append(S('ellipse', { cx: 0, cy: -28, rx: 20, ry: 20, fill: light }));
    [-1, 1].forEach(sx => {
      g.append(S('circle', fill(body, { cx: sx * 21, cy: -77, r: 9 })));
      g.append(S('circle', { cx: sx * 21, cy: -77, r: 4.5, fill: '#FFC2DD' }));
    });
    g.append(S('ellipse', { cx: -19, cy: -52, rx: 10, ry: 8, fill: light }));
    g.append(S('ellipse', { cx: 19, cy: -52, rx: 10, ry: 8, fill: light }));
    eyes(g, -60, 11);
    cheeks(g, -50, 18);
    g.append(S('ellipse', { cx: 0, cy: -53, rx: 3, ry: 2.2, fill: '#FF7EB6' }));
    smile(g, -48);
    g.append(S('ellipse', fill('#8C6A3E', { cx: 0, cy: -30, rx: 5, ry: 7 })));
    g.append(S('ellipse', fill(body, { cx: -7, cy: -30, rx: 5, ry: 4 })));
    g.append(S('ellipse', fill(body, { cx: 7, cy: -30, rx: 5, ry: 4 })));
  }
  function drawFrog(g) {
    const body = '#7BD36F', light = '#DDF5C9';
    g.append(S('ellipse', fill(body, { cx: -20, cy: -5, rx: 14, ry: 6 })));
    g.append(S('ellipse', fill(body, { cx: 20, cy: -5, rx: 14, ry: 6 })));
    g.append(S('ellipse', fill(body, { cx: 0, cy: -38, rx: 36, ry: 32 })));
    g.append(S('ellipse', { cx: 0, cy: -26, rx: 22, ry: 17, fill: light }));
    [-1, 1].forEach(sx => {
      g.append(S('circle', fill(body, { cx: sx * 17, cy: -70, r: 13 })));
      g.append(S('circle', { cx: sx * 17, cy: -70, r: 8, fill: '#fff', stroke: INK, 'stroke-width': 1.6 }));
      g.append(S('circle', { cx: sx * 17 + 1, cy: -69, r: 4, fill: INK }));
    });
    cheeks(g, -46, 22);
    g.append(S('path', { d: 'M-16,-50 Q0,-38 16,-50', fill: 'none', stroke: INK, 'stroke-width': 2.2, 'stroke-linecap': 'round' }));
    g.append(S('path', { d: 'M-8,-84 Q0,-90 8,-84', fill: 'none', stroke: '#F2C94C', 'stroke-width': 4, 'stroke-linecap': 'round' }));
  }
  function drawOwl(g) {
    const body = '#9C7BD6', face = '#F3EBFF', beak = '#F2A93B';
    g.append(S('ellipse', fill(beak, { cx: -10, cy: -3, rx: 7, ry: 4 })));
    g.append(S('ellipse', fill(beak, { cx: 10, cy: -3, rx: 7, ry: 4 })));
    g.append(S('ellipse', fill(body, { cx: 0, cy: -44, rx: 32, ry: 42 })));
    g.append(S('path', fill('#7E5CBF', { d: 'M-31,-48 C-44,-34 -40,-14 -26,-10 C-26,-24 -26,-36 -31,-48 Z' })));
    g.append(S('path', fill('#7E5CBF', { d: 'M31,-48 C44,-34 40,-14 26,-10 C26,-24 26,-36 31,-48 Z' })));
    g.append(S('path', { d: 'M-12,-30 l4,4 l4,-4 M2,-30 l4,4 l4,-4 M-6,-20 l4,4 l4,-4', fill: 'none', stroke: '#E9DDFF', 'stroke-width': 2, 'stroke-linecap': 'round' }));
    g.append(S('path', fill(body, { d: 'M-26,-74 L-30,-98 L-12,-82 Z' })));
    g.append(S('path', fill(body, { d: 'M26,-74 L30,-98 L12,-82 Z' })));
    [-1, 1].forEach(sx => {
      g.append(S('circle', fill(face, { cx: sx * 13, cy: -66, r: 13 })));
      g.append(S('circle', { cx: sx * 13, cy: -66, r: 6, fill: INK }));
      g.append(S('circle', { cx: sx * 13 + 2, cy: -68, r: 2, fill: '#fff' }));
    });
    g.append(S('path', fill(beak, { d: 'M-5,-56 L5,-56 L0,-47 Z' })));
  }
  function drawHedgehog(g) {
    const spikes = '#7A5A44', face = '#F7E1C6';
    let d = 'M-40,-14';
    for (let i = 0; i <= 12; i++) {
      const a = Math.PI + i * Math.PI / 12, r = i % 2 ? 46 : 38;
      d += ' L' + (Math.cos(a) * r).toFixed(1) + ',' + (-30 + Math.sin(a) * r * 1.15).toFixed(1);
    }
    g.append(S('path', fill(spikes, { d: d + ' L40,-14 Z' })));
    g.append(S('ellipse', fill(face, { cx: -13, cy: -5, rx: 10, ry: 5 })));
    g.append(S('ellipse', fill(face, { cx: 13, cy: -5, rx: 10, ry: 5 })));
    g.append(S('ellipse', fill(face, { cx: 0, cy: -38, rx: 24, ry: 26 })));
    g.append(S('circle', fill(face, { cx: -22, cy: -58, r: 6 })));
    g.append(S('circle', fill(face, { cx: 22, cy: -58, r: 6 })));
    eyes(g, -44, 9);
    cheeks(g, -34, 15);
    g.append(S('circle', { cx: 0, cy: -36, r: 4, fill: INK }));
    smile(g, -30);
  }
  function drawPanda(g) {
    const white = '#FFFFFF', black = '#2F2A3A';
    g.append(S('ellipse', fill(black, { cx: -14, cy: -5, rx: 12, ry: 6 })));
    g.append(S('ellipse', fill(black, { cx: 14, cy: -5, rx: 12, ry: 6 })));
    g.append(S('ellipse', fill(white, { cx: 0, cy: -32, rx: 28, ry: 28 })));
    g.append(S('ellipse', fill(black, { cx: -22, cy: -34, rx: 8, ry: 13, transform: 'rotate(20 -22 -34)' })));
    g.append(S('ellipse', fill(black, { cx: 22, cy: -34, rx: 8, ry: 13, transform: 'rotate(-20 22 -34)' })));
    g.append(S('circle', fill(black, { cx: -20, cy: -90, r: 9 })));
    g.append(S('circle', fill(black, { cx: 20, cy: -90, r: 9 })));
    g.append(S('circle', fill(white, { cx: 0, cy: -70, r: 25 })));
    g.append(S('ellipse', { cx: -10, cy: -72, rx: 7, ry: 9, fill: black, transform: 'rotate(25 -10 -72)' }));
    g.append(S('ellipse', { cx: 10, cy: -72, rx: 7, ry: 9, fill: black, transform: 'rotate(-25 10 -72)' }));
    [-10, 10].forEach(x => { g.append(S('circle', { cx: x, cy: -73, r: 2.6, fill: '#fff' })); });
    cheeks(g, -62, 16);
    g.append(S('ellipse', { cx: 0, cy: -63, rx: 3.6, ry: 2.6, fill: black }));
    smile(g, -58);
  }
  function drawAxolotl(g) {
    const body = '#FFB3D1', gill = '#FF6FA8', light = '#FFE3EF';
    g.append(S('path', fill(body, { d: 'M14,-14 C36,-10 48,-26 46,-40 C40,-30 30,-26 18,-28 Z' })));
    g.append(S('ellipse', fill(body, { cx: -14, cy: -5, rx: 10, ry: 5 })));
    g.append(S('ellipse', fill(body, { cx: 14, cy: -5, rx: 10, ry: 5 })));
    g.append(S('ellipse', fill(body, { cx: 0, cy: -27, rx: 22, ry: 22 })));
    g.append(S('ellipse', { cx: 0, cy: -24, rx: 12, ry: 13, fill: light }));
    [-1, 1].forEach(sx => {
      [[-84, -18], [-72, 0], [-60, 18]].forEach(([y, rot]) => {
        g.append(S('ellipse', fill(gill, { cx: sx * 34, cy: y, rx: 12, ry: 5, transform: 'rotate(' + (sx * rot) + ' ' + (sx * 34) + ' ' + y + ')' })));
      });
    });
    g.append(S('ellipse', fill(body, { cx: 0, cy: -68, rx: 30, ry: 23 })));
    eyes(g, -70, 13);
    cheeks(g, -60, 20);
    g.append(S('path', { d: 'M-9,-58 Q0,-51 9,-58', fill: 'none', stroke: INK, 'stroke-width': 2, 'stroke-linecap': 'round' }));
  }
  function drawDragon(g) {
    const body = '#9B7BF0', belly = '#FFE9A8', wing = '#C9A8FF';
    g.append(S('path', fill(body, { d: 'M18,-14 C40,-10 52,-24 50,-38 L58,-42 L52,-30 C48,-18 36,-6 18,-8 Z' })));
    [-1, 1].forEach(sx => g.append(S('path', fill(wing, { d: 'M' + (sx * 18) + ',-44 L' + (sx * 50) + ',-70 L' + (sx * 46) + ',-52 L' + (sx * 54) + ',-46 L' + (sx * 40) + ',-36 Z' }))));
    feetAndBody(g, body, belly);
    g.append(S('path', { d: 'M-8,-38 L8,-38 M-9,-30 L9,-30 M-8,-22 L8,-22', stroke: '#E8C468', 'stroke-width': 2, 'stroke-linecap': 'round' }));
    g.append(S('path', fill('#FFD84D', { d: 'M-16,-86 L-20,-104 L-8,-92 Z' })));
    g.append(S('path', fill('#FFD84D', { d: 'M16,-86 L20,-104 L8,-92 Z' })));
    g.append(S('circle', fill(body, { cx: 0, cy: -70, r: 24 })));
    g.append(S('path', fill('#7C5CD6', { d: 'M-4,-94 L0,-102 L4,-94 Z' })));
    eyes(g, -73, 9);
    cheeks(g, -63, 15);
    g.append(S('ellipse', { cx: -4, cy: -64, rx: 1.6, ry: 1.2, fill: INK }));
    g.append(S('ellipse', { cx: 4, cy: -64, rx: 1.6, ry: 1.2, fill: INK }));
    smile(g, -59);
  }

  const critters = [
    { id: 'bunbun',   name: 'Bun-bun',  species: 'bunny',       plural: 'bunnies',      food: 'berries',          color: '#C2477F', dot: '#7E2A5A', draw: drawBunny,    starter: true , anchors: { hat: [0, -92, 30], face: [0, -73, 9], neck: [0, -46, 30], wrist: [-11, -13, 11], feet: [[-14, -5, 24], [14, -5, 24]] } },
    { id: 'comet',    name: 'Comet',    species: 'unicorn',     plural: 'unicorns',     food: 'sparkle oats',     color: '#F2C94C', dot: '#FFFFFF', draw: drawUnicorn,  starter: true , anchors: { hat: [29, -82, 18], face: [42, -69, 0], neck: [22, -50, 18], wrist: [11, -12, 8], feet: [[-27, -2, 10], [-15, -2, 10], [11, -2, 10], [23, -2, 10]] } },
    { id: 'pip',      name: 'Pip',      species: 'puppy',       plural: 'puppies',      food: 'kibble',           color: '#B07A45', dot: '#7A4E26', draw: drawPuppy,    starter: true , anchors: { hat: [0, -94, 32], face: [0, -76, 9], neck: [0, -42, 30], wrist: [-17, -20, 11], feet: [[-14, -5, 24], [14, -5, 24]] } },
    { id: 'miso',     name: 'Miso',     species: 'kitten',      plural: 'kittens',      food: 'fish crunchies',   color: '#F08A4B', dot: '#B85A22', draw: drawKitten,   starter: true , anchors: { hat: [0, -93, 26], face: [0, -72, 9], neck: [0, -46, 28], wrist: [-14, -18, 11], feet: [[-13, -5, 22], [13, -5, 22]] } },
    { id: 'shelly',   name: 'Shelly',   species: 'turtle',      plural: 'turtles',      food: 'lettuce',          color: '#79C25A', dot: '#3F8A2E', draw: drawTurtle,   starter: true , anchors: { hat: [0, -89, 26], face: [0, -72, 7], neck: [0, -51, 22], wrist: [-28, -11, 12], feet: [[-28, -8, 22], [28, -8, 22]] } },
    { id: 'ember',    name: 'Ember',    species: 'fox',         plural: 'foxes',        food: 'apple slices',     color: '#E5484D', dot: '#A8262B', draw: drawFox , anchors: { hat: [0, -93, 28], face: [0, -74, 9], neck: [0, -46, 30], wrist: [-14, -16, 11], feet: [[-14, -5, 24], [14, -5, 24]] } },
    { id: 'biscuit',  name: 'Biscuit',  species: 'hamster',     plural: 'hamsters',     food: 'sunflower seeds',  color: '#8C6A3E', dot: '#5E4424', draw: drawHamster , anchors: { hat: [0, -71, 30], face: [0, -60, 11], neck: [0, -40, 34], wrist: [-8, -30, 9], feet: [[-14, -4, 20], [14, -4, 20]] } },
    { id: 'lily',     name: 'Lily',     species: 'frog',        plural: 'frogs',        food: 'bug crunchies',    color: '#5B8C2A', dot: '#3D5E1B', draw: drawFrog , anchors: { hat: [0, -76, 24], face: [0, -70, 17], neck: [0, -36, 40], wrist: [-26, -18, 12], feet: [[-20, -5, 28], [20, -5, 28]] } },
    { id: 'hoot',     name: 'Hoot',     species: 'owl',         plural: 'owls',         food: 'blueberries',      color: '#4B5BC9', dot: '#2E3A8C', draw: drawOwl , anchors: { hat: [0, -84, 30], face: [0, -66, 13], neck: [0, -44, 32], wrist: [-34, -28, 12], feet: [[-10, -3, 14], [10, -3, 14]] } },
    { id: 'prickles', name: 'Prickles', species: 'hedgehog',    plural: 'hedgehogs',    food: 'mealworm munchies', color: '#A0785A', dot: '#6E4F38', draw: drawHedgehog , anchors: { hat: [0, -63, 26], face: [0, -44, 9], neck: [0, -15, 30], wrist: [-20, -18, 10], feet: [[-13, -5, 20], [13, -5, 20]] } },
    { id: 'bao',      name: 'Bao',      species: 'panda',       plural: 'pandas',       food: 'bamboo shoots',    color: '#7DBF5A', dot: '#4E8A34', draw: drawPanda , anchors: { hat: [0, -94, 30], face: [0, -73, 10], neck: [0, -46, 30], wrist: [-25, -25, 12], feet: [[-14, -5, 24], [14, -5, 24]] } },
    { id: 'mochi',    name: 'Mochi',    species: 'axolotl',     plural: 'axolotls',     food: 'tiny shrimp',      color: '#FF7E8E', dot: '#C94656', draw: drawAxolotl , anchors: { hat: [0, -90, 28], face: [0, -70, 13], neck: [0, -45, 30], wrist: [-14, -16, 10], feet: [[-14, -5, 20], [14, -5, 20]] } },
    { id: 'sparky',   name: 'Sparky',   species: 'baby dragon', plural: 'baby dragons', food: 'fire peppers',     color: '#E5484D', dot: '#FFD84D', draw: drawDragon , anchors: { hat: [0, -93, 24], face: [0, -73, 9], neck: [0, -46, 30], wrist: [-14, -14, 11], feet: [[-14, -5, 24], [14, -5, 24]] } },
  ];

  /* ── Accessories (claw machine prizes) ──
   * Each draws around (0,0) at a nominal size, then is placed on a critter's anchor
   * [x, y, size]: hats sit on the top of the head, glasses on the eye line (size = eye spacing),
   * necklaces hang from the neck, bracelets on a paw, shoes on each foot.
   */
  const ACC = {
    'hat-crown': { slot: 'hat', draw(g) {
      g.append(S('path', fill('#FFD84D', { d: 'M-15,0 L-15,-14 L-8,-6 L0,-20 L8,-6 L15,-14 L15,0 Z' })));
      [[-8, -4, '#FF7EB6'], [0, -5, '#7CC8FF'], [8, -4, '#4FD1AB']].forEach(([x, y, c]) => g.append(S('circle', { cx: x, cy: y, r: 2.4, fill: c, stroke: INK, 'stroke-width': 1 })));
    } },
    'hat-bow': { slot: 'hat', draw(g) {
      g.append(S('path', fill('#FF7EB6', { d: 'M0,-6 C-6,-18 -20,-16 -18,-6 C-20,2 -6,4 0,-6 Z' })));
      g.append(S('path', fill('#FF7EB6', { d: 'M0,-6 C6,-18 20,-16 18,-6 C20,2 6,4 0,-6 Z' })));
      g.append(S('circle', fill('#D2448A', { cx: 0, cy: -6, r: 4 })));
    } },
    'hat-wizard': { slot: 'hat', draw(g) {
      g.append(S('path', fill('#7C5CD6', { d: 'M-13,-2 L2,-36 L13,-2 Z' })));
      g.append(S('ellipse', fill('#7C5CD6', { cx: 0, cy: -1, rx: 19, ry: 4 })));
      g.append(S('path', { d: starD(1, -16, 4.5), fill: '#FFD84D', stroke: INK, 'stroke-width': 1 }));
      g.append(S('circle', { cx: -4, cy: -8, r: 1.5, fill: '#FFD84D' }));
    } },
    'hat-flowers': { slot: 'hat', draw(g) {
      g.append(S('path', { d: 'M-15,-2 Q0,-8 15,-2', fill: 'none', stroke: '#4FB07A', 'stroke-width': 3 }));
      [[-13, -3, '#FF7EB6'], [-6, -6, '#FFD84D'], [1, -7, '#C9A8FF'], [8, -6, '#FF7EB6'], [14, -3, '#7CC8FF']].forEach(([x, y, c]) => {
        for (let k = 0; k < 5; k++) { const a = k * 2 * Math.PI / 5; g.append(S('circle', { cx: x + Math.cos(a) * 2.6, cy: y + Math.sin(a) * 2.6, r: 2.3, fill: c, stroke: INK, 'stroke-width': 0.6 })); }
        g.append(S('circle', { cx: x, cy: y, r: 1.6, fill: '#FFF1B8' }));
      });
    } },
    'hat-party': { slot: 'hat', draw(g) {
      g.append(S('path', fill('#7CC8FF', { d: 'M-11,0 L0,-28 L11,0 Z' })));
      g.append(S('path', { d: 'M-7,-10 L5,-6 M-4,-18 L3,-15', stroke: '#FF7EB6', 'stroke-width': 3, 'stroke-linecap': 'round' }));
      g.append(S('circle', fill('#FFD84D', { cx: 0, cy: -29, r: 4 })));
    } },
    'hat-beanie': { slot: 'hat', draw(g) {
      g.append(S('path', fill('#4FD1AB', { d: 'M-16,0 C-16,-20 16,-20 16,0 Z' })));
      g.append(S('rect', fill('#1E8466', { x: -17, y: -4, width: 34, height: 6, rx: 3 })));
      g.append(S('circle', fill('#FFFFFF', { cx: 0, cy: -17, r: 4.5 })));
    } },
    'face-hearts': { slot: 'face', lens(g, x, y, r) {
      g.append(S('path', { d: 'M' + x + ',' + (y + r * 0.8) + ' C' + (x - r * 1.6) + ',' + (y - r * 0.2) + ' ' + (x - r * 0.6) + ',' + (y - r * 1.2) + ' ' + x + ',' + (y - r * 0.4) +
        ' C' + (x + r * 0.6) + ',' + (y - r * 1.2) + ' ' + (x + r * 1.6) + ',' + (y - r * 0.2) + ' ' + x + ',' + (y + r * 0.8) + ' Z', fill: '#FF7EB6', 'fill-opacity': 0.75, stroke: '#D2448A', 'stroke-width': 1.8 }));
    } },
    'face-stars': { slot: 'face', lens(g, x, y, r) {
      g.append(S('path', { d: starD(x, y, r * 1.15), fill: '#FFD84D', 'fill-opacity': 0.8, stroke: '#B9810A', 'stroke-width': 1.6 }));
    } },
    'neck-pearls': { slot: 'neck', drawW(g, w) {
      const n = Math.max(5, Math.round(w / 4.5));
      for (let i = 0; i < n; i++) { const t = i / (n - 1), x = (t - 0.5) * w, y = 4 * Math.sin(Math.PI * t) + 1; g.append(S('circle', { cx: x, cy: y, r: 2.4, fill: '#FFFFFF', stroke: INK, 'stroke-width': 1 })); }
    } },
    'neck-locket': { slot: 'neck', drawW(g, w) {
      g.append(S('path', { d: 'M' + (-w / 2) + ',0 Q0,9 ' + (w / 2) + ',0', fill: 'none', stroke: '#E8A90C', 'stroke-width': 1.6 }));
      g.append(S('path', fill('#FFD84D', { d: 'M0,12 C-7,7 -6,2 -2.5,3 C-1,3.3 0,4.5 0,5.5 C0,4.5 1,3.3 2.5,3 C6,2 7,7 0,12 Z', 'stroke-width': 1.2 })));
    } },
    'neck-bandana': { slot: 'neck', drawW(g, w) {
      g.append(S('path', fill('#E5484D', { d: 'M' + (-w / 2) + ',-1 L' + (w / 2) + ',-1 L0,' + (w * 0.42) + ' Z' })));
      [[-w * 0.18, 3], [w * 0.15, 4], [0, w * 0.2]].forEach(([x, y]) => g.append(S('circle', { cx: x, cy: y, r: 1.5, fill: '#fff' })));
    } },
    'neck-bowtie': { slot: 'neck', drawW(g) {
      g.append(S('path', fill('#7C5CD6', { d: 'M0,3 L-11,-3 L-11,9 Z' })));
      g.append(S('path', fill('#7C5CD6', { d: 'M0,3 L11,-3 L11,9 Z' })));
      g.append(S('circle', fill('#C9A8FF', { cx: 0, cy: 3, r: 3 })));
    } },
    'neck-scarf': { slot: 'neck', drawW(g, w) {
      g.append(S('rect', fill('#9B7BF0', { x: -w / 2 - 1, y: -3, width: w + 2, height: 8, rx: 4 })));
      g.append(S('rect', fill('#9B7BF0', { x: w * 0.12, y: 1, width: 8, height: 18, rx: 3, transform: 'rotate(-12 ' + (w * 0.12) + ' 1)' })));
      g.append(S('path', { d: starD(-w * 0.2, 1, 2.6), fill: '#FFD84D' }));
      g.append(S('path', { d: starD(w * 0.18, 13, 2.2), fill: '#FFD84D' }));
    } },
    'wrist-friend': { slot: 'wrist', drawW(g, w) {
      ['#FF7EB6', '#FFD84D', '#4FD1AB', '#7CC8FF'].forEach((c, i) => g.append(S('rect', { x: -w / 2 + i * w / 4, y: -3, width: w / 4 + 0.2, height: 6, fill: c })));
      g.append(S('rect', { x: -w / 2, y: -3, width: w, height: 6, rx: 2, fill: 'none', stroke: INK, 'stroke-width': 1.2 }));
    } },
    'wrist-charm': { slot: 'wrist', drawW(g, w) {
      g.append(S('rect', fill('#FFD84D', { x: -w / 2, y: -2.5, width: w, height: 5, rx: 2.5, 'stroke-width': 1.2 })));
      g.append(S('path', { d: starD(-w * 0.15, 5, 2.5), fill: '#FF7EB6', stroke: INK, 'stroke-width': 0.8 }));
      g.append(S('circle', { cx: w * 0.2, cy: 5, r: 2, fill: '#7CC8FF', stroke: INK, 'stroke-width': 0.8 }));
    } },
    'feet-sneakers': { slot: 'feet', drawW(g, w) {
      g.append(S('path', fill('#FFFFFF', { d: 'M' + (-w / 2) + ',3 C' + (-w / 2) + ',-6 ' + (-w * 0.2) + ',-8 0,-7 C' + (w * 0.3) + ',-7 ' + (w / 2) + ',-4 ' + (w / 2) + ',3 Z' })));
      g.append(S('path', { d: 'M' + (-w * 0.25) + ',-3 L' + (w * 0.2) + ',-1', stroke: '#FF7EB6', 'stroke-width': 2.4, 'stroke-linecap': 'round' }));
      g.append(S('rect', { x: -w / 2, y: 1, width: w, height: 3, rx: 1.5, fill: '#7CC8FF' }));
    } },
    'feet-boots': { slot: 'feet', drawW(g, w) {
      g.append(S('path', fill('#FFD84D', { d: 'M' + (-w * 0.4) + ',-12 L' + (w * 0.3) + ',-12 L' + (w * 0.3) + ',-4 C' + (w * 0.5) + ',-4 ' + (w / 2) + ',0 ' + (w / 2) + ',4 L' + (-w / 2) + ',4 L' + (-w * 0.45) + ',-12 Z' })));
      g.append(S('rect', { x: -w / 2, y: 1, width: w, height: 3, fill: '#E8A90C' }));
    } },
    'feet-sparkle': { slot: 'feet', drawW(g, w) {
      g.append(S('path', fill('#C9A8FF', { d: 'M' + (-w / 2) + ',3 C' + (-w / 2) + ',-5 ' + (w / 2) + ',-5 ' + (w / 2) + ',3 Z' })));
      g.append(S('path', { d: starD(0, -1, 3), fill: '#FFD84D', stroke: INK, 'stroke-width': 0.8 }));
    } },
  };
  function starD(cx, cy, r) {
    let d = '';
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1); }
    return d + 'Z';
  }
  const SLOT_ORDER = ['feet', 'wrist', 'neck', 'face', 'hat'];

  // Put accessories on a critter group. outfit = { hat: 'hat-crown', neck: ..., ... }
  function dress(g, c, outfit) {
    if (!outfit || !c.anchors) return;
    SLOT_ORDER.forEach(slot => {
      const a = ACC[outfit[slot]];
      if (!a || a.slot !== slot) return;
      const at = c.anchors[slot];
      if (slot === 'feet') {
        at.forEach(([x, y, w]) => { const h = S('g', { transform: 'translate(' + x + ',' + y + ')' }); a.drawW(h, w); g.append(h); });
      } else if (slot === 'face') {
        const [x, y, dx] = at, r = dx ? Math.max(6, dx * 0.72) : 6;
        if (!dx) { a.lens(g, x, y, r); return; }   // side view: one lens
        a.lens(g, x - dx, y, r); a.lens(g, x + dx, y, r);
        g.append(S('path', { d: 'M' + (x - dx + r * 0.8) + ',' + (y - 1) + ' Q' + x + ',' + (y - 4) + ' ' + (x + dx - r * 0.8) + ',' + (y - 1), fill: 'none', stroke: INK, 'stroke-width': 1.4 }));
      } else if (slot === 'hat') {
        const [x, y, w] = at, h = S('g', { transform: 'translate(' + x + ',' + y + ') scale(' + (w / 30) + ')' }); a.draw(h); g.append(h);
      } else {
        const [x, y, w] = at, h = S('g', { transform: 'translate(' + x + ',' + y + ')' }); a.drawW(h, w); g.append(h);
      }
    });
  }
  // A prize drawn on its own, about 40 units wide, centered on (0,0)
  function drawPrize(g, id) {
    const a = ACC[id];
    if (!a) return;
    if (a.slot === 'hat') { const h = S('g', { transform: 'translate(0,9) scale(1.25)' }); a.draw(h); g.append(h); }
    else if (a.slot === 'face') { a.lens(g, -10, 0, 8); a.lens(g, 10, 0, 8); g.append(S('path', { d: 'M-4,-1 Q0,-4 4,-1', fill: 'none', stroke: INK, 'stroke-width': 1.4 })); }
    else if (a.slot === 'feet') { [-11, 11].forEach(x => { const h = S('g', { transform: 'translate(' + x + ',6)' }); a.drawW(h, 20); g.append(h); }); }
    else if (a.slot === 'wrist') { const h = S('g', { transform: 'scale(1.6)' }); a.drawW(h, 20); g.append(h); }
    else { const h = S('g', { transform: 'translate(0,-8) scale(1.1)' }); a.drawW(h, 32); g.append(h); }
  }

  /* ── Unicorn styles for the race (the shape lives in unicorn-race.js) ── */

  const UNICORNS = {
    'u-classic':  { body: '#FFFFFF', mane: '#FF7EB6', mane2: '#C9A8FF', horn: '#FFD84D', eye: INK },
    'u-sunset':   { body: '#FFF1E0', mane: '#FF8A5B', mane2: '#FFC94D', horn: '#FF7EB6', eye: INK },
    'u-ocean':    { body: '#E6F7FF', mane: '#2D9CDB', mane2: '#4FD1AB', horn: '#7CC8FF', eye: INK },
    'u-candy':    { body: '#FFE8F4', mane: '#7CC8FF', mane2: '#FF9CD0', horn: '#FFFFFF', eye: INK },
    'u-midnight': { body: '#4A3D86', mane: '#C9A8FF', mane2: '#FFD84D', horn: '#FFD84D', eye: '#FFFFFF' },
    'u-rainbow':  { body: '#FFFFFF', mane: '#FF6B6B', mane2: '#5BC0EB', horn: '#FFD84D', eye: INK, stripes: ['#FFD84D', '#4FD1AB', '#9B7BF0'] },
  };

  function unicornShape(pal) {
    const u = S('g');
    const ln = { stroke: INK, 'stroke-width': 2, 'stroke-linejoin': 'round' };
    const f = c => Object.assign({ fill: c }, ln);
    [-24, -12, 12, 24].forEach(x => u.append(S('rect', Object.assign({ x: x - 3.5, y: -24, width: 7, height: 24, rx: 3.5 }, f(pal.body)))));
    u.append(S('path', Object.assign({ d: 'M-26,-38 C-46,-42 -52,-22 -42,-10 C-40,-24 -34,-28 -24,-30 Z' }, f(pal.mane))));
    // rainbow streaks in the tail
    (pal.stripes || []).forEach((c, i) => u.append(S('path', { d: 'M' + (-27 - i * 2) + ',' + (-36 + i) + ' C' + (-40 - i * 2) + ',' + (-38 + i * 2) + ' ' + (-45 + i) + ',' + (-26 + i * 2) + ' ' + (-41 + i * 2) + ',' + (-15 + i), fill: 'none', stroke: c, 'stroke-width': 3, 'stroke-linecap': 'round' })));
    u.append(S('ellipse', Object.assign({ cx: 0, cy: -36, rx: 30, ry: 16 }, f(pal.body))));
    u.append(S('path', Object.assign({ d: 'M14,-44 C18,-58 22,-64 28,-68 L40,-60 C33,-54 29,-46 27,-34 Z' }, f(pal.body))));
    u.append(S('path', Object.assign({ d: 'M25,-72 C33,-80 49,-76 54,-65 C56,-58 50,-55 43,-57 L30,-56 Z' }, f(pal.body))));
    u.append(S('path', Object.assign({ d: 'M29,-74 L31,-85 L37,-75 Z' }, f(pal.body))));
    u.append(S('path', Object.assign({ d: 'M27,-74 C15,-72 18,-62 9,-58 C16,-56 11,-48 5,-45 C12,-45 18,-49 22,-52 C19,-58 25,-64 31,-68 Z' }, f(pal.mane2))));
    u.append(S('path', Object.assign({ d: 'M37,-76 L46,-98 L42,-74 Z' }, f(pal.horn))));
    u.append(S('circle', { cx: 42, cy: -66, r: 2.4, fill: pal.eye || INK }));
    u.append(S('ellipse', { cx: 47, cy: -60, rx: 3.2, ry: 2, fill: '#FF9CC8', opacity: 0.85 }));
    return u;
  }

  function myOutfitFor(c) {
    const sess = window.MathRealm && window.MathRealm.session;
    const eq = sess && sess.shop && sess.shop.equipped;
    if (!eq || eq.avatar !== c.id) return null;
    const out = {};
    ['hat', 'face', 'neck', 'wrist', 'feet'].forEach(s => { if (eq[s]) out[s] = eq[s]; });
    return out;
  }

  window.RealmSprites = {
    critters: critters,
    critter(id) { return critters.find(c => c.id === id) || null; },
    // The student's avatar critter automatically wears their accessories (on the map, in the
    // shop, in the café). Pass an outfit to draw a preview, or null for no accessories.
    critterSvg(c, cls, outfit) {
      const svg = S('svg', { viewBox: '-62 -132 124 136', 'aria-hidden': 'true' });
      const g = S('g', { class: 'pet' + (cls ? ' ' + cls : '') });
      c.draw(g);
      if (outfit === undefined) outfit = myOutfitFor(c);
      dress(g, c, outfit);
      svg.append(g);
      return svg;
    },
    accessory(id) { return ACC[id] ? { id: id, slot: ACC[id].slot } : null; },
    accessoryIds: Object.keys(ACC),
    SLOTS: ['hat', 'face', 'neck', 'wrist', 'feet'],
    prizeG(id) { const g = S('g'); drawPrize(g, id); return g; },
    prizeSvg(id) {
      const svg = S('svg', { viewBox: '-26 -26 52 46', 'aria-hidden': 'true' });
      svg.append(this.prizeG(id));
      return svg;
    },
    // Everyone's café has the starters; adopted critters come visit too.
    cafeCritters(session) {
      const owned = (session && session.shop && session.shop.owned) || [];
      return critters.filter(c => c.starter || owned.indexOf(c.id) >= 0);
    },
    unicornStyle(id) { return UNICORNS[id] || UNICORNS['u-classic']; },
    unicornSvg(id) {
      const svg = S('svg', { viewBox: '-55 -104 115 108', 'aria-hidden': 'true' });
      svg.append(unicornShape(UNICORNS[id] || UNICORNS['u-classic']));
      return svg;
    },
  };
})();
