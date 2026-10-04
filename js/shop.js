/*
 * Math Realm: Sprite Shop
 * Items, prices and what each student owns come from the server (the Shop tab),
 * so gems can't be faked from the page. Drawings come from js/sprites.js.
 *   critter  adopted critters visit the Critter Café; one can be your avatar on the map
 *   unicorn  a style for your unicorn on the Unicorn Racetrack
 */
(function () {
  'use strict';
  if (!MathRealm.requireLogin()) return;

  const C = window.MATH_REALM_CATALOG;
  const $ = s => document.querySelector(s);
  const GEM = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M9 5h14l6 8-13 15L3 13z" fill="#7CC8FF" stroke="#2A1F45" stroke-width="2" stroke-linejoin="round"/></svg>';
  let items = [], owned = [], equipped = {}, balance = 0, tab = 'critter', asking = null, busy = false;

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

  const isMine = it => it.price === 0 || owned.indexOf(it.itemId) >= 0;
  function isEquipped(it) {
    if (it.kind === 'critter') return equipped.avatar === it.itemId;
    return (equipped.unicorn || 'u-classic') === it.itemId;
  }

  function art(it) {
    if (it.kind === 'unicorn') return RealmSprites.unicornSvg(it.itemId);
    const c = RealmSprites.critter(it.itemId);
    return c ? RealmSprites.critterSvg(c, 'idle') : null;
  }
  function title(it) {
    const c = it.kind === 'critter' ? RealmSprites.critter(it.itemId) : null;
    return c ? { name: c.name, sub: c.species } : { name: it.name.replace(/ unicorn$/i, ''), sub: 'unicorn style' };
  }

  function render(popId) {
    $('#tabCritters').setAttribute('aria-selected', String(tab === 'critter'));
    $('#tabUnicorns').setAttribute('aria-selected', String(tab === 'unicorn'));
    const grid = $('#grid');
    grid.replaceChildren();
    items.filter(it => it.kind === tab && art(it)).forEach(it => {
      const mine = isMine(it), on = isEquipped(it), t = title(it);
      const card = el('article', 'item card' + (mine ? ' mine' : '') + (on ? ' equipped' : '') + (it.itemId === popId ? ' pop' : ''));
      card.dataset.kind = it.kind;
      card.dataset.id = it.itemId;
      const pic = el('div', 'art');
      pic.append(art(it));
      card.append(pic, el('h3', '', t.name), el('p', 'sp', t.sub));
      const price = el('div', 'price' + (mine ? ' mine' : ''));
      if (mine) price.textContent = it.price === 0 ? 'Everyone has this one' : 'Yours!';
      else price.innerHTML = GEM + '<span>' + it.price.toLocaleString() + '</span>';
      card.append(price);

      const acts = el('div', 'acts');
      if (!mine && asking === it.itemId) {
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
      : 'Your unicorn will look like this in the next race.');
    RealmFX.correct();
    render();
  }

  $('#tabCritters').addEventListener('click', () => { tab = 'critter'; asking = null; render(); });
  $('#tabUnicorns').addEventListener('click', () => { tab = 'unicorn'; asking = null; render(); });

  MathRealm.shop().then(d => {
    if (!d.ok) { note(MathRealm.errorMessage(d.error, true)); return; }
    // Things to buy first (cheapest first), then the free starters. Sorted once, so cards don't jump after a purchase.
    items = d.items.slice().sort((a, b) => ((a.price === 0) - (b.price === 0)) || a.price - b.price);
    owned = d.owned;
    equipped = d.equipped;
    setGems(d.balance);
    note('');
    render();
  });
})();
