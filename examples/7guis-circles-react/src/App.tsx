import type { MouseEvent } from 'react';
import { useActor } from '@xstate/react';
import './App.css';
import { circlesMachine } from './circlesMachine';

const WIDTH = 480;
const HEIGHT = 320;

function App() {
  const [state, send] = useActor(circlesMachine);
  const { past, circles, future, selectedId } = state.context;
  const adjusting = state.matches('adjusting');
  const selected = circles.find((circle) => circle.id === selectedId) ?? null;

  const pointAt = (event: MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();

    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  return (
    <section id="app">
      <h1>Circle drawer</h1>

      <div className="toolbar">
        <button disabled={!past.length} onClick={() => send({ type: 'undo' })}>
          Undo
        </button>
        <button
          disabled={!future.length}
          onClick={() => send({ type: 'redo' })}
        >
          Redo
        </button>
        <span className="hint">
          Click to add a circle. Right-click a circle to adjust its diameter.
        </span>
      </div>

      <svg
        width={WIDTH}
        height={HEIGHT}
        onClick={(event) => send({ type: 'canvasClick', ...pointAt(event) })}
        onContextMenu={(event) => {
          event.preventDefault();
          send({ type: 'openAdjuster', ...pointAt(event) });
        }}
      >
        <rect width={WIDTH} height={HEIGHT} className="canvas" />
        {circles.map((circle) => (
          <circle
            key={circle.id}
            cx={circle.x}
            cy={circle.y}
            r={circle.diameter / 2}
            className={circle.id === selectedId ? 'selected' : ''}
          />
        ))}
      </svg>

      {adjusting && selected ? (
        <div className="adjuster">
          <label>
            Diameter of circle at ({Math.round(selected.x)},{' '}
            {Math.round(selected.y)})
            <input
              type="range"
              min={4}
              max={200}
              value={selected.diameter}
              autoFocus
              onChange={(event) =>
                send({
                  type: 'resize',
                  diameter: event.target.valueAsNumber
                })
              }
            />
          </label>
          {/* One undo entry is recorded when the drag ends, not per step. */}
          <button onClick={() => send({ type: 'commitResize' })}>Done</button>
        </div>
      ) : null}
    </section>
  );
}

export default App;
