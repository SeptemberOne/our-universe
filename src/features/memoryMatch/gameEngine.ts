import type {
  FlipResult,
  MemoryArtworkId,
  MemoryCardState,
  MemoryGameState,
} from './types';

export type RandomFn = () => number;

function normalizeRandom(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  if (value >= 1) {
    return 1 - Number.EPSILON;
  }
  return value;
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

export function createDeck(
  pairIds: readonly MemoryArtworkId[],
  randomFn: RandomFn = Math.random,
): MemoryCardState[] {
  const uniquePairIds = Array.from(new Set(pairIds));
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
  pairIds: readonly MemoryArtworkId[],
  randomFn: RandomFn = Math.random,
): MemoryGameState {
  const uniquePairIds = Array.from(new Set(pairIds));
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
