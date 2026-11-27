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

export type MemoryPairId = string;

export interface MemoryCardState {
  readonly cardId: string;
  readonly pairId: MemoryPairId;
  readonly isFlipped: boolean;
  readonly isMatched: boolean;
}

export interface PhotoPairCandidate {
  readonly path: string;
  readonly signedUrl: string;
}

export type MemoryCardVisual =
  | {
      readonly kind: 'photo';
      readonly pairId: MemoryPairId;
      readonly signedUrl: string;
      readonly photoNumber: number;
    }
  | {
      readonly kind: 'artwork';
      readonly pairId: MemoryArtworkId;
      readonly label: string;
    };

export type RoundPhotoSelectionResult =
  | { readonly ok: true; readonly pairIds: readonly MemoryPairId[] }
  | {
      readonly ok: false;
      readonly reason: 'empty' | 'insufficient';
      readonly availableCount: number;
    };

export type PhotoGameRoundResult =
  | {
      readonly ok: true;
      readonly pairIds: readonly MemoryPairId[];
      readonly state: MemoryGameState;
    }
  | {
      readonly ok: false;
      readonly reason: 'empty' | 'insufficient';
      readonly availableCount: number;
    };

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
