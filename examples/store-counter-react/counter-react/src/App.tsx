import './App.css';
import { createStore } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

const store = createStore(
  {
    count: 0
  },
  {
    inc: {
      count: (ctx) => ctx.count + 1
    }
  }
);

function App() {
  const count = useSelector(store, (s) => s.context.count);

  return (
    <>
      <h1>XState Store counter example</h1>
      <div className="card">
        <button onClick={() => store.send({ type: 'inc' })}>
          count is {count}
        </button>
      </div>
    </>
  );
}

export default App;
