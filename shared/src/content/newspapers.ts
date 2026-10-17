export interface Clipping {
  id: number;
  headline: string;
  body: [string, string];
  /** Which nights it can appear on, and how often. */
  fromNight: number;
  onlyNight?: number;
  rarity: number;
}

export const CLIPPINGS: Clipping[] = [
  {
    id: 1,
    headline: 'LOCAL PIZZERIA REOPENS UNDER NEW MANAGEMENT',
    body: [
      "{venue} reopens its doors after two years closed, with a brand-new show stage and four 'state-of-the-art' characters.",
      "A spokesperson for {company} says the restaurant 'has put the past behind it.' Night security staffing has been increased to four for the first time in the chain's history.",
    ],
    fromNight: 1,
    rarity: 1,
  },
  {
    id: 2,
    headline: 'PARENTS RAISE CONCERNS OVER ANIMATRONIC HYGIENE',
    body: [
      "Several parents report a foul odour and 'something like mucus' around the characters' eyes and mouths.",
      "Health inspectors visited but found no violations. The company says the costumes are 'cleaned weekly.'",
    ],
    fromNight: 2,
    rarity: 0.5,
  },
  {
    id: 3,
    headline: 'NIGHT GUARD MISSING AFTER SHIFT',
    body: [
      'A security worker employed at {venue} failed to return home after a night shift last Tuesday. Police found the guard\'s car still in the parking lot.',
      "The company declined to comment beyond noting that the guard 'had been briefed on all safety procedures.'",
    ],
    fromNight: 2,
    rarity: 0.5,
  },
  {
    id: 4,
    headline: 'FIVE CHILDREN, ONE BIRTHDAY, NO ANSWERS',
    body: [
      'Twenty years later, the case remains unsolved. A man in a uniform was seen leading the children to a back room.',
      "The suspect was charged, but the children were never found. A memorial plaque has been quietly removed from the location's entrance.",
    ],
    fromNight: 1,
    rarity: 0.05,
  },
  {
    id: 5,
    headline: "{company} ANNOUNCES 'SAFE NIGHTS' PROGRAMME",
    body: [
      "Following an internal review, the company will install additional doors, a shared power system and a 'maintenance panel' at all locations.",
      "'We take the safety of our staff seriously,' a statement reads.",
    ],
    fromNight: 3,
    rarity: 0.6,
  },
  {
    id: 6,
    headline: "LOCATION SEVEN TO CLOSE BY YEAR'S END",
    body: [
      "Citing 'low attendance and maintenance costs,' the company confirms Location Seven will close. The characters will be 'retired' and placed in storage.",
      'The rare golden bear costume, long rumoured to exist, has not been located.',
    ],
    fromNight: 6,
    onlyNight: 6,
    rarity: 1,
  },
];

/** Poster nodes that can carry a clipping. */
export const CLIPPING_NODES = ['west_hall', 'east_hall', 'party_a', 'party_b'];
