export const colors = {
  background: {
    deepSpace: '#070B1A',
    midnight: '#0E1530',
    indigo: '#18214A',
  },
  nebula: {
    violetGlow: 'rgba(139, 108, 246, 0.18)',
    roseGlow: 'rgba(238, 146, 194, 0.14)',
    goldGlow: 'rgba(247, 208, 138, 0.12)',
  },
  surface: {
    card: 'rgba(22, 31, 66, 0.72)',
    cardElevated: 'rgba(30, 42, 86, 0.84)',
    pill: 'rgba(255, 255, 255, 0.08)',
    pillActive: 'rgba(247, 208, 138, 0.2)',
  },
  border: {
    subtle: 'rgba(214, 224, 255, 0.14)',
    accent: 'rgba(247, 208, 138, 0.42)',
  },
  text: {
    primary: '#F6F7FF',
    secondary: '#C7D0F0',
    muted: '#94A1CE',
    accent: '#F7D08A',
    inverse: '#070B1A',
  },
  accent: {
    starlight: '#F7D08A',
    rose: '#F2A7C6',
    lavender: '#B7A6FF',
    sky: '#8EC5FF',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 44,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export const typography = {
  heroTitle: {
    fontSize: 34,
    lineHeight: 42,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
  },
  tagline: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '500' as const,
    letterSpacing: 0.3,
  },
  sectionTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600' as const,
    letterSpacing: 1.1,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400' as const,
  },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500' as const,
  },
} as const;

export const layout = {
  minTouchTarget: 44,
  maxContentWidth: 560,
} as const;
