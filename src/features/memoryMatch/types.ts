export type MemoryArtworkId =
  | 'crescentMoon'
  | 'ringedPlanet'
  | 'twinStars'
  | 'nebulaBloom'
  | 'shootingStar'
  | 'eclipseHalo';

export interface MemoryArtwork {
  readonly id: MemoryArtworkId;
  readonly gradient: readonly [string, string];
  readonly accentColor: string;
  readonly secondaryColor: string;
}

export interface MemoryCardState {
  readonly cardId: string;
  readonly pairId: MemoryArtworkId;
  readonly isFlipped: boolean;
  readonly isMatched: boolean;
}

export type MemoryGameStatus = 'idle' | 'playing' | 'completed';

export interface MemoryGameState {
  readonly cards: readonly MemoryCardState[];
  readonly selectedCardIds: readonly string[];
  readonly isResolvingMismatch: boolean;
  readonly moves: number;
  readonly matchedPairs: number;
  readonly totalPairs: number;
  readonly status: MemoryGameStatus;
}

export type FlipOutcome =
  | 'ignored'
  | 'first-flip'
  | 'matched'
  | 'mismatch-pending'
  | 'completed';

export interface FlipResult {
  readonly state: MemoryGameState;
  readonly outcome: FlipOutcome;
}
