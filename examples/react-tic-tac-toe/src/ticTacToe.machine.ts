import { createMachine } from 'xstate';
import {
  createModel,
  ModelContextFrom,
  ModelEventsFrom
} from 'xstate/lib/model';

type Player = 'x' | 'o';

const model = createModel(
  {
    board: Array(9).fill(null) as Array<Player | null>,
    moves: 0,
    player: 'x' as Player,
    winner: undefined as Player | undefined
  },
  {
    events: {
      PLAY: (value: number) => ({ value }),
      RESET: () => ({})
    }
  }
);

const isValidMove = (
  ctx: ModelContextFrom<typeof model>,
  e: ModelEventsFrom<typeof model> & { type: 'PLAY' }
) => {
  return ctx.board[e.value] === null;
};

function checkWin(ctx: ModelContextFrom<typeof model>) {
  const { board } = ctx;
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

  for (let line of winningLines) {
    const xWon = line.every((index) => {
      return board[index] === 'x';
    });

    if (xWon) {
      return true;
    }

    const oWon = line.every((index) => {
      return board[index] === 'o';
    });

    if (oWon) {
      return true;
    }
  }
}

function checkDraw(ctx: ModelContextFrom<typeof model>) {
  return ctx.moves === 9;
}

export const ticTacToeMachine = createMachine<typeof model>(
  {
    initial: 'playing',
    context: model.initialContext,
    states: {
      playing: {
        always: [
          { target: 'gameOver.winner', cond: 'checkWin' },
          { target: 'gameOver.draw', cond: 'checkDraw' }
        ],
        on: {
          PLAY: [
            {
              target: 'playing',
              cond: 'isValidMove',
              actions: 'updateBoard'
            }
          ]
        }
      },
      gameOver: {
        initial: 'winner',
        states: {
          winner: {
            tags: 'winner',
            entry: 'setWinner'
          },
          draw: {
            tags: 'draw'
          }
        },
        on: {
          RESET: {
            target: 'playing',
            actions: 'resetGame'
          }
        }
      }
    }
  },
  {
    actions: {
      updateBoard: model.assign(
        {
          board: (ctx, e) => {
            const updatedBoard = [...ctx.board];
            updatedBoard[e.value] = ctx.player;
            return updatedBoard;
          },
          moves: (ctx) => ctx.moves + 1,
          player: (ctx) => (ctx.player === 'x' ? 'o' : 'x')
        },
        'PLAY'
      ),
      resetGame: model.reset(),
      setWinner: model.assign({
        winner: (ctx) => (ctx.player === 'x' ? 'o' : 'x')
      })
    },
    guards: {
      checkWin,
      checkDraw,
      isValidMove
    }
  }
);
