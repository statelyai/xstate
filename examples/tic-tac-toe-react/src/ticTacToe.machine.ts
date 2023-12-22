import { EventObject, createMachine, assign } from 'xstate';

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

export const ticTacToeMachine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QAoC2BDAxgCwJYDswBKAOgAcAbdATwKgGIAFAGQEEBNAbQAYBdRUGQD2sXABdcQ-AJAAPRAFYALAEYSAZgBMC7twBsCzUoAcShQE4ANCGqJj5khfPPnS7uvML1CgL4-raFh4hKSUNHT06BQA7jSwPPxIIMKiElIy8gh63Na2CCoqxo7qJdqaAOx65eWa6n4BGDgExORUtPgMUbHU8SqJgiLiktJJmRVFNTruCvbqKuXzuYhKepqOLsoq5urGc5r1IIFNISRQ6KhgAPIAbmAATvQASgCiAMrPACoJMilD6aOKPRqTS6XSrTTGPTGLxLBCabQkLbOcpKbTccrbUx+fwgfBCCBwGRHYLEH6DNIjUCZFSaWEFEguRlM5x1HHE5qhNp0MmpYYZRDqcoKEio4wqLTGcruFEqPR09EkcolLSo7aaTxVA7sk5nC43e48v6UuSIDETUHTbjmeHeWEVcoMlxAtxOOZaxok0i6q63O4kaIEQh3Q0U-kIUx6RUW7xWm0KWHqKrrZx6dTopTWt1sj0c07nH33EgQO7oaIhvkA8MrKOgmPW2rxmyKaHJ8xmPZK63YnxAA */
    initial: 'playing',
    types: {} as {
      context: typeof context;
      events: { type: 'PLAY'; value: number } | { type: 'RESET' };
    },
    context,
    states: {
      playing: {
        always: [
          { target: 'gameOver.winner', guard: 'checkWin' },
          { target: 'gameOver.draw', guard: 'checkDraw' }
        ],
        on: {
          PLAY: [
            {
              target: 'playing',
              guard: 'isValidMove',
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
      updateBoard: assign({
        board: ({ context, event }) => {
          assertEvent(event, 'PLAY');
          const updatedBoard = [...context.board];
          updatedBoard[event.value] = context.player;
          return updatedBoard;
        },
        moves: ({ context }) => context.moves + 1,
        player: ({ context }) => (context.player === 'x' ? 'o' : 'x')
      }),
      resetGame: assign(context),
      setWinner: assign({
        winner: ({ context }) => (context.player === 'x' ? 'o' : 'x')
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
  }
);
