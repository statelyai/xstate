import './App.css';
import { useEffect } from 'react';
import { createStore } from '@xstate/store';
import { useSelector, useStore } from '@xstate/store-react';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

/** One store shared by every component that reads it. */
const globalStore = createStore({
  context: { count: 0 },
  on: {
    inc: (context, event: { by: number }) => ({
      count: context.count + event.by
    }),
    reset: () => ({ count: 0 })
  }
});

globalStore.inspect(inspector.inspect);

function GlobalCounter() {
  const count = useSelector(globalStore, (s) => s.context.count);

  return (
    <div className="card">
      <button onClick={() => globalStore.send({ type: 'inc', by: 1 })}>
        count is {count}
      </button>
      <button onClick={() => globalStore.send({ type: 'reset' })}>reset</button>
    </div>
  );
}

/** A store created per component instance, with its own state. */
function LocalCounter({ initialCount }: { initialCount: number }) {
  const store = useStore({
    context: { count: initialCount },
    on: {
      inc: (context, event: { by: number }) => ({
        count: context.count + event.by
      }),
      reset: () => ({ count: initialCount })
    }
  });
  const count = useSelector(store, (s) => s.context.count);

  // `useStore` creates the store during render, so it is inspected in an effect.
  useEffect(() => store.inspect(inspector.inspect).unsubscribe, [store]);

  return (
    <div className="card">
      <button onClick={() => store.send({ type: 'inc', by: 1 })}>
        count is {count}
      </button>
      <button onClick={() => store.send({ type: 'reset' })}>reset</button>
    </div>
  );
}

function App() {
  return (
    <>
      <h2>Global store</h2>
      <GlobalCounter />
      <GlobalCounter />

      <h2>Local stores</h2>
      <LocalCounter initialCount={0} />
      <LocalCounter initialCount={10} />
    </>
  );
}

export default App;
