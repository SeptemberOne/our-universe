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
    statusReady: 'Foundation ready',
    statusNext: 'Next up',
    statusPlanned: 'Planned',
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
} as const;

type DeepString<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

export type TranslationSchema = DeepString<typeof en>;
