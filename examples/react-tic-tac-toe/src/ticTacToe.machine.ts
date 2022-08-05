import { createModel } from 'xstate/lib/model';
import { ContextFrom, EventFrom, EventObject } from 'xstate';

function assertEvent<TEvent extends EventObject, Type extends TEvent['type']>(
  ev: TEvent,
  type: Type
): asserts ev is Extract<TEvent, { type: Type }> {
  if (ev.type !== type) {
    throw new Error('Unexpected event type.');
  }
}

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
  context: ContextFrom<typeof model>,
  event: EventFrom<typeof model>
) => {
  if (event.type !== 'PLAY') {
    return false;
  }

  return context.board[event.value] === null;
};

function checkWin(context: ContextFrom<typeof model>) {
  const { board } = context;
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

  return false;
}

function checkDraw(context: ContextFrom<typeof model>) {
  return context.moves === 9;
}

export const ticTacToeMachine = model.createMachine(
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
      updateBoard: model.assign({
        board: (context, event) => {
          assertEvent(event, 'PLAY');
          const updatedBoard = [...context.board];
          updatedBoard[event.value] = context.player;
          return updatedBoard;
        },
        moves: (context) => context.moves + 1,
        player: (context) => (context.player === 'x' ? 'o' : 'x')
      }),
      resetGame: model.reset(),
      setWinner: model.assign({
        winner: (context) => (context.player === 'x' ? 'o' : 'x')
      })
    },
    guards: {
      checkWin,
      checkDraw,
      isValidMove
    }
  }
);
