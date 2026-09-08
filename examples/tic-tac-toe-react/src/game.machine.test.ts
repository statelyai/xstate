import { expect, it, vi, afterEach } from 'vitest';
import { createActor } from 'xstate';
import { ticTacToeMachine } from './ticTacToeMachine';
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('rejects occupied cells, detects a winner, and fully resets the board', () => {
  const actor = createActor(ticTacToeMachine).start();
  actor.send({ type: 'PLAY', value: 0 });
  const first = actor.getSnapshot();
  actor.send({ type: 'PLAY', value: 0 });
  expect(actor.getSnapshot()).toBe(first);
  for (const value of [3, 1, 4, 2]) actor.send({ type: 'PLAY', value });
  expect(actor.getSnapshot().hasTag('winner')).toBe(true);
  expect(actor.getSnapshot().context.winner).toBe('x');
  expect(first.context.board).toEqual([
    'x',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null
  ]);
  actor.send({ type: 'RESET' });
  expect(actor.getSnapshot().matches('playing')).toBe(true);
  expect(actor.getSnapshot().context).toEqual({
    board: Array(9).fill(null),
    moves: 0,
    player: 'x',
    winner: undefined
  });
  actor.stop();
});
it('detects a draw', () => {
  const actor = createActor(ticTacToeMachine).start();
  for (const value of [0, 1, 2, 4, 3, 5, 7, 6, 8])
    actor.send({ type: 'PLAY', value });
  expect(actor.getSnapshot().hasTag('draw')).toBe(true);
  actor.stop();
});
