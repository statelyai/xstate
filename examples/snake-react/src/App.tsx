import { useEffect } from 'react';
import { useActor } from '@xstate/react';
import { type Dir, getGamObjectAtPos, snakeMachine } from './snakeMachine';

function App() {
  const [current, send] = useActor(snakeMachine);
  const { gridSize, score, highScore } = current.context;
  const isGameOver = current.matches('Game Over');
  console.log(current);

  useEffect(() => {
    function keyListener(event: KeyboardEvent) {
      const [maybeKey, maybeDir] = event.key.split('Arrow');
      if (maybeDir) {
        send({ type: 'ARROW_KEY', dir: maybeDir as Dir });
      } else if (maybeKey === 'r') {
        send({ type: 'NEW_GAME' });
      }
    }

    window.addEventListener('keydown', keyListener);
    return () => window.removeEventListener('keydown', keyListener);
  }, [send]);

  return (
    <div className="App">
      <header>
        <h1 style={{ marginBottom: 0 }}>XSnake</h1>
        <p style={{ margin: 0 }}>Snake with a sweet twist, built with XState</p>
      </header>
      <p style={{ fontSize: '1.2em', marginBottom: 0 }}>
        {isGameOver ? 'Game Over!' : '\u00A0'}
      </p>
      <p>
        Score: {score}
        <br />
        High score: {highScore}
      </p>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${gridSize.x}, 1fr)`,
          gridTemplateRows: `repeat(${gridSize.y}, 1fr)`
        }}
      >
        {Array.from({ length: gridSize.y }).map((_, row) =>
          Array.from({ length: gridSize.x }).map((_, col) => {
            const { type, dir } =
              getGamObjectAtPos(current.context, { x: col, y: row }) || {};
            return (
              <div className="cell" key={`${col} ${row}`}>
                <span
                  role="img"
                  aria-label={type}
                  className={type}
                  data-dir={dir}
                />
              </div>
            );
          })
        )}
      </div>
      <p style={{ fontSize: '0.7em' }}>
        Press arrow keys to move, "r" for new game.
      </p>
    </div>
  );
}

export default App;
