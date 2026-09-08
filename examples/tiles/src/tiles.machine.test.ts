import { expect, it, vi, afterEach } from 'vitest';
import { createActor } from 'xstate';
import { tilesMachine } from './tilesMachine';
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('swaps adjacent tiles immutably and clears selection after an invalid move', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const actor = createActor(tilesMachine).start();
  actor.send({ type: 'shuffle' });
  const before = actor.getSnapshot();
  const tiles = [...before.context.tiles];
  actor.send({ type: 'tile.select', tile: { index: 0, x: 0, y: 0 } });
  actor.send({ type: 'tile.hover', tile: { index: 1, x: 1, y: 0 } });
  actor.send({ type: 'tile.move' });
  expect(actor.getSnapshot().context.tiles.slice(0, 2)).toEqual([
    tiles[1],
    tiles[0]
  ]);
  expect(before.context.tiles).toEqual(tiles);
  actor.send({ type: 'tile.select', tile: { index: 0, x: 0, y: 0 } });
  actor.send({ type: 'tile.hover', tile: { index: 15, x: 3, y: 3 } });
  const valid = actor.getSnapshot().context.tiles;
  actor.send({ type: 'tile.move' });
  expect(actor.getSnapshot().context).toEqual({
    tiles: valid,
    selected: undefined,
    hovered: undefined
  });
  actor.stop();
});
