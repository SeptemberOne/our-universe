import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDeck,
  createInitialGameState,
  flipCard,
  formatElapsedTime,
  resolveMismatch,
  shuffleArray,
} from '../src/features/memoryMatch/gameEngine.ts';

const SAMPLE_IDS = ['crescentMoon', 'ringedPlanet', 'twinStars'];
const NO_SHUFFLE_RNG = () => 0.9999;

test('createDeck creates two face-down cards per pair id', () => {
  const deck = createDeck(SAMPLE_IDS, () => 0.42);
  assert.equal(deck.length, SAMPLE_IDS.length * 2);

  for (const id of SAMPLE_IDS) {
    const matches = deck.filter((card) => card.pairId === id);
    assert.equal(matches.length, 2);
    assert.ok(matches.every((card) => !card.isFlipped && !card.isMatched));
  }
});

test('createDeck and createInitialGameState handle empty input safely', () => {
  const emptyDeck = createDeck([]);
  assert.deepEqual(emptyDeck, []);

  const emptyState = createInitialGameState([]);
  assert.deepEqual(emptyState.cards, []);
  assert.deepEqual(emptyState.selectedCardIds, []);
  assert.equal(emptyState.isResolvingMismatch, false);
  assert.equal(emptyState.moves, 0);
  assert.equal(emptyState.matchedPairs, 0);
  assert.equal(emptyState.totalPairs, 0);
  assert.equal(emptyState.status, 'idle');

  const flipEmpty = flipCard(emptyState, 'crescentMoon-a');
  assert.equal(flipEmpty.outcome, 'ignored');
  assert.strictEqual(flipEmpty.state, emptyState);

  const resolvedEmpty = resolveMismatch(emptyState);
  assert.strictEqual(resolvedEmpty, emptyState);
});

test('createInitialGameState deduplicates repeated pair IDs', () => {
  const state = createInitialGameState(['crescentMoon', 'crescentMoon', 'ringedPlanet'], NO_SHUFFLE_RNG);
  assert.equal(state.totalPairs, 2);
  assert.equal(state.cards.length, 4);

  const cardIds = new Set(state.cards.map((card) => card.cardId));
  assert.equal(cardIds.size, 4);
});

test('shuffleArray preserves every item once without mutating input and guards RNG bounds', () => {
  const original = ['a', 'b', 'c', 'd', 'e'];
  const snapshot = [...original];

  const shuffled = shuffleArray(original, () => 0);
  assert.deepEqual(original, snapshot);
  assert.notStrictEqual(shuffled, original);
  assert.equal(shuffled.length, original.length);
  assert.deepEqual([...shuffled].sort(), [...original].sort());
  assert.notDeepEqual(shuffled, original);

  // Out-of-range and non-finite RNG values do not produce undefined holes
  const outOfRangeValues = [-1, 1, Number.NaN];
  let idx = 0;
  const bounded = shuffleArray(original, () => {
    const val = outOfRangeValues[idx % outOfRangeValues.length];
    idx += 1;
    return val;
  });
  assert.deepEqual([...bounded].sort(), [...original].sort());
});

test('flipCard detects matching pairs, increments moves, and completes game', () => {
  const state = createInitialGameState(['crescentMoon', 'ringedPlanet'], NO_SHUFFLE_RNG);
  assert.equal(state.status, 'idle');

  const first = flipCard(state, 'crescentMoon-a');
  assert.equal(first.outcome, 'first-flip');
  assert.equal(first.state.status, 'playing');
  assert.equal(first.state.moves, 0);

  // Tapping the same already-flipped card is ignored
  const duplicateTap = flipCard(first.state, 'crescentMoon-a');
  assert.equal(duplicateTap.outcome, 'ignored');

  const matchOne = flipCard(first.state, 'crescentMoon-b');
  assert.equal(matchOne.outcome, 'matched');
  assert.equal(matchOne.state.moves, 1);
  assert.equal(matchOne.state.matchedPairs, 1);
  assert.equal(matchOne.state.status, 'playing');

  const secondFirst = flipCard(matchOne.state, 'ringedPlanet-a');
  const completed = flipCard(secondFirst.state, 'ringedPlanet-b');
  assert.equal(completed.outcome, 'completed');
  assert.equal(completed.state.moves, 2);
  assert.equal(completed.state.matchedPairs, 2);
  assert.equal(completed.state.status, 'completed');
});

test('flipCard ignores invalid card IDs in idle and playing states', () => {
  const initial = createInitialGameState(SAMPLE_IDS, NO_SHUFFLE_RNG);

  const unknownIdle = flipCard(initial, 'nonexistent-card');
  assert.equal(unknownIdle.outcome, 'ignored');
  assert.strictEqual(unknownIdle.state, initial);

  const emptyIdIdle = flipCard(initial, '');
  assert.equal(emptyIdIdle.outcome, 'ignored');
  assert.strictEqual(emptyIdIdle.state, initial);

  const firstFlip = flipCard(initial, 'crescentMoon-a');
  const unknownPlaying = flipCard(firstFlip.state, 'nonexistent-card');
  assert.equal(unknownPlaying.outcome, 'ignored');
  assert.strictEqual(unknownPlaying.state, firstFlip.state);
});

test('already matched cards cannot be flipped again while playing', () => {
  const initial = createInitialGameState(['crescentMoon', 'ringedPlanet'], NO_SHUFFLE_RNG);
  const first = flipCard(initial, 'crescentMoon-a');
  const matched = flipCard(first.state, 'crescentMoon-b');
  assert.equal(matched.state.status, 'playing');

  const reflipA = flipCard(matched.state, 'crescentMoon-a');
  assert.equal(reflipA.outcome, 'ignored');
  assert.strictEqual(reflipA.state, matched.state);
  assert.equal(reflipA.state.moves, 1);
  assert.deepEqual(reflipA.state.selectedCardIds, []);

  const reflipB = flipCard(matched.state, 'crescentMoon-b');
  assert.equal(reflipB.outcome, 'ignored');
  assert.strictEqual(reflipB.state, matched.state);
});

test('matching a pair does not modify unrelated cards', () => {
  const initial = createInitialGameState(SAMPLE_IDS, NO_SHUFFLE_RNG);
  const first = flipCard(initial, 'crescentMoon-a');
  const matched = flipCard(first.state, 'crescentMoon-b');

  const unrelatedCards = matched.state.cards.filter(
    (card) => card.pairId !== 'crescentMoon',
  );
  assert.equal(unrelatedCards.length, 4);
  assert.ok(
    unrelatedCards.every(
      (card) =>
        !card.isFlipped &&
        !card.isMatched &&
        initial.cards.some(
          (orig) => orig.cardId === card.cardId && orig.pairId === card.pairId,
        ),
    ),
  );
});

test('flipCard locks board on mismatch until resolveMismatch is called', () => {
  const initial = createInitialGameState(['crescentMoon', 'ringedPlanet'], NO_SHUFFLE_RNG);
  const first = flipCard(initial, 'crescentMoon-a');
  const mismatch = flipCard(first.state, 'ringedPlanet-a');

  assert.equal(mismatch.outcome, 'mismatch-pending');
  assert.equal(mismatch.state.isResolvingMismatch, true);
  assert.equal(mismatch.state.moves, 1);
  assert.equal(mismatch.state.matchedPairs, 0);

  // Additional taps are blocked during mismatch resolution
  const blocked = flipCard(mismatch.state, 'crescentMoon-b');
  assert.equal(blocked.outcome, 'ignored');
  assert.strictEqual(blocked.state, mismatch.state);

  // Resolving flips mismatched cards back face-down and unlocks the board
  const resolved = resolveMismatch(mismatch.state);
  assert.equal(resolved.isResolvingMismatch, false);
  assert.equal(resolved.selectedCardIds.length, 0);
  assert.ok(resolved.cards.every((card) => !card.isFlipped));
});

test('resolveMismatch is idempotent when called twice', () => {
  const initial = createInitialGameState(['crescentMoon', 'ringedPlanet'], NO_SHUFFLE_RNG);
  const first = flipCard(initial, 'crescentMoon-a');
  const mismatch = flipCard(first.state, 'ringedPlanet-a');

  const firstResolve = resolveMismatch(mismatch.state);
  const secondResolve = resolveMismatch(firstResolve);

  assert.strictEqual(secondResolve, firstResolve);
  assert.equal(secondResolve.isResolvingMismatch, false);
  assert.deepEqual(secondResolve.selectedCardIds, []);
  assert.equal(secondResolve.moves, 1);
});

test('resolveMismatch preserves previously matched pairs and untouched cards', () => {
  const initial = createInitialGameState(SAMPLE_IDS, NO_SHUFFLE_RNG);
  const matchStep1 = flipCard(initial, 'crescentMoon-a');
  const matchStep2 = flipCard(matchStep1.state, 'crescentMoon-b');
  assert.equal(matchStep2.state.matchedPairs, 1);

  const mismatchStep1 = flipCard(matchStep2.state, 'ringedPlanet-a');
  const mismatchStep2 = flipCard(mismatchStep1.state, 'twinStars-a');
  assert.equal(mismatchStep2.outcome, 'mismatch-pending');

  const resolved = resolveMismatch(mismatchStep2.state);
  assert.equal(resolved.isResolvingMismatch, false);
  assert.equal(resolved.matchedPairs, 1);
  assert.deepEqual(resolved.selectedCardIds, []);

  const matchedPair = resolved.cards.filter((card) => card.pairId === 'crescentMoon');
  assert.ok(matchedPair.every((card) => card.isFlipped && card.isMatched));

  const mismatchedA = resolved.cards.find((card) => card.cardId === 'ringedPlanet-a');
  const mismatchedB = resolved.cards.find((card) => card.cardId === 'twinStars-a');
  assert.equal(mismatchedA?.isFlipped, false);
  assert.equal(mismatchedA?.isMatched, false);
  assert.equal(mismatchedB?.isFlipped, false);
  assert.equal(mismatchedB?.isMatched, false);

  const untouched = resolved.cards.filter(
    (card) => card.cardId === 'ringedPlanet-b' || card.cardId === 'twinStars-b',
  );
  assert.ok(untouched.every((card) => !card.isFlipped && !card.isMatched));
});

test('game completion prevents further moves on any card ID', () => {
  let state = createInitialGameState(['crescentMoon', 'ringedPlanet'], NO_SHUFFLE_RNG);
  state = flipCard(state, 'crescentMoon-a').state;
  state = flipCard(state, 'crescentMoon-b').state;
  state = flipCard(state, 'ringedPlanet-a').state;
  const completed = flipCard(state, 'ringedPlanet-b');

  assert.equal(completed.outcome, 'completed');
  assert.equal(completed.state.status, 'completed');
  assert.equal(completed.state.moves, 2);

  for (const id of ['crescentMoon-a', 'ringedPlanet-b', 'unknown-card']) {
    const attempt = flipCard(completed.state, id);
    assert.equal(attempt.outcome, 'ignored');
    assert.strictEqual(attempt.state, completed.state);
    assert.equal(attempt.state.moves, 2);
    assert.equal(attempt.state.status, 'completed');
  }
});

test('formatElapsedTime formats seconds as MM:SS across boundaries', () => {
  assert.equal(formatElapsedTime(0), '00:00');
  assert.equal(formatElapsedTime(9), '00:09');
  assert.equal(formatElapsedTime(59), '00:59');
  assert.equal(formatElapsedTime(60), '01:00');
  assert.equal(formatElapsedTime(75), '01:15');
  assert.equal(formatElapsedTime(3599), '59:59');
  assert.equal(formatElapsedTime(3600), '60:00');
  assert.equal(formatElapsedTime(-5), '00:00');
  assert.equal(formatElapsedTime(Number.NaN), '00:00');
  assert.equal(formatElapsedTime(Number.POSITIVE_INFINITY), '00:00');
});
