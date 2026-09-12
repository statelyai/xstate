import { types, createMachine } from 'xstate';

type Player = 'x' | 'o';
const initialContext = () => ({
  board: Array<Player | null>(9).fill(null),
  moves: 0,
  player: 'x' as Player,
  winner: undefined as Player | undefined
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

export const ticTacToeMachine = createMachine({
  schemas: {
    context: types<ReturnType<typeof initialContext>>(),
    events: { PLAY: types<{ value: number }>(), RESET: types<{}>() }
  },
  context: initialContext,
  initial: 'playing',
  states: {
    playing: {
      always: ({ context }) => {
        const line = winningLines.find(
          ([a, b, c]) =>
            context.board[a] &&
            context.board[a] === context.board[b] &&
            context.board[a] === context.board[c]
        );
        if (line)
          return {
            target: 'gameOver.winner',
            context: { ...context, winner: context.board[line[0]]! }
          };
        if (context.moves === 9) return { target: 'gameOver.draw' };
      },
      on: {
        PLAY: ({ context, event }) => {
          if (
            !Number.isInteger(event.value) ||
            context.board[event.value] !== null
          )
            return;
          const board = [...context.board];
          board[event.value] = context.player;
          return {
            context: {
              ...context,
              board,
              moves: context.moves + 1,
              player: context.player === 'x' ? ('o' as const) : ('x' as const)
            }
          };
        }
      }
    },
    gameOver: {
      initial: 'winner',
      states: { winner: { tags: ['winner'] }, draw: { tags: ['draw'] } },
      on: { RESET: () => ({ target: 'playing', context: initialContext() }) }
    }
  }
});
