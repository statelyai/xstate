import './App.css';
import { useStore, useSelector } from '@xstate/store/react';
import { useEffect } from 'react';

function Counter({ initialCount }: { initialCount: number }) {
  const store = useStore({
    context: {
      count: initialCount
    },
    emits: {
      reset: (_: {}) => {}
    },
    on: {
      inc: (context, event: { by: number }) => {
        return {
          count: context.count + event.by
        };
      },
      reset: (_context, _ev, { emit }) => {
        emit.reset({});
        return {
          count: 0
        };
      }
    }
  });
  const count = useSelector(store, (s) => s.context.count);

  useEffect(() => {
    const sub = store.on('reset', () => {
      console.log('Count reset!');
    });

    return sub.unsubscribe;
  }, [store]);

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

function App() {
  return (
    <>
      <Counter initialCount={0} />
      <Counter initialCount={10} />
      <Counter initialCount={100} />
    </>
  );
}

export default App;
