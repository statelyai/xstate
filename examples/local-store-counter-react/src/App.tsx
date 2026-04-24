import './App.css';
import { useStore, useSelector } from '@xstate/store-react';

function Counter({ initialCount }: { initialCount: number }) {
  const store = useStore({
    context: {
      count: initialCount
    },
    on: {
      inc: (context, event: { by: number }) => {
        return {
          count: context.count + event.by
        };
      },
      reset: () => {
        return {
          count: 0
        };
      }
    }
  });
  const count = useSelector(store, (s) => s.context.count);

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
