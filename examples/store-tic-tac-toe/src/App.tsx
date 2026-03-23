import { useSelector } from '@xstate/store/react';
import { gameStore, getGameOutcome } from './store';
import './App.css';

interface SquareProps {
  position: number;
  value: string | null;
  variant: 'winning' | 'unplayed' | 'played';
}

function Square({ position, value, variant }: SquareProps) {
  return (
    <button
      className={`square ${variant}`}
      onClick={() => gameStore.trigger.played({ position })}
      disabled={variant !== 'unplayed'}
    >
      {value}
    </button>
  );
}

function Board() {
  const board = useSelector(gameStore, (state) => state.context.board);
  const outcome = getGameOutcome(board);

  return (
    <div className="board">
      {Array(9)
        .fill(null)
        .map((_, i) => (
          <Square
            key={i}
            position={i}
            value={board[i]}
            variant={
              outcome.line?.includes(i)
                ? 'winning'
                : board[i]
                  ? 'played'
                  : 'unplayed'
            }
          />
        ))}
    </div>
  );
}

function Status() {
  const currentPlayer = useSelector(
    gameStore,
    (state) => state.context.currentPlayer
  );
  const board = useSelector(gameStore, (state) => state.context.board);
  const outcome = getGameOutcome(board);

  if (outcome.winner && outcome.winner !== 'draw') {
    return <div className="status">Winner: {outcome.winner}</div>;
  }
  if (outcome.winner === 'draw') {
    return <div className="status">Draw!</div>;
  }
  return <div className="status">Current player: {currentPlayer}</div>;
}

function App() {
  const status = useSelector(gameStore, (state) => state.context.status);

  return (
    <div className="game">
      <h1>Tic Tac Toe</h1>
      <Status />
      <Board />
      {status !== 'playing' && (
        <button className="reset" onClick={() => gameStore.trigger.reset()}>
          Play Again
        </button>
      )}
    </div>
  );
}

export default App;
