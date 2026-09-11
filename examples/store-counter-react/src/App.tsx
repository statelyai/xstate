import './App.css';
import { createStore } from '@xstate/store';
import { useSelector, useStore } from '@xstate/store-react';
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
    reset: () => {
      return {
        count: 0
      };
    }
  }
});

store.inspect(inspector.inspect);

function LocalCounter() {
  const localStore = useStore(
    {
      context: {
        count: 0
      },
      on: {
        inc: (context, event: { by: number }) => {
          return {
            count: context.count + event.by
          };
        }
      }
    },
    { inspect: inspector.inspect }
  );
  const count = useSelector(localStore, (s) => s.context.count);

  return (
    <div className="card">
      <button onClick={() => localStore.send({ type: 'inc', by: 1 })}>
        local count is {count}
      </button>
    </div>
  );
}

function App() {
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
      <LocalCounter />
    </>
  );
}

export default App;
