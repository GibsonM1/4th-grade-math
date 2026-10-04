/*
 * Math Realm: names and game list
 * Change names here and every page picks them up. The skills themselves
 * come from the Skills tab in the Sheet.
 */
window.MATH_REALM_CATALOG = {
  realmName: 'Math Realm',      // the class could vote on a name
  pointsName: 'gems',

  // One entry per "zone" value on the Skills tab, in the order they appear on the home page.
  // accent: mint, berry or sky. A zone on the Skills tab that isn't listed here still shows up, under its own name.
  zones: [
    { zone: '3rd Grade Review', title: 'Fact Garden',       blurb: 'Grow your times tables and division facts until they bloom.', accent: 'mint' },
    { zone: 'Unit 6',           title: 'Rectangle Kingdom', blurb: 'Build big multiplication problems out of rectangles.',        accent: 'berry' },
  ],

  // Which page plays each skill, matched by the start of the skillId.
  // ready: false shows "Opening soon" until that game is built.
  games: [
    { prefix: 'g3.',    page: 'flashcards.html', ready: true  },
    { prefix: 'g4.u6.', page: 'area-model.html', ready: false },
  ],
};
