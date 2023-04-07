import { createMachine, assign } from 'xstate';
import { choose, log } from 'xstate/lib/actions';

function range(num: number): number[] {
  return Array.from(Array(num).keys());
}

export interface Tile {
  index: number;
  x: number;
  y: number;
}

export const tilesMachine = createMachine({
  schema: {
    context: {} as {
      tiles: number[];
      selected: Tile | undefined;
      hovered: Tile | undefined;
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
        shuffle: { target: 'playing', actions: ['shuffleTiles'] }
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
            'tile.select': {
              target: 'selected',
              actions: ['setSelectedTile']
            }
          }
        },
        selected: {
          on: {
            'move.canceled': {
              actions: ['clearSelectedTile', 'clearHoveredTile'],
              target: 'selecting'
            },
            'tile.hover': [
              {
                actions: [
                  'setHoveredTile',
                  (ctx, e) => console.log('hovered', ctx, e.tile)
                ]
                // target: '.canSwapTiles'
              }
            ],
            'tile.move': {
              actions: choose([
                {
                  cond: 'isAdjacent',
                  actions: [
                    'swapTiles',
                    'clearSelectedTile',
                    'clearHoveredTile'
                  ]
                }
              ]),
              target: '#selecting'
            }
          }
        }
      },
      always: {
        cond: 'allTilesInOrder',
        target: '#gameOver'
      },
      initial: 'selecting'
    }
  },
  on: {
    shuffle: { target: '.playing', actions: ['shuffleTiles'] }
  }
}).withConfig({
  guards: {
    isAdjacent: ({ selected, hovered }) => {
      console.log('isAdjacent', selected, hovered);
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
    allTilesInOrder: ({ tiles }) => tiles.every((tile, idx) => tile === idx)
  },
  actions: {
    clearSelectedTile: assign({
      selected: undefined
    }),
    clearHoveredTile: assign({
      hovered: undefined
    }),
    setSelectedTile: assign({
      selected: (_, event) => event.tile
    }),
    setHoveredTile: assign({
      hovered: (_, event) => event.tile
    }),
    swapTiles: assign({
      tiles: ({ tiles, selected, hovered }) => {
        return swap(tiles, hovered?.index, selected?.index);
      }
    }),
    shuffleTiles: assign({
      tiles: ({ tiles }) => {
        const newTiles = [...tiles];
        for (let i = newTiles.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newTiles[i], newTiles[j]] = [newTiles[j], newTiles[i]];
        }
        return newTiles;
      }
    })
  }
});

export function swap(arr, a, b) {
  [arr[a], arr[b]] = [arr[b], arr[a]];
  return arr;
}
