import { createStore } from '@xstate/store';

type Player = 'x' | 'o';
type Cell = Player | null;
type Status = 'playing' | 'won' | 'draw';

interface GameState {
  board: Cell[];
  currentPlayer: Player;
  status: Status;
}

const initialState: GameState = {
  board: Array(9).fill(null),
  currentPlayer: 'x',
  status: 'playing'
};

type GameOutcome =
  | { winner: Player; line: [number, number, number] }
  | { winner: 'draw'; line: null }
  | { winner: null; line: null };

// Derived state calculations
export const getGameOutcome = (board: Cell[]): GameOutcome => {
  const lines: [number, number, number][] = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
  ];

  for (const line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }

  if (board.every((cell) => cell !== null)) {
    return { winner: 'draw', line: null };
  }

  return { winner: null, line: null };
};

export const gameStore = createStore({
  context: initialState,
  on: {
    played: (context, event: { position: number }): GameState => {
      // Ignore moves if cell is already taken or game is not in playing state
      if (
        context.status !== 'playing' ||
        context.board[event.position] !== null
      ) {
        return context;
      }

      const newBoard = [...context.board];
      newBoard[event.position] = context.currentPlayer;

      const outcome = getGameOutcome(newBoard);
      const nextPlayer: Player = context.currentPlayer === 'x' ? 'o' : 'x';
      const nextStatus: Status = outcome.winner
        ? 'won'
        : outcome.winner === 'draw'
          ? 'draw'
          : 'playing';

      return {
        board: newBoard,
        currentPlayer: nextPlayer,
        status: nextStatus
      };
    },
    reset: (): GameState => initialState
  }
});
