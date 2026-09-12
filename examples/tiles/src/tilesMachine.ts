import { types, createMachine } from 'xstate';

export interface Tile {
  index: number;
  x: number;
  y: number;
}
function adjacent(a: Tile, b: Tile) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
}
function shuffle(tiles: number[]) {
  const result = [...tiles];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export const tilesMachine = createMachine({
  schemas: {
    context: types<{
      tiles: number[];
      selected: Tile | undefined;
      hovered: Tile | undefined;
    }>(),
    events: {
      'tile.select': types<{ tile: Tile }>(),
      'tile.hover': types<{ tile: Tile }>(),
      'tile.move': types<{}>(),
      'move.canceled': types<{}>(),
      shuffle: types<{}>()
    }
  },
  context: {
    tiles: Array.from({ length: 16 }, (_, index) => index),
    selected: undefined,
    hovered: undefined
  },
  initial: 'start',
  states: {
    start: {},
    gameOver: {},
    playing: {
      on: { shuffle: {} },
      initial: 'selecting',
      states: {
        selecting: {
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
            'tile.move': ({ context }) => ({
              target: 'selecting',
              context: {
                tiles:
                  context.selected &&
                  context.hovered &&
                  adjacent(context.selected, context.hovered)
                    ? swap(
                        context.tiles,
                        context.selected.index,
                        context.hovered.index
                      )
                    : context.tiles,
                selected: undefined,
                hovered: undefined
              }
            })
          }
        }
      },
      always: ({ context }) =>
        context.tiles.every((tile, index) => tile === index)
          ? { target: 'gameOver' }
          : undefined
    }
  },
  on: {
    shuffle: ({ context }) => ({
      target: '.playing',
      context: {
        tiles: shuffle(context.tiles),
        selected: undefined,
        hovered: undefined
      }
    })
  }
});

export function swap<T>(arr: T[], a: number, b: number): T[] {
  const result = [...arr];
  [result[a], result[b]] = [result[b], result[a]];
  return result;
}
