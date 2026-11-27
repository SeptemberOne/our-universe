import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDeck,
  createInitialGameState,
  flipCard,
  formatElapsedTime,
  resolveMismatch,
} from '../src/features/memoryMatch/gameEngine.ts';

const SAMPLE_IDS = ['crescentMoon', 'ringedPlanet', 'twinStars'];

test('createDeck creates two face-down cards per pair id', () => {
  const deck = createDeck(SAMPLE_IDS, () => 0.42);
  assert.equal(deck.length, SAMPLE_IDS.length * 2);

  for (const id of SAMPLE_IDS) {
    const matches = deck.filter((card) => card.pairId === id);
    assert.equal(matches.length, 2);
    assert.ok(matches.every((card) => !card.isFlipped && !card.isMatched));
  }
});

test('flipCard detects matching pairs, increments moves, and completes game', () => {
  // Deterministic non-shuffling RNG (always swaps index with itself)
  let state = createInitialGameState(['crescentMoon', 'ringedPlanet'], () => 0.9999);
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

  // Further taps after completion are ignored
  const afterComplete = flipCard(completed.state, 'crescentMoon-a');
  assert.equal(afterComplete.outcome, 'ignored');
});

test('flipCard locks board on mismatch until resolveMismatch is called', () => {
  const initial = createInitialGameState(['crescentMoon', 'ringedPlanet'], () => 0.9999);
  const first = flipCard(initial, 'crescentMoon-a');
  const mismatch = flipCard(first.state, 'ringedPlanet-a');

  assert.equal(mismatch.outcome, 'mismatch-pending');
  assert.equal(mismatch.state.isResolvingMismatch, true);
  assert.equal(mismatch.state.moves, 1);
  assert.equal(mismatch.state.matchedPairs, 0);

  // Additional taps are blocked during mismatch resolution
  const blocked = flipCard(mismatch.state, 'crescentMoon-b');
  assert.equal(blocked.outcome, 'ignored');

  // Resolving flips mismatched cards back face-down and unlocks the board
  const resolved = resolveMismatch(mismatch.state);
  assert.equal(resolved.isResolvingMismatch, false);
  assert.equal(resolved.selectedCardIds.length, 0);
  assert.ok(resolved.cards.every((card) => !card.isFlipped));
});

test('formatElapsedTime formats seconds as MM:SS', () => {
  assert.equal(formatElapsedTime(0), '00:00');
  assert.equal(formatElapsedTime(9), '00:09');
  assert.equal(formatElapsedTime(75), '01:15');
  assert.equal(formatElapsedTime(-5), '00:00');
});
