import './App.css';
import { createStore } from '@xstate/store';
import { useSelector } from '@xstate/store/react';
import { useEffect } from 'react';
import { createBrowserInspector } from '@statelyai/inspect';

const inspector = createBrowserInspector();

const store = createStore({
  context: {
    count: 0
  },
  on: {
    inc: (context, event: { by: number }) => {
      return {
        count: context.count + event.by
      };
    },
    reset: (_context, _ev, { emit }) => {
      emit({ type: 'reset' });
      return {
        count: 0
      };
    }
  }
});

store.inspect(inspector.inspect);

function App() {
  const count = useSelector(store, (s) => s.context.count);

  useEffect(() => {
    const sub = store.on('reset', () => {
      console.log('Count reset!');
    });

    return sub.unsubscribe;
  }, []);

  return (
    <>
      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '.5rem'
        }}
      >
        <button onClick={() => store.send({ type: 'inc', by: 1 })}>
          count is {count}
        </button>
        <button onClick={() => store.send({ type: 'reset' })}>reset</button>
      </div>
    </>
  );
}

export default App;
