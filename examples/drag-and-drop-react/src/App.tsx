import { useEffect } from 'react';
import { useActor } from '@xstate/react';
import { dragMachine } from './dragMachine';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();
import './App.css';

export default function App() {
  const [state, send] = useActor(dragMachine, {
    inspect: inspector.inspect
  });
  const { items, sourceIndex, targetIndex, offsetY } = state.context;
  const isDragging = state.matches('dragging');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        send({ type: 'CANCEL' });
      }
    };

    window.addEventListener('keydown', onKeyDown);

    return () => window.removeEventListener('keydown', onKeyDown);
  }, [send]);

  return (
    <div id="app">
      <h1>Drag and drop</h1>
      <p className="status">
        State: <code>{String(state.value)}</code>
        {isDragging && <> · offset {Math.round(offsetY)}px</>}
      </p>
      <p className="hint">
        Press and move more than 5px to start dragging. Press Escape to cancel.
      </p>

      <ul className="list">
        {items.map((item, index) => (
          <li
            key={item}
            className={[
              'item',
              isDragging && index === sourceIndex ? 'dragging' : '',
              isDragging && index === targetIndex && index !== sourceIndex
                ? 'over'
                : ''
            ]
              .filter(Boolean)
              .join(' ')}
            style={
              isDragging && index === sourceIndex
                ? { transform: `translateY(${offsetY}px)` }
                : undefined
            }
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              send({ type: 'POINTER_DOWN', index, y: event.clientY });
            }}
            onPointerMove={(event) => {
              send({ type: 'POINTER_MOVE', y: event.clientY });

              const element = document.elementFromPoint(
                event.clientX,
                event.clientY
              );
              const overIndex = Number(
                element?.closest('.item')?.getAttribute('data-index') ?? -1
              );

              if (overIndex >= 0) {
                send({ type: 'POINTER_OVER', index: overIndex });
              }
            }}
            onPointerUp={() => send({ type: 'POINTER_UP' })}
            onPointerCancel={() => send({ type: 'CANCEL' })}
            data-index={index}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
