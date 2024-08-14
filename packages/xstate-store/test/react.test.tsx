import { fireEvent, screen, render } from '@testing-library/react';
import { createStore, fromStore } from '../src/index.ts';
import { useSelector, useStoreState } from '../src/react.ts';
import {
  useActor,
  useActorRef,
  useSelector as useXStateSelector
} from '@xstate/react';
import ReactDOM from 'react-dom';

it('useSelector should work', () => {
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

  const Counter = () => {
    const count = useSelector(store, (s) => s.context.count);

    return (
      <div
        data-testid="count"
        onClick={() => {
          store.send({ type: 'inc' });
        }}
      >
        {count}
      </div>
    );
  };

  render(<Counter />);

  const countDiv = screen.getByTestId('count');

  expect(countDiv.textContent).toEqual('0');

  fireEvent.click(countDiv);

  expect(countDiv.textContent).toEqual('1');
});

it('useSelector can take in a custom comparator', () => {
  const store = createStore(
    {
      items: [1, 2]
    },
    {
      same: {
        items: () => [1, 2] // different array, same items
      },
      different: {
        items: () => [3, 4]
      }
    }
  );

  let renderCount = 0;
  const Items = () => {
    renderCount++;
    const items = useSelector(
      store,
      (s) => s.context.items,
      (a, b) => JSON.stringify(a) === JSON.stringify(b)
    );

    return (
      <>
        <div
          data-testid="items"
          onClick={() => {
            store.send({ type: 'same' });
          }}
        >
          {items.join(',')}
        </div>
        <button
          data-testid="different"
          onClick={() => {
            store.send({ type: 'different' });
          }}
        ></button>
      </>
    );
  };

  render(<Items />);

  const itemsDiv = screen.getByTestId('items');

  expect(itemsDiv.textContent).toEqual('1,2');

  expect(renderCount).toBe(1);

  fireEvent.click(itemsDiv);

  expect(itemsDiv.textContent).toEqual('1,2');

  expect(renderCount).toBe(1);

  fireEvent.click(screen.getByTestId('different'));

  expect(itemsDiv.textContent).toEqual('3,4');

  expect(renderCount).toBe(2);
});

it('can batch updates', () => {
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

  const Counter = () => {
    const count = useSelector(store, (s) => s.context.count);

    return (
      <div
        data-testid="count"
        onClick={() => {
          ReactDOM.unstable_batchedUpdates(() => {
            store.send({ type: 'inc' });
            store.send({ type: 'inc' });
          });
        }}
      >
        {count}
      </div>
    );
  };

  render(<Counter />);

  const countDiv = screen.getByTestId('count');

  expect(countDiv.textContent).toEqual('0');

  fireEvent.click(countDiv);

  expect(countDiv.textContent).toEqual('2');
});

it('useSelector (@xstate/react) should work', () => {
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

  const Counter = () => {
    const count = useXStateSelector(store, (s) => s.context.count);

    return (
      <div
        data-testid="count"
        onClick={() => {
          store.send({ type: 'inc' });
        }}
      >
        {count}
      </div>
    );
  };

  render(<Counter />);

  const countDiv = screen.getByTestId('count');

  expect(countDiv.textContent).toEqual('0');

  fireEvent.click(countDiv);

  expect(countDiv.textContent).toEqual('1');
});

it('useActor (@xstate/react) should work', () => {
  const store = fromStore(
    {
      count: 0
    },
    {
      inc: {
        count: (ctx) => ctx.count + 1
      }
    }
  );

  const Counter = () => {
    const [snapshot, send] = useActor(store);

    return (
      <div
        data-testid="count"
        onClick={() => {
          send({ type: 'inc' });
        }}
      >
        {snapshot.context.count}
      </div>
    );
  };

  render(<Counter />);

  const countDiv = screen.getByTestId('count');

  expect(countDiv.textContent).toEqual('0');

  fireEvent.click(countDiv);

  expect(countDiv.textContent).toEqual('1');
});

it('useActorRef (@xstate/react) should work', () => {
  const store = fromStore(
    {
      count: 0
    },
    {
      inc: {
        count: (ctx) => ctx.count + 1
      }
    }
  );

  const Counter = () => {
    const actorRef = useActorRef(store);
    const count = useXStateSelector(actorRef, (s) => s.context.count);

    return (
      <div
        data-testid="count"
        onClick={() => {
          actorRef.send({ type: 'inc' });
        }}
      >
        {count}
      </div>
    );
  };

  render(<Counter />);

  const countDiv = screen.getByTestId('count');

  expect(countDiv.textContent).toEqual('0');

  fireEvent.click(countDiv);

  expect(countDiv.textContent).toEqual('1');
});

it('useStoreState should work', () => {
  const store = (initialCount: number) =>
    createStore(
      {
        count: initialCount
      },
      {
        increment: (context, event: { by: number }) => {
          return {
            count: context.count + 1
          };
        },
        decrement: (context, event: { by: number }) => {
          return {
            count: context.count - 1
          };
        }
      }
    );

  const Counter = () => {
    const [state, { increment }] = useStoreState(store(42).logic);

    return (
      <>
        <button data-testid="increment" onClick={() => increment({ by: 1 })}>
          +
        </button>
        <output data-testid="count">{state.context.count}</output>
      </>
    );
  };

  render(<Counter />);

  const incrementButton = screen.getByTestId('increment');
  const countOutput = screen.getByTestId('count');

  expect(countOutput.textContent).toEqual('0');

  fireEvent.click(incrementButton);

  expect(countOutput.textContent).toEqual('1');
});
