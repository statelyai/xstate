import { setup, types } from 'xstate';

export type Player = 'x' | 'o';

type Board = Array<Player | null>;

interface TicTacToeContext {
  board: Board;
  moves: number;
  player: Player;
  winner: Player | undefined;
}

const initialContext = (): TicTacToeContext => ({
  board: Array(9).fill(null),
  moves: 0,
  player: 'x',
  winner: undefined
});

const winningLines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

const checkWin = (board: Board) =>
  winningLines.some(
    (line) =>
      line.every((i) => board[i] === 'x') || line.every((i) => board[i] === 'o')
  );

const checkDraw = (moves: number) => moves === 9;

const isValidMove = (board: Board, value: number) => board[value] === null;

export const ticTacToeMachine = setup({
  schemas: {
    context: types<TicTacToeContext>(),
    events: {
      PLAY: types<{ value: number }>(),
      RESET: types<{}>()
    },
    tags: types<'winner' | 'draw'>()
  }
}).createMachine({
  initial: 'playing',
  context: initialContext(),
  states: {
    playing: {
      always: ({ context }) => {
        if (checkWin(context.board)) {
          return { target: 'gameOver.winner' };
        }
        if (checkDraw(context.moves)) {
          return { target: 'gameOver.draw' };
        }
      },
      on: {
        PLAY: ({ context, event }) => {
          if (!isValidMove(context.board, event.value)) {
            return;
          }

          const board = [...context.board];
          board[event.value] = context.player;

          return {
            target: 'playing',
            context: {
              board,
              moves: context.moves + 1,
              player: context.player === 'x' ? 'o' : 'x'
            }
          };
        }
      }
    },
    gameOver: {
      initial: 'winner',
      states: {
        winner: {
          tags: ['winner'],
          // The player that made the winning move is the previous player,
          // because `PLAY` already handed the turn over.
          entry: ({ context }) => ({
            context: { winner: context.player === 'x' ? 'o' : 'x' }
          })
        },
        draw: {
          tags: ['draw']
        }
      },
      on: {
        RESET: () => ({
          target: 'playing',
          context: initialContext()
        })
      }
    }
  }
});
