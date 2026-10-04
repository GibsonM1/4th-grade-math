/*
 * Math Realm: Sprite Shop
 * Items, prices and what each student owns come from the server (the Shop tab),
 * so gems can't be faked from the page. Drawings come from js/sprites.js.
 *   critter  adopted critters visit the Critter Café; one can be your avatar on the map
 *   unicorn  a style for your unicorn on the Unicorn Racetrack
 *   accessory  won in the Critter Claw (claw.html); worn by your avatar critter
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

  const C = window.MATH_REALM_CATALOG;
  const SLOT_WORD = { hat: 'hat', face: 'glasses', neck: 'necklace', wrist: 'bracelet', feet: 'shoes' };
  RealmMusic.setTheme('shop');
  [
    { btn: document.querySelector('#soundBtn'), label: 'Sounds', get: () => RealmFX.soundOn, flip: () => RealmFX.toggleSound() },
    { btn: document.querySelector('#musicBtn'), label: 'Music', get: () => RealmMusic.on, flip: () => RealmMusic.toggle() },
  ].forEach(t => {
    const paint = () => { t.btn.textContent = t.label + ': ' + (t.get() ? 'on' : 'off'); t.btn.setAttribute('aria-pressed', String(t.get())); };
    paint();
    t.btn.addEventListener('click', () => { t.flip(); paint(); t.btn.blur(); });
  });
  const $ = s => document.querySelector(s);
  const GEM = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 5h14l6 8-13 15L3 13z" fill="#7CC8FF" stroke="#2A1F45" stroke-width="2" stroke-linejoin="round"/></svg>';
  let items = [], owned = [], equipped = {}, balance = 0, tab = 'critter', asking = null, busy = false, growth = 0;
  const GUEST = MathRealm.isGuest();

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(label, cls, on, disabled) {
    const b = el('button', 'btn ' + (cls || ''), label);
    b.type = 'button';
    b.disabled = !!disabled;
    b.addEventListener('click', on);
    return b;
  }
  const note = t => { $('#note').textContent = t || ''; };
  function setGems(n) {
    balance = n;
    $('#gemCount').textContent = Number(n).toLocaleString();
  }
  $('#gemName').textContent = C.pointsName;
  setGems((MathRealm.student || {}).points || 0);

  // Accessories are only ever won, never free; price 0 means "everyone has it" for the rest.
  const isMine = it => (it.kind !== 'accessory' && it.price === 0) || owned.indexOf(it.itemId) >= 0;
  const slotOf = it => (RealmSprites.accessory(it.itemId) || {}).slot;
  function isEquipped(it) {
    if (it.kind === 'critter') return equipped.avatar === it.itemId;
    if (it.kind === 'accessory') return equipped[slotOf(it)] === it.itemId;
    return (equipped.unicorn || 'u-classic') === it.itemId;
  }

  function art(it) {
    if (it.kind === 'unicorn') return RealmSprites.unicornSvg(it.itemId);
    if (it.kind === 'accessory') return RealmSprites.accessory(it.itemId) ? RealmSprites.prizeSvg(it.itemId) : null;
    const c = RealmSprites.critter(it.itemId);
    return c ? RealmSprites.critterSvg(c, 'idle') : null;
  }
  function title(it) {
    const c = it.kind === 'critter' ? RealmSprites.critter(it.itemId) : null;
    if (it.kind === 'accessory') return { name: it.name, sub: SLOT_WORD[slotOf(it)] || 'accessory' };
    return c ? { name: c.name, sub: c.species } : { name: it.name.replace(/ unicorn$/i, ''), sub: 'unicorn style' };
  }

  function render(popId) {
    $('#tabCritters').setAttribute('aria-selected', String(tab === 'critter'));
    $('#tabUnicorns').setAttribute('aria-selected', String(tab === 'unicorn'));
    $('#tabAcc').setAttribute('aria-selected', String(tab === 'accessory'));
    renderWearing();
    renderGrowthNote();
    const grid = $('#grid');
    grid.replaceChildren();
    document.querySelector('.gems').hidden = GUEST;
    items.filter(it => it.kind === tab && art(it)).forEach(it => {
      const mine = isMine(it), on = isEquipped(it), t = title(it);
      const locked = it.kind === 'accessory' && !mine;
      const card = el('article', 'item card' + (mine && !GUEST ? ' mine' : '') + (on ? ' equipped' : '') + (locked ? ' locked' : '') + (it.itemId === popId ? ' pop' : ''));
      card.dataset.kind = it.kind;
      card.dataset.id = it.itemId;
      const pic = el('div', 'art');
      pic.append(art(it));
      card.append(pic, el('h3', '', t.name), el('p', 'sp', t.sub));
      const price = el('div', 'price' + (mine || GUEST ? ' mine' : ''));
      if (GUEST) price.textContent = it.kind === 'accessory' ? 'Claw machine prize' : it.price === 0 ? 'Free for everyone' : 'Costs ' + C.pointsName;
      else if (it.kind === 'accessory') { price.className = 'price mine'; price.textContent = mine ? 'Yours!' : 'Win it in the Critter Claw'; }
      else if (mine) price.textContent = it.price === 0 ? 'Everyone has this one' : 'Yours!';
      else if (it.basePrice && it.price > it.basePrice) {
        price.innerHTML = GEM + '<span>' + it.price.toLocaleString() + '</span>';
        price.append(el('span', 'was', 'was ' + it.basePrice.toLocaleString()));
      }
      else price.innerHTML = GEM + '<span>' + it.price.toLocaleString() + '</span>';
      card.append(price);

      const acts = el('div', 'acts');
      if (GUEST) {
        // Guests can look at everything, but adopting and wearing need an account.
        const a = el('a', 'btn btn-soft', it.kind === 'accessory' ? 'Log in to win it' : 'Log in to get it');
        a.href = 'index.html?login=1&next=shop.html';
        acts.append(a);
      } else if (it.kind === 'accessory') {
        const pet = equipped.avatar ? RealmSprites.critter(equipped.avatar) : null;
        if (!mine) { const a = el('a', 'btn btn-soft', 'Try the claw machine'); a.href = 'claw.html'; acts.append(a); }
        else if (on) { acts.append(el('div', 'badge', 'Wearing it')); acts.append(button('Take it off', 'btn-soft btn-small', () => equip(slotOf(it), ''))); }
        else if (pet) acts.append(button('Put it on ' + pet.name, 'btn-soft', () => equip(slotOf(it), it.itemId)));
        else acts.append(button('Pick an avatar first', 'btn-soft', () => {}, true));
      } else if (!mine && asking === it.itemId) {
        acts.append(el('p', 'ask', 'Spend ' + it.price + ' ' + C.pointsName + '?'),
          button(it.kind === 'critter' ? 'Yes, adopt ' + t.name + '!' : 'Yes, get it!', '', () => buy(it)),
          button('Not now', 'btn-soft', () => { asking = null; render(); }));
      } else if (!mine) {
        const short = it.price - balance;
        acts.append(short > 0
          ? button('Need ' + short + ' more', 'btn-soft', () => {}, true)
          : button((it.kind === 'critter' ? 'Adopt for ' : 'Get for ') + it.price, '', () => { asking = it.itemId; render(); }));
      } else if (on) {
        acts.append(el('div', 'badge', it.kind === 'critter' ? 'Your avatar' : 'Racing with this'));
        if (it.kind === 'critter') acts.append(button('Stop using as avatar', 'btn-soft btn-small', () => equip('avatar', '')));
      } else {
        acts.append(it.kind === 'critter'
          ? button('Make my avatar', 'btn-soft', () => equip('avatar', it.itemId))
          : button('Race with this', 'btn-soft', () => equip('unicorn', it.itemId)));
      }
      card.append(acts);
      grid.append(card);
    });
  }

  async function buy(it) {
    if (busy) return;
    busy = true;
    note('Adopting…');
    const d = await MathRealm.buy(it.itemId);
    busy = false;
    asking = null;
    if (!d.ok) { note(MathRealm.errorMessage(d.error, true)); render(); return; }
    owned = d.owned;
    equipped = d.equipped;
    if (d.items) items = d.items.slice().sort((a, b) => ((a.price === 0) - (b.price === 0)) || (a.basePrice || a.price) - (b.basePrice || b.price));   // prices went up
    setGems(d.balance);
    const t = title(it);
    note(it.kind === 'critter'
      ? t.name + ' is yours! ' + t.name + ' will start visiting the Critter Café. Want ' + t.name + ' as your avatar too?'
      : 'The ' + t.name + ' style is yours! Press "Race with this" to use it on the racetrack.');
    RealmFX.fanfare();
    RealmFX.confetti();
    render(it.itemId);
  }

  async function equip(slot, itemId) {
    if (busy) return;
    busy = true;
    const d = await MathRealm.equip(slot, itemId);
    busy = false;
    if (!d.ok) { note(MathRealm.errorMessage(d.error, true)); return; }
    owned = d.owned;
    equipped = d.equipped;
    const c = itemId && slot === 'avatar' ? RealmSprites.critter(itemId) : null;
    note(slot === 'avatar'
      ? (c ? c.name + ' is your avatar now. Look for them on the map!' : 'No avatar for now.')
      : slot === 'unicorn' ? 'Your unicorn will look like this in the next race.'
      : itemId ? 'Looking good!' : 'Taken off.');
    RealmFX.correct();
    render();
  }

  $('#tabCritters').addEventListener('click', () => { tab = 'critter'; asking = null; render(); });
  $('#tabUnicorns').addEventListener('click', () => { tab = 'unicorn'; asking = null; render(); });
  $('#tabAcc').addEventListener('click', () => { tab = 'accessory'; asking = null; render(); });

  // Explain why prices climb, so a higher number never looks like a glitch.
  function renderGrowthNote() {
    const box = $('#growth');
    if (GUEST) { box.hidden = true; return; }
    const kind = tab === 'accessory' ? null : tab;
    if (!kind || !growth) { box.hidden = true; return; }
    const have = items.filter(i => i.kind === kind && i.basePrice > 0 && owned.indexOf(i.itemId) >= 0).length;
    box.hidden = false;
    box.textContent = have
      ? 'You have ' + have + ' ' + (kind === 'critter' ? (have === 1 ? 'critter' : 'critters') : (have === 1 ? 'unicorn style' : 'unicorn styles')) +
        ', so these cost ' + Math.round(growth * have * 100) + '% more than their starting price. The more you collect, the more the next one costs!'
      : 'Every one of these you collect makes the rest cost a little more, so keep earning ' + C.pointsName + '!';
  }

  // On the Accessories tab: your avatar wearing everything it has on.
  function renderWearing() {
    const box = $('#wearing');
    box.hidden = tab !== 'accessory' || GUEST;
    if (box.hidden) return;
    box.replaceChildren();
    const pet = equipped.avatar ? RealmSprites.critter(equipped.avatar) : null;
    if (!pet) { box.append(el('p', '', 'Pick an avatar on the Critters tab, and then dress it up with accessories from the Critter Claw!')); return; }
    const outfit = {};
    RealmSprites.SLOTS.forEach(sl => { if (equipped[sl]) outfit[sl] = equipped[sl]; });
    box.append(RealmSprites.critterSvg(pet, 'idle', outfit));
    const won = items.filter(i => i.kind === 'accessory' && owned.indexOf(i.itemId) >= 0).length;
    const total = items.filter(i => i.kind === 'accessory').length;
    box.append(el('p', '', pet.name + "'s outfit. You've won " + won + ' of ' + total + ' accessories.'));
  }

  if (GUEST) {
    // The shop list comes from the server, so guests see a built-in copy of it.
    items = RealmSprites.critters.slice().sort((a, b) => (a.starter ? 1 : 0) - (b.starter ? 1 : 0))
      .map(c => ({ itemId: c.id, name: c.name, kind: 'critter', price: c.starter ? 0 : 1 }))
      .concat(['u-sunset', 'u-ocean', 'u-candy', 'u-midnight', 'u-rainbow', 'u-classic'].map(id => ({ itemId: id, name: id, kind: 'unicorn', price: id === 'u-classic' ? 0 : 1 })))
      .concat(RealmSprites.accessoryIds.map(id => ({ itemId: id, name: id.replace(/^[a-z]+-/, '').replace(/(^|-)([a-z])/g, (m, a, b) => (a ? ' ' : '') + b.toUpperCase()), kind: 'accessory', price: 0 })));
    owned = []; equipped = {};
    note('Have a look around! Log in to spend ' + C.pointsName + ' and dress up your own critter.');
    render();
    return;
  }

  MathRealm.shop().then(d => {
    if (!d.ok) { note(MathRealm.errorMessage(d.error, true)); return; }
    // Things to buy first (cheapest first), then the free starters. Sorted once, so cards don't jump after a purchase.
    growth = Number(d.priceGrowth) || 0;
    items = d.items.slice().sort((a, b) => ((a.price === 0) - (b.price === 0)) || (a.basePrice || a.price) - (b.basePrice || b.price));
    owned = d.owned;
    equipped = d.equipped;
    setGems(d.balance);
    note('');
    render();
  });
})();
