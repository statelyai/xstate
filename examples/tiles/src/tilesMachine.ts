import { createMachine, enqueueActions } from 'xstate';

function range(num: number): number[] {
  return Array.from(Array(num).keys());
}

export interface Tile {
  index: number;
  x: number;
  y: number;
}

export const tilesMachine = createMachine({
  types: {} as {
    context: {
      tiles: number[];
      selected: Tile | undefined;
      hovered: Tile | undefined;
    };
  },
  guards: {
    isAdjacent: ({ context: { selected, hovered } }) => {
      if (!selected || !hovered) {
        return false;
      }
      const { x: hx, y: hy } = hovered;
      const { x: sx, y: sy } = selected;
      return (
        (hx === sx && Math.abs(hy - sy) === 1) ||
        (hy === sy && Math.abs(hx - sx) === 1)
      );
    },
    allTilesInOrder: ({ context: { tiles } }) =>
      tiles.every((tile, idx) => tile === idx)
  },
  actions: {
    clearSelectedTile: ({ context }) => ({
      context: { ...context, selected: undefined }
    }),
    clearHoveredTile: ({ context }) => ({
      context: { ...context, hovered: undefined }
    }),
    setSelectedTile: ({ context, event }) => ({
      context: { ...context, selected: event.tile }
    }),
    setHoveredTile: ({ context, event }) => ({
      context: { ...context, hovered: event.tile }
    }),
    swapTiles: ({ context }) => ({
      context: {
        ...context,
        tiles: swap(
          context.tiles,
          context.hovered!.index,
          context.selected!.index
        )
      }
    }),
    shuffleTiles: ({ context }) => {
      const newTiles = [...context.tiles];
      for (let i = newTiles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newTiles[i], newTiles[j]] = [newTiles[j], newTiles[i]];
      }
      return { context: { ...context, tiles: newTiles } };
    }
  },
  context: {
    tiles: range(16),
    selected: undefined,
    hovered: undefined
  },
  initial: 'start',
  states: {
    start: {},
    gameOver: {
      id: 'gameOver',
      // make the game replayable
      on: {
        shuffle: ({ context, event, guards, actions }, enq) => {
          enq((actionArgs) => actions['shuffleTiles'](actionArgs as any));
          return { target: 'playing' };
        }
      }
    },
    playing: {
      on: {
        shuffle: { target: undefined }
      },
      states: {
        selecting: {
          id: 'selecting',
          on: {
            'tile.select': ({ context, event, guards, actions }, enq) => {
              enq((actionArgs) =>
                actions['setSelectedTile'](actionArgs as any)
              );
              return { target: 'selected' };
            }
          }
        },
        selected: {
          on: {
            'move.canceled': ({ context, event, guards, actions }, enq) => {
              enq((actionArgs) =>
                actions['clearSelectedTile'](actionArgs as any)
              );
              enq((actionArgs) =>
                actions['clearHoveredTile'](actionArgs as any)
              );
              return { target: 'selecting' };
            },
            'tile.hover': [
              ({ context, event, guards, actions }, enq) => {
                enq((actionArgs) =>
                  actions['setHoveredTile'](actionArgs as any)
                );
              }
            ],
            'tile.move': ({ context, event, guards, actions }, enq) => {
              enq(
                enqueueActions(({ enqueue, check }) => {
                  if (check('isAdjacent')) {
                    enqueue('swapTiles');
                    enqueue('clearSelectedTile');
                    enqueue('clearHoveredTile');
                  }
                })
              );
              return { target: '#selecting' };
            }
          }
        }
      },
      always: ({ context, event, guards, actions }, enq) => {
        if (!guards['allTilesInOrder']({ context, event })) {
          return;
        }
        return { target: '#gameOver' };
      },
      initial: 'selecting'
    }
  },
  on: {
    shuffle: ({ context, event, guards, actions }, enq) => {
      enq((actionArgs) => actions['shuffleTiles'](actionArgs as any));
      return { target: '.playing' };
    }
  }
});

export function swap<T extends any[]>(arr: T, a: number, b: number): T {
  [arr[a], arr[b]] = [arr[b], arr[a]];
  return arr;
}
