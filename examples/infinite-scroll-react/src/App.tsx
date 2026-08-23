import { useEffect, useRef } from 'react';
import { useActorRef, useSelector } from '@xstate/react';
import { feedMachine } from './feedMachine';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();
import './App.css';

export default function App() {
  const feedRef = useActorRef(feedMachine, {
    inspect: inspector.inspect
  });
  const state = useSelector(feedRef, (s) => s);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return;
    }

    // The observer is only an event source; all decisions live in the machine
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        feedRef.send({ type: 'LOAD_MORE' });
      }
    });

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [feedRef]);

  const { items, page, errorMessage } = state.context;

  return (
    <div id="app">
      <h1>Infinite scroll</h1>
      <p className="status">
        State: <code>{String(state.value)}</code> · {items.length} items loaded
        · next page {page}
      </p>

      <ul className="feed">
        {items.map((item) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>

      {state.matches('loadingPage') && <p className="note">Loading page…</p>}

      {state.matches('error') && (
        <div className="error">
          <span>{errorMessage}</span>
          <button onClick={() => feedRef.send({ type: 'RETRY' })}>Retry</button>
        </div>
      )}

      {state.matches('end') && <p className="note">No more items.</p>}

      <div ref={sentinelRef} className="sentinel" />
    </div>
  );
}
