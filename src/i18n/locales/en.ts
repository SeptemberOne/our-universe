export const en = {
  app: {
    name: 'Our Universe',
    tagline: 'Two hearts. One universe.',
    privateBadge: 'Private space for two',
  },
  home: {
    welcomeTitle: 'Welcome home',
    welcomeBody:
      'A quiet corner of the night sky for our favourite photographs, playful games, and little notes.',
    sectionTitle: 'CONSTELLATIONS',
    statusReady: 'Ready to play',
    statusNext: 'Play now',
    statusPlanned: 'Planned',
    openGameHint: 'Opens Photo Memory Match',
    footerNote: 'Private by design · Local prototype mode',
    destinations: {
      play: {
        title: 'Photo Memory Match',
        subtitle: 'Flip celestial cards to uncover matching moments together.',
      },
      memories: {
        title: 'Shared Memories',
        subtitle: 'Our private constellation of photographs and memory prompts.',
      },
      letters: {
        title: 'Love Notes',
        subtitle: 'Letters and “Open When…” envelopes saved just for us.',
      },
      garden: {
        title: 'Dream Garden',
        subtitle: 'Collect stars from games and decorate our shared sanctuary.',
      },
    },
  },
  language: {
    groupLabel: 'Language selector',
    current: 'Current language: English',
  },
  memoryMatch: {
    title: 'Photo Memory Match',
    sampleBadge: 'Sample celestial deck · Offline',
    instruction: 'Tap two starlight cards to uncover each matching pair.',
    backLabel: 'Back',
    backAccessibility: 'Back to Our Universe home',
    resetLabel: 'New Game',
    resetAccessibility: 'Shuffle a new memory match deck',
    stats: {
      moves: 'Moves',
      pairs: 'Pairs',
      time: 'Time',
    },
    card: {
      hiddenLabel: 'Face-down starlight card',
      hiddenHint: 'Double tap to reveal this card',
      revealedLabel: '{{name}}, revealed',
      matchedLabel: '{{name}}, matched pair',
    },
    completion: {
      badge: 'Constellation Complete',
      title: 'Every memory aligned',
      subtitle: 'You matched all {{total}} celestial pairs together.',
      playAgain: 'Play Again',
      backHome: 'Back to Universe',
    },
    artworks: {
      crescentMoon: 'Crescent Moon',
      ringedPlanet: 'Ringed Planet',
      twinStars: 'Twin Stars',
      nebulaBloom: 'Nebula Bloom',
      shootingStar: 'Shooting Star',
      eclipseHalo: 'Eclipse Halo',
    },
  },
} as const;

type DeepString<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export type TranslationSchema = DeepString<typeof en>;
