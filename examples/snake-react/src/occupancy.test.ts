import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOccupancyIndex } from './occupancy.ts';

test('preserves head, apple, first body segment priority and direction', () => {
  const context = {
    gridSize: { x: 25, y: 15 },
    score: 0,
    highScore: 0,
    dir: 'Right' as const,
    apple: { x: 2, y: 3 },
    snake: [
      { x: 1, y: 3, dir: 'Up' as const },
      { x: 2, y: 3, dir: 'Down' as const },
      { x: 3, y: 3, dir: 'Left' as const },
      { x: 3, y: 3, dir: 'Right' as const }
    ]
  };
  const cells = createOccupancyIndex(context);
  assert.deepEqual(cells.get('1,3'), { type: 'head', dir: 'Right' });
  assert.deepEqual(cells.get('2,3'), { type: 'apple', dir: undefined });
  assert.deepEqual(cells.get('3,3'), { type: 'body', dir: 'Left' });
  assert.equal(cells.get('4,3'), undefined);
  assert.deepEqual(
    createOccupancyIndex({ ...context, apple: { x: 1, y: 3 } }).get('1,3'),
    { type: 'head', dir: 'Right' }
  );
});

test('does not alias out-of-bounds positions onto valid grid cells', () => {
  const cells = createOccupancyIndex({
    gridSize: { x: 25, y: 15 },
    score: 0,
    highScore: 0,
    dir: 'Left',
    apple: { x: 2, y: 2 },
    snake: [
      { x: -1, y: 1, dir: 'Left' },
      { x: 24, y: 0, dir: 'Right' }
    ]
  });
  assert.deepEqual(cells.get('24,0'), { type: 'body', dir: 'Right' });
});
