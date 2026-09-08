import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActor } from 'xstate';
import { createInitialContext, snakeMachine } from './snakeMachine';

const actors: Array<{ stop(): unknown }> = [];

function startGame(context = createInitialContext()) {
  const snapshot = createActor(snakeMachine).getPersistedSnapshot();
  const restored = { ...snapshot, context };
  const actor = createActor(snakeMachine, { snapshot: restored }).start();
  actors.push(actor);
  return actor;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  actors.splice(0).forEach((actor) => actor.stop());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('snake machine', () => {
  it('grows on an apple, scores, and preserves the high score after restart', () => {
    const actor = startGame();
    actor.send({ type: 'ARROW_KEY', dir: 'Right' });
    vi.advanceTimersByTime(400);
    const eaten = actor.getSnapshot().context;
    expect(eaten.snake[0]).toMatchObject({ x: 18, y: 7 });
    expect(eaten.snake).toHaveLength(4);
    expect(eaten.score).toBe(1);
    expect(eaten.highScore).toBe(1);
    expect(
      eaten.snake.some(
        (part) => part.x === eaten.apple.x && part.y === eaten.apple.y
      )
    ).toBe(false);
    vi.advanceTimersByTime(560);
    expect(actor.getSnapshot().matches('Game Over')).toBe(true);
    const highScore = actor.getSnapshot().context.highScore;
    actor.send({ type: 'NEW_GAME' });
    expect(actor.getSnapshot().matches('New Game')).toBe(true);
    expect(actor.getSnapshot().context).toEqual({
      ...createInitialContext(),
      highScore
    });
  });

  it('ignores reverse input before moving and while moving', () => {
    const actor = startGame();
    actor.send({ type: 'ARROW_KEY', dir: 'Left' });
    expect(actor.getSnapshot().context.dir).toBe('Right');
    expect(actor.getSnapshot().context.snake[0]).toMatchObject({ x: 13, y: 7 });
    actor.send({ type: 'ARROW_KEY', dir: 'Left' });
    expect(actor.getSnapshot().context.dir).toBe('Right');
    actor.send({ type: 'ARROW_KEY', dir: 'Down' });
    vi.advanceTimersByTime(80);
    expect(actor.getSnapshot().context.snake[0]).toMatchObject({ x: 13, y: 8 });
  });

  it('ends on a wall collision and stops the movement timer', () => {
    const actor = startGame();
    actor.send({ type: 'ARROW_KEY', dir: 'Up' });
    vi.advanceTimersByTime(560);
    expect(actor.getSnapshot().matches('Game Over')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    const stopped = actor.getSnapshot();
    vi.advanceTimersByTime(1000);
    expect(actor.getSnapshot()).toBe(stopped);
  });

  it('ends on a body collision', () => {
    const actor = startGame({
      ...createInitialContext(),
      snake: [
        { x: 2, y: 2, dir: 'Right' },
        { x: 2, y: 3, dir: 'Up' },
        { x: 3, y: 3, dir: 'Left' },
        { x: 3, y: 2, dir: 'Down' },
        { x: 4, y: 2, dir: 'Down' }
      ]
    });
    actor.send({ type: 'ARROW_KEY', dir: 'Right' });
    expect(actor.getSnapshot().matches('Game Over')).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});

it('finishes after eating the last free cell without sampling another apple', () => {
  vi.spyOn(Math, 'random').mockImplementation(() => {
    throw new Error('A completed board must not sample another apple');
  });
  const actor = startGame({
    ...createInitialContext(),
    gridSize: { x: 2, y: 2 },
    snake: [
      { x: 0, y: 0, dir: 'Right' },
      { x: 0, y: 1, dir: 'Up' },
      { x: 1, y: 1, dir: 'Left' }
    ],
    apple: { x: 1, y: 0 }
  });
  actor.subscribe({ error: () => {} });
  actor.send({ type: 'ARROW_KEY', dir: 'Right' });
  expect(actor.getSnapshot().matches('Game Over')).toBe(true);
  expect(actor.getSnapshot().context.score).toBe(1);
  expect(actor.getSnapshot().context.highScore).toBe(1);
  expect(vi.getTimerCount()).toBe(0);
  actor.send({ type: 'NEW_GAME' });
  expect(actor.getSnapshot().context).toEqual({
    ...createInitialContext(),
    highScore: 1
  });
});
