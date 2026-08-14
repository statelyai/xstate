import { useSelector } from '@xstate/store-react';
import { drawingStore, historyOf } from './drawingStore.ts';

export default function App() {
  const dots = useSelector(drawingStore, (s) => s.context.dots);
  // The snapshot strategy exposes its history on the snapshot itself.
  const pastCount = useSelector(drawingStore, (s) => historyOf(s).past.length);
  const futureCount = useSelector(
    drawingStore,
    (s) => historyOf(s).future.length
  );

  return (
    <main>
      <h1>Undo / redo</h1>
      <p>Click the canvas to drop a dot.</p>
      <div
        className="canvas"
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          drawingStore.trigger.draw({
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top
          });
        }}
      >
        {dots.map((dot, index) => (
          <span
            key={index}
            className="dot"
            style={{ left: dot.x, top: dot.y, background: dot.color }}
          />
        ))}
      </div>
      <div className="controls">
        <button
          disabled={pastCount === 0}
          onClick={() => drawingStore.trigger.undo()}
        >
          Undo ({pastCount})
        </button>
        <button
          disabled={futureCount === 0}
          onClick={() => drawingStore.trigger.redo()}
        >
          Redo ({futureCount})
        </button>
        <button onClick={() => drawingStore.trigger.clear()}>Clear</button>
      </div>
    </main>
  );
}
