import { fireEvent, screen, render } from '@testing-library/react';
import { createStore, fromStore, createStoreConfig } from '../src/index.ts';
import { useSelector } from '../src/react.ts';
import {
  useActor,
  useActorRef,
  useSelector as useXStateSelector
} from '@xstate/react';
import ReactDOM from 'react-dom';
import { useStore } from '../src/react.ts';

it('useSelector should work', () => {
  const store = createStore({
    context: {
      count: 0
    },
    on: {
      inc: (ctx) => ({
        ...ctx,
        count: ctx.count + 1
      })
    }
  });

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
  const store = createStore({
    context: {
      items: [1, 2]
    },
    on: {
      same: (ctx) => ({
        ...ctx,
        items: [1, 2] // different array, same items
      }),
      different: (ctx) => ({
        ...ctx,
        items: [3, 4]
      })
    }
  });

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
  const store = createStore({
    context: {
      count: 0
    },
    on: {
      inc: (ctx) => ({
        ...ctx,
        count: ctx.count + 1
      })
    }
  });

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
  const store = createStore({
    context: {
      count: 0
    },
    on: {
      inc: (ctx) => ({
        ...ctx,
        count: ctx.count + 1
      })
    }
  });

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
  const store = fromStore({
    context: {
      count: 0
    },
    on: {
      inc: (ctx) => ({
        ...ctx,
        count: ctx.count + 1
      })
    }
  });

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
  const store = fromStore({
    context: {
      count: 0
    },
    on: {
      inc: (ctx) => ({
        ...ctx,
        count: ctx.count + 1
      })
    }
  });

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

describe('useStore', () => {
  it('should create and maintain a stable store reference', () => {
    let storeRefs: any[] = [];

    const Counter = () => {
      const store = useStore({
        context: { count: 0 },
        on: {
          inc: (ctx) => ({
            ...ctx,
            count: ctx.count + 1
          })
        }
      });

      storeRefs.push(store);
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

    // Initial render
    expect(countDiv.textContent).toBe('0');

    // Store reference should be stable across renders
    const initialStoreRef = storeRefs[0];
    fireEvent.click(countDiv);
    expect(countDiv.textContent).toBe('1');
    expect(storeRefs.every((ref) => ref === initialStoreRef)).toBe(true);
  });

  it('should handle emitted events', () => {
    const onEmit = jest.fn();

    const Counter = () => {
      const store = useStore({
        context: { count: 0 },
        emits: {
          countChanged: (payload: { newCount: number }) => {
            onEmit(payload);
          }
        },
        on: {
          inc: (ctx, _, enq) => {
            const newCount = ctx.count + 1;
            enq.emit.countChanged({ newCount });
            return {
              ...ctx,
              count: newCount
            };
          }
        }
      });

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

    fireEvent.click(countDiv);
    expect(onEmit).toHaveBeenCalledWith({ type: 'countChanged', newCount: 1 });
  });

  it('should work with multiple components using the same store config', () => {
    const storeConfig = createStoreConfig({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({
          ...ctx,
          count: ctx.count + 1
        })
      }
    });

    const Counter = () => {
      const store = useStore(storeConfig);
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

    // Render two separate counter components
    render(
      <>
        <Counter />
        <Counter />
      </>
    );

    const countDivs = screen.getAllByTestId('count');

    // Each counter should have its own independent store
    expect(countDivs[0].textContent).toBe('0');
    expect(countDivs[1].textContent).toBe('0');

    fireEvent.click(countDivs[0]);
    expect(countDivs[0].textContent).toBe('1');
    expect(countDivs[1].textContent).toBe('0');
  });
});
