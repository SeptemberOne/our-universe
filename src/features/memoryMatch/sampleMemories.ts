import type { MemoryArtwork, MemoryArtworkId } from './types';

/**
 * Original celestial placeholder illustrations for local Phase 1 gameplay.
 * No personal photographs or external image URLs are used.
 */
export const SAMPLE_MEMORIES: readonly MemoryArtwork[] = [
  {
    id: 'crescentMoon',
    gradient: ['#1D2B64', '#3B2F63'],
    accentColor: '#F7D08A',
    secondaryColor: '#C7D0F0',
  },
  {
    id: 'ringedPlanet',
    gradient: ['#232056', '#462C6E'],
    accentColor: '#F2A7C6',
    secondaryColor: '#F7D08A',
  },
  {
    id: 'twinStars',
    gradient: ['#142850', '#27496D'],
    accentColor: '#8EC5FF',
    secondaryColor: '#F7D08A',
  },
  {
    id: 'nebulaBloom',
    gradient: ['#341F57', '#6B2D5C'],
    accentColor: '#F2A7C6',
    secondaryColor: '#B7A6FF',
  },
  {
    id: 'shootingStar',
    gradient: ['#102542', '#2B3A67'],
    accentColor: '#F7D08A',
    secondaryColor: '#8EC5FF',
  },
  {
    id: 'eclipseHalo',
    gradient: ['#1E1B4B', '#3E2759'],
    accentColor: '#B7A6FF',
    secondaryColor: '#F7D08A',
  },
] as const;

export const SAMPLE_MEMORY_IDS: readonly MemoryArtworkId[] = SAMPLE_MEMORIES.map(
  (item) => item.id,
);

const ARTWORK_MAP: Record<MemoryArtworkId, MemoryArtwork> = {
  crescentMoon: SAMPLE_MEMORIES[0]!,
  ringedPlanet: SAMPLE_MEMORIES[1]!,
  twinStars: SAMPLE_MEMORIES[2]!,
  nebulaBloom: SAMPLE_MEMORIES[3]!,
  shootingStar: SAMPLE_MEMORIES[4]!,
  eclipseHalo: SAMPLE_MEMORIES[5]!,
};

export function getSampleMemoryArtwork(id: MemoryArtworkId): MemoryArtwork {
  return ARTWORK_MAP[id];
}
