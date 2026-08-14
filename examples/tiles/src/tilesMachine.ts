import { setup, types } from 'xstate';

export interface Tile {
  index: number;
  x: number;
  y: number;
}

interface TilesContext {
  tiles: number[];
  selected: Tile | undefined;
  hovered: Tile | undefined;
}

function range(num: number): number[] {
  return Array.from(Array(num).keys());
}

function swap(tiles: number[], a: number, b: number): number[] {
  const swapped = [...tiles];
  [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
  return swapped;
}

function shuffle(tiles: number[]): number[] {
  const shuffled = [...tiles];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export const tilesMachine = setup({
  schemas: {
    context: types<TilesContext>(),
    events: {
      shuffle: types<{}>(),
      'tile.select': types<{ tile: Tile }>(),
      'tile.hover': types<{ tile: Tile }>(),
      'tile.move': types<{}>(),
      'move.canceled': types<{}>()
    }
  },
  guards: {
    isAdjacent: ({ selected, hovered }: TilesContext) => {
      if (!selected || !hovered) {
        return false;
      }

      return (
        (hovered.x === selected.x && Math.abs(hovered.y - selected.y) === 1) ||
        (hovered.y === selected.y && Math.abs(hovered.x - selected.x) === 1)
      );
    },
    allTilesInOrder: ({ tiles }: TilesContext) =>
      tiles.every((tile, index) => tile === index)
  }
}).createMachine({
  id: 'tiles',
  initial: 'start',
  context: {
    tiles: range(16),
    selected: undefined,
    hovered: undefined
  },
  states: {
    start: {},
    gameOver: {
      id: 'gameOver'
    },
    playing: {
      initial: 'selecting',
      on: {
        // Shuffling is only allowed before starting and after winning
        shuffle: undefined
      },
      states: {
        selecting: {
          id: 'selecting',
          on: {
            'tile.select': ({ context, event }) => ({
              target: 'selected',
              context: { ...context, selected: event.tile }
            })
          }
        },
        selected: {
          on: {
            'tile.hover': ({ context, event }) => ({
              context: { ...context, hovered: event.tile }
            }),
            'move.canceled': ({ context }) => ({
              target: 'selecting',
              context: { ...context, selected: undefined, hovered: undefined }
            }),
            'tile.move': ({ context, guards }) => {
              if (!guards.isAdjacent(context)) {
                return { target: '#selecting' };
              }

              return {
                target: '#selecting',
                context: {
                  ...context,
                  tiles: swap(
                    context.tiles,
                    context.hovered!.index,
                    context.selected!.index
                  ),
                  selected: undefined,
                  hovered: undefined
                }
              };
            }
          }
        }
      },
      always: ({ context, guards }) => {
        if (!guards.allTilesInOrder(context)) {
          return;
        }

        return { target: '#gameOver' };
      }
    }
  },
  on: {
    shuffle: ({ context }) => ({
      target: '.playing',
      context: {
        ...context,
        tiles: shuffle(context.tiles),
        selected: undefined,
        hovered: undefined
      }
    })
  }
});
