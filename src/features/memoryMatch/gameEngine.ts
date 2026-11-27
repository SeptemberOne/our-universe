import type {
  FlipResult,
  MemoryCardState,
  MemoryGameState,
  MemoryPairId,
  PhotoGameRoundResult,
  PhotoPairCandidate,
  RoundPhotoSelectionResult,
} from './types';

export type RandomFn = () => number;

export const MIN_MEMORY_PAIRS = 2;
export const MAX_MEMORY_PAIRS = 6;

function normalizeRandom(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  if (value >= 1) {
    return 1 - Number.EPSILON;
  }
  return value;
}

function sanitizePairIds(pairIds: readonly MemoryPairId[]): MemoryPairId[] {
  const unique: MemoryPairId[] = [];
  const seen = new Set<MemoryPairId>();
  for (const pairId of pairIds) {
    if (pairId.trim().length === 0 || seen.has(pairId)) {
      continue;
    }
    seen.add(pairId);
    unique.push(pairId);
  }
  return unique;
}

export function shuffleArray<T>(items: readonly T[], randomFn: RandomFn = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(normalizeRandom(randomFn()) * (index + 1));
    const current = result[index];
    const target = result[swapIndex];
    if (current !== undefined && target !== undefined) {
      result[index] = target;
      result[swapIndex] = current;
    }
  }
  return result;
}

/**
 * Filter candidate couple photos down to unique, playable storage paths that have
 * an active signed URL in memory.
 */
export function extractPlayablePhotoPairIds(
  photos: readonly PhotoPairCandidate[],
): MemoryPairId[] {
  const uniquePaths: MemoryPairId[] = [];
  const seen = new Set<MemoryPairId>();
  for (const photo of photos) {
    if (photo.path.trim().length === 0 || photo.signedUrl.trim().length === 0) {
      continue;
    }
    if (seen.has(photo.path)) {
      continue;
    }
    seen.add(photo.path);
    uniquePaths.push(photo.path);
  }
  return uniquePaths;
}

/**
 * Select between `minPairs` and `maxPairs` unique photo identifiers for a round.
 * When more than `maxPairs` are available, randomly choose `maxPairs` items.
 */
export function selectRoundPairIds(
  pairIds: readonly MemoryPairId[],
  randomFn: RandomFn = Math.random,
  options?: {
    readonly minPairs?: number;
    readonly maxPairs?: number;
  },
): RoundPhotoSelectionResult {
  const minPairs = Math.max(1, options?.minPairs ?? MIN_MEMORY_PAIRS);
  const maxPairs = Math.max(minPairs, options?.maxPairs ?? MAX_MEMORY_PAIRS);
  const unique = sanitizePairIds(pairIds);

  if (unique.length === 0) {
    return { ok: false, reason: 'empty', availableCount: 0 };
  }
  if (unique.length < minPairs) {
    return { ok: false, reason: 'insufficient', availableCount: unique.length };
  }
  if (unique.length > maxPairs) {
    return {
      ok: true,
      pairIds: shuffleArray(unique, randomFn).slice(0, maxPairs),
    };
  }
  return { ok: true, pairIds: unique };
}

export function createDeck(
  pairIds: readonly MemoryPairId[],
  randomFn: RandomFn = Math.random,
): MemoryCardState[] {
  const uniquePairIds = sanitizePairIds(pairIds);
  const unshuffled: MemoryCardState[] = [];
  for (const pairId of uniquePairIds) {
    unshuffled.push(
      {
        cardId: `${pairId}-a`,
        pairId,
        isFlipped: false,
        isMatched: false,
      },
      {
        cardId: `${pairId}-b`,
        pairId,
        isFlipped: false,
        isMatched: false,
      },
    );
  }
  return shuffleArray(unshuffled, randomFn);
}

export function createInitialGameState(
  pairIds: readonly MemoryPairId[],
  randomFn: RandomFn = Math.random,
): MemoryGameState {
  const uniquePairIds = sanitizePairIds(pairIds);
  return {
    cards: createDeck(uniquePairIds, randomFn),
    selectedCardIds: [],
    isResolvingMismatch: false,
    moves: 0,
    matchedPairs: 0,
    totalPairs: uniquePairIds.length,
    status: 'idle',
  };
}

/**
 * Create a new shuffled Photo Memory Match round using up to six distinct couple photos.
 */
export function createPhotoGameRound(
  photos: readonly PhotoPairCandidate[],
  randomFn: RandomFn = Math.random,
): PhotoGameRoundResult {
  const playableIds = extractPlayablePhotoPairIds(photos);
  const selection = selectRoundPairIds(playableIds, randomFn);
  if (!selection.ok) {
    return selection;
  }
  return {
    ok: true,
    pairIds: selection.pairIds,
    state: createInitialGameState(selection.pairIds, randomFn),
  };
}

export function flipCard(state: MemoryGameState, cardId: string): FlipResult {
  if (
    state.isResolvingMismatch ||
    state.status === 'completed' ||
    state.selectedCardIds.length >= 2
  ) {
    return { state, outcome: 'ignored' };
  }

  const targetCard = state.cards.find((card) => card.cardId === cardId);
  if (!targetCard || targetCard.isFlipped || targetCard.isMatched) {
    return { state, outcome: 'ignored' };
  }

  const nextStatus = state.status === 'idle' ? 'playing' : state.status;
  const flippedCards = state.cards.map((card) =>
    card.cardId === cardId ? { ...card, isFlipped: true } : card,
  );

  // First card in a pair turn
  if (state.selectedCardIds.length === 0) {
    return {
      outcome: 'first-flip',
      state: {
        ...state,
        cards: flippedCards,
        selectedCardIds: [cardId],
        status: nextStatus,
      },
    };
  }

  const firstCardId = state.selectedCardIds[0];
  if (!firstCardId) {
    return { state, outcome: 'ignored' };
  }

  const firstCard = flippedCards.find((card) => card.cardId === firstCardId);
  if (!firstCard || firstCard.isMatched) {
    return { state, outcome: 'ignored' };
  }

  const nextMoves = state.moves + 1;

  // Matching pair
  if (firstCard.pairId === targetCard.pairId) {
    const matchedCards = flippedCards.map((card) =>
      card.cardId === firstCardId || card.cardId === cardId
        ? { ...card, isFlipped: true, isMatched: true }
        : card,
    );
    const nextMatchedPairs = state.matchedPairs + 1;
    const isCompleted = nextMatchedPairs >= state.totalPairs;

    return {
      outcome: isCompleted ? 'completed' : 'matched',
      state: {
        ...state,
        cards: matchedCards,
        selectedCardIds: [],
        isResolvingMismatch: false,
        moves: nextMoves,
        matchedPairs: nextMatchedPairs,
        status: isCompleted ? 'completed' : 'playing',
      },
    };
  }

  // Mismatch: keep both cards temporarily visible and lock further taps until resolved
  return {
    outcome: 'mismatch-pending',
    state: {
      ...state,
      cards: flippedCards,
      selectedCardIds: [firstCardId, cardId],
      isResolvingMismatch: true,
      moves: nextMoves,
      status: nextStatus,
    },
  };
}

export function resolveMismatch(state: MemoryGameState): MemoryGameState {
  if (!state.isResolvingMismatch) {
    return state;
  }

  if (state.selectedCardIds.length === 0) {
    return {
      ...state,
      isResolvingMismatch: false,
    };
  }

  const selectedSet = new Set(state.selectedCardIds);
  const resetCards = state.cards.map((card) =>
    selectedSet.has(card.cardId) && !card.isMatched
      ? { ...card, isFlipped: false }
      : card,
  );

  return {
    ...state,
    cards: resetCards,
    selectedCardIds: [],
    isResolvingMismatch: false,
  };
}

export function formatElapsedTime(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) {
    return '00:00';
  }
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export interface FocusRefreshPolicyInput {
  readonly wasBlurred: boolean;
  readonly isConfigured: boolean;
  readonly isAuthenticated: boolean;
  readonly hasCouple: boolean;
  readonly photoStatus: 'idle' | 'loading' | 'loaded' | 'error';
  readonly playablePhotoCount: number;
}

/**
 * Refresh couple photos on screen focus only after a real blur->focus transition
 * when the deck could not previously start (< 2 photos or load error).
 * Returning to or updating state within an already playable game never regenerates signed URLs.
 */
export function shouldRefreshPhotoLibraryOnFocus(
  input: FocusRefreshPolicyInput,
): boolean {
  if (
    !input.wasBlurred ||
    !input.isConfigured ||
    !input.isAuthenticated ||
    !input.hasCouple ||
    input.photoStatus === 'loading'
  ) {
    return false;
  }

  return input.playablePhotoCount < MIN_MEMORY_PAIRS || input.photoStatus === 'error';
}
