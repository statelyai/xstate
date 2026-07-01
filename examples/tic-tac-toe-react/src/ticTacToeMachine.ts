import { EventObject, createMachine } from 'xstate';

function assertEvent<TEvent extends EventObject, Type extends TEvent['type']>(
  ev: TEvent,
  type: Type
): asserts ev is Extract<TEvent, { type: Type }> {
  if (ev.type !== type) {
    throw new Error('Unexpected event type.');
  }
}

type Player = 'x' | 'o';

const context = {
  board: Array(9).fill(null) as Array<Player | null>,
  moves: 0,
  player: 'x' as Player,
  winner: undefined as Player | undefined
};

export const ticTacToeMachine = createMachine({
  initial: 'playing',
  types: {} as {
    context: typeof context;
    events: { type: 'PLAY'; value: number } | { type: 'RESET' };
  },
  context,
  states: {
    playing: {
      always: [
        ({ context, event, guards, actions }, enq) => {
          if (!guards['checkWin']({ context, event })) {
            return;
          }
          return { target: 'gameOver.winner' };
        },
        ({ context, event, guards, actions }, enq) => {
          if (!guards['checkDraw']({ context, event })) {
            return;
          }
          return { target: 'gameOver.draw' };
        }
      ],
      on: {
        PLAY: [
          ({ context, event, guards, actions }, enq) => {
            if (!guards['isValidMove']({ context, event })) {
              return;
            }
            enq((actionArgs) => actions['updateBoard'](actionArgs as any));
            return { target: 'playing' };
          }
        ]
      }
    },
    gameOver: {
      initial: 'winner',
      states: {
        winner: {
          tags: 'winner',
          entry: (args, enq) => {
            enq((actionArgs) => args.actions['setWinner'](actionArgs as any));
          }
        },
        draw: {
          tags: 'draw'
        }
      },
      on: {
        RESET: ({ context, event, guards, actions }, enq) => {
          enq((actionArgs) => actions['resetGame'](actionArgs as any));
          return { target: 'playing' };
        }
      }
    }
  },
  actions: {
    updateBoard: ({ context, event }) => {
      assertEvent(event, 'PLAY');
      const updatedBoard = [...context.board];
      updatedBoard[event.value] = context.player;
      return {
        context: {
          ...context,
          board: updatedBoard,
          moves: context.moves + 1,
          player: context.player === 'x' ? 'o' : 'x'
        }
      };
    },
    resetGame: ({ context }) => ({ context: { ...context } }),
    setWinner: ({ context }) => ({
      context: {
        ...context,
        winner: context.player === 'x' ? 'o' : 'x'
      }
    })
  },
  guards: {
    checkWin: ({ context }) => {
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
    },
    checkDraw: ({ context }) => {
      return context.moves === 9;
    },
    isValidMove: ({ context, event }) => {
      if (event.type !== 'PLAY') {
        return false;
      }

      return context.board[event.value] === null;
    }
  }
});
