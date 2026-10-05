/*
 * Math Realm: names and game list
 * Change names here and every page picks them up. The skills themselves
 * come from the Skills tab in the Sheet.
 */
window.MATH_REALM_CATALOG = {
  realmName: 'Math Realm',      // the class could vote on a name
  pointsName: 'gems',

  // Saying answers out loud in the speed challenge. In Chrome, the audio goes to
  // Google's speech service to be turned into text, so leave this false until the
  // district says it's OK for students. Change to true to turn it on.
  voiceAnswers: false,

  // "Read it to me" button in the Critter Café. Uses the computer's own text-to-speech voice
  // (only the game's words are read; nothing about the student). Change to false to hide it.
  readAloud: true,

  // One entry per "zone" value on the Skills tab, in the order they appear on the home page.
  // accent: mint, berry, sky or sun. A zone on the Skills tab that isn't listed here still shows up, under its own name.
  // link (optional): an extra button on that zone's card.
  zones: [
    { zone: '3rd Grade Review', title: 'Fact Garden',       blurb: 'Grow your times tables and division facts until they bloom.', accent: 'mint',
      link: { label: 'Speed challenge', page: 'challenge.html' } },
    { zone: 'Unit 6',           title: 'Rectangle Kingdom', blurb: 'Build big multiplication problems out of rectangles.',        accent: 'berry',
      link: { label: 'See how it works', page: 'how-it-works.html' } },
    { zone: 'Decimals',         title: 'Unicorn Race.Track', blurb: 'Race your unicorn along a decimal number line, landing on tenths and hundredths.', accent: 'sky' },
    { zone: 'Fractions',        title: 'Critter Café',      blurb: 'Measure fractions of a cup and kilograms on the scale to feed hungry pets.', accent: 'sun' },
  ],

  // Which page plays each skill, matched by the start of the skillId.
  // ready: false shows "Opening soon" until that game is built.
  games: [
    { prefix: 'g3.',    page: 'flashcards.html', ready: true  },
    { prefix: 'g4.u6.', page: 'area-model.html', ready: true  },
    { prefix: 'g4.dec.', page: 'unicorn-race.html', ready: true },
    { prefix: 'g4.frac.', page: 'pet-food.html', ready: true },
  ],
};
