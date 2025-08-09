import { fireEvent, screen, render, act } from '@testing-library/react';
import {
  createStore,
  fromStore,
  createStoreConfig,
  createAtom
} from '../src/index.ts';
import {
  useSelector,
  useStore,
  useAtom,
  createStoreHook
} from '../src/react.ts';
import {
  useActor,
  useActorRef,
  useSelector as useXStateSelector
} from '@xstate/react';
import ReactDOM from 'react-dom';
import { vi } from 'vitest';

describe('useSelector', () => {
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

  it('useSelector should work with atoms', () => {
    const atom = createAtom(0);

    const Counter = () => {
      const count = useSelector(atom, (s) => s);

      count satisfies number;

      // @ts-expect-error
      count satisfies string;

      return (
        <div data-testid="count" onClick={() => atom.set((prev) => prev + 1)}>
          {count}
        </div>
      );
    };

    render(<Counter />);

    expect(screen.getByTestId('count').textContent).toEqual('0');

    fireEvent.click(screen.getByTestId('count'));

    expect(screen.getByTestId('count').textContent).toEqual('1');
  });
});

describe('XState React hooks', () => {
  it('useSelector (@xstate/react) should work with stores', () => {
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
    const onEmit = vi.fn();

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

describe('atom examples', () => {
  it('first atom example', () => {
    const counter = createAtom(0);

    const Counter = () => {
      const count = useSelector(counter, (s) => s);

      // Type checking
      count satisfies number;

      return (
        <div>
          <h1 data-testid="count">{count}</h1>
          <button
            data-testid="increment"
            onClick={() => counter.set((prev) => prev + 1)}
          >
            Click
          </button>
        </div>
      );
    };

    render(<Counter />);

    const countDisplay = screen.getByTestId('count');
    const button = screen.getByTestId('increment');

    // Initial state
    expect(countDisplay.textContent).toBe('0');

    // After one click
    fireEvent.click(button);
    expect(countDisplay.textContent).toBe('1');

    // After another click
    fireEvent.click(button);
    expect(countDisplay.textContent).toBe('2');
  });

  it('theme switcher example', () => {
    const theme = createAtom('light');

    const ThemeSwitcher = () => {
      const currentTheme = useSelector(theme, (s) => s);

      // Type checking
      currentTheme satisfies string;

      return (
        <div data-testid="themed-div" className={currentTheme}>
          <h1>This is a theme switcher</h1>
          <button
            data-testid="theme-button"
            onClick={() =>
              theme.set(currentTheme === 'light' ? 'dark' : 'light')
            }
          >
            {currentTheme === 'light' ? 'DARK' : 'LIGHT'}
          </button>
        </div>
      );
    };

    render(<ThemeSwitcher />);

    const button = screen.getByTestId('theme-button');
    const themedDiv = screen.getByTestId('themed-div');

    // Initial state
    expect(button.textContent).toBe('DARK');
    expect(themedDiv.className).toBe('light');

    // After click
    fireEvent.click(button);
    expect(button.textContent).toBe('LIGHT');
    expect(themedDiv.className).toBe('dark');

    // Back to light
    fireEvent.click(button);
    expect(button.textContent).toBe('DARK');
    expect(themedDiv.className).toBe('light');
  });

  it('read only atoms example', () => {
    const textAtom = createAtom('readonly atoms');
    const uppercaseAtom = createAtom((get) => get(textAtom).toUpperCase());

    const DerivedAtomDemo = () => {
      const text = useSelector(textAtom, (s) => s);
      const uppercaseText = useSelector(uppercaseAtom, (s) => s);

      // Type checking
      text satisfies string;
      uppercaseText satisfies string;

      return (
        <div className="app">
          <input
            data-testid="text-input"
            value={text}
            onChange={(e) => textAtom.set(e.target.value)}
          />
          <h1 data-testid="uppercase-text">{uppercaseText}</h1>
        </div>
      );
    };

    render(<DerivedAtomDemo />);

    const input = screen.getByTestId('text-input');
    const uppercaseDisplay = screen.getByTestId('uppercase-text');

    // Initial state
    expect((input as HTMLInputElement).value).toBe('readonly atoms');
    expect(uppercaseDisplay.textContent).toBe('READONLY ATOMS');

    // Update input
    fireEvent.change(input, { target: { value: 'hello world' } });
    expect((input as HTMLInputElement).value).toBe('hello world');
    expect(uppercaseDisplay.textContent).toBe('HELLO WORLD');

    // Another update
    fireEvent.change(input, { target: { value: 'testing' } });
    expect((input as HTMLInputElement).value).toBe('testing');
    expect(uppercaseDisplay.textContent).toBe('TESTING');
  });

  it('write only atoms example', () => {
    const dotsAtom = createAtom<[number, number][]>([]);
    const drawingAtom = createAtom(false);

    const handleMouseDown = () => {
      drawingAtom.set(true);
    };

    const handleMouseUp = () => {
      drawingAtom.set(false);
    };

    const handleMouseMove = (point: [number, number]) => {
      const isDrawing = drawingAtom.get();
      if (isDrawing) {
        dotsAtom.set((prev) => [...prev, point]);
      }
    };

    const SvgDots = () => {
      const dots = useSelector(dotsAtom, (s) => s);

      // Type checking
      dots satisfies [number, number][];

      return (
        <g data-testid="dots-group">
          {dots.map(([x, y], index) => (
            <circle
              data-testid={`dot-${index}`}
              cx={x}
              cy={y}
              r="2"
              fill="#aaa"
              key={index}
            />
          ))}
        </g>
      );
    };

    const SvgRoot = () => {
      return (
        <svg
          data-testid="svg-root"
          width="100"
          height="100"
          viewBox="0 0 100 100"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseMove={(e) => {
            handleMouseMove([e.clientX, e.clientY]);
          }}
        >
          <rect width="100" height="100" fill="#eee" />
          <SvgDots />
        </svg>
      );
    };

    render(<SvgRoot />);

    const svg = screen.getByTestId('svg-root');
    const dotsGroup = screen.getByTestId('dots-group');

    // Initially no dots
    expect(dotsGroup.children.length).toBe(0);

    // Simulate drawing action
    fireEvent.mouseDown(svg);
    fireEvent.mouseMove(svg, { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(svg, { clientX: 30, clientY: 40 });
    fireEvent.mouseUp(svg);

    // Should have created two dots
    expect(dotsGroup.children.length).toBe(2);

    // Verify dot positions
    const firstDot = screen.getByTestId('dot-0');
    const secondDot = screen.getByTestId('dot-1');
    expect(firstDot.getAttribute('cx')).toBe('10');
    expect(firstDot.getAttribute('cy')).toBe('20');
    expect(secondDot.getAttribute('cx')).toBe('30');
    expect(secondDot.getAttribute('cy')).toBe('40');

    // Moving without mouse down shouldn't create dots
    fireEvent.mouseMove(svg, { clientX: 50, clientY: 60 });
    expect(dotsGroup.children.length).toBe(2);
  });
});

describe('store examples', () => {
  it('drawing example with store', () => {
    type Point = [number, number];
    type Status = 'idle' | 'drawing';

    const drawingStore = createStore({
      context: {
        dots: [] as Point[],
        status: 'idle' as Status
      },
      on: {
        mouseDown: (ctx) => ({
          ...ctx,
          status: 'drawing' as Status
        }),
        mouseUp: (ctx) => ({
          ...ctx,
          status: 'idle' as Status
        }),
        mouseMove: (ctx, e: { point: Point }) => {
          if (ctx.status !== 'drawing') return ctx;
          return {
            ...ctx,
            dots: [...ctx.dots, e.point]
          };
        }
      }
    });

    const SvgDots = () => {
      const dots = useSelector(drawingStore, (s) => s.context.dots);

      return (
        <g data-testid="dots-group">
          {dots.map(([x, y], index) => (
            <circle
              data-testid={`dot-${index}`}
              cx={x}
              cy={y}
              r="2"
              fill="#aaa"
              key={index}
            />
          ))}
        </g>
      );
    };

    const SvgRoot = () => {
      return (
        <svg
          data-testid="svg-root"
          width="100"
          height="100"
          viewBox="0 0 100 100"
          onMouseDown={() => drawingStore.send({ type: 'mouseDown' })}
          onMouseUp={() => drawingStore.send({ type: 'mouseUp' })}
          onMouseMove={(e) => {
            drawingStore.send({
              type: 'mouseMove',
              point: [e.clientX, e.clientY]
            });
          }}
        >
          <rect width="100" height="100" fill="#eee" />
          <SvgDots />
        </svg>
      );
    };

    render(<SvgRoot />);

    const svg = screen.getByTestId('svg-root');
    const dotsGroup = screen.getByTestId('dots-group');

    // Initially no dots
    expect(dotsGroup.children.length).toBe(0);

    // Simulate drawing action
    fireEvent.mouseDown(svg);
    fireEvent.mouseMove(svg, { clientX: 10, clientY: 20 });
    fireEvent.mouseMove(svg, { clientX: 30, clientY: 40 });
    fireEvent.mouseUp(svg);

    // Should have created two dots
    expect(dotsGroup.children.length).toBe(2);

    // Verify dot positions
    const firstDot = screen.getByTestId('dot-0');
    const secondDot = screen.getByTestId('dot-1');
    expect(firstDot.getAttribute('cx')).toBe('10');
    expect(firstDot.getAttribute('cy')).toBe('20');
    expect(secondDot.getAttribute('cx')).toBe('30');
    expect(secondDot.getAttribute('cy')).toBe('40');

    // Moving without mouse down shouldn't create dots
    fireEvent.mouseMove(svg, { clientX: 50, clientY: 60 });
    expect(dotsGroup.children.length).toBe(2);
  });
});

describe('useAtom', () => {
  it('should return the full atom snapshot when used without selector', () => {
    const atom = createAtom(0);

    const TestComponent = () => {
      const count = useAtom(atom);
      return <div data-testid="value">{count}</div>;
    };

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('value').textContent).toBe('0');
  });

  it('should return selected value when used with selector', () => {
    const atom = createAtom({ count: 0, name: 'test' });

    const TestComponent = () => {
      const count = useAtom(atom, (state) => state.count);
      return <div data-testid="value">{count}</div>;
    };

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('value').textContent).toBe('0');
  });

  it('should update when atom value changes', () => {
    const atom = createAtom({ count: 0 });

    const TestComponent = () => {
      const snapshot = useAtom(atom);
      return (
        <div>
          <div data-testid="value">{snapshot.count}</div>
          <button
            data-testid="increment"
            onClick={() => atom.set({ count: snapshot.count + 1 })}
          >
            Increment
          </button>
        </div>
      );
    };

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('value').textContent).toBe('0');

    act(() => {
      fireEvent.click(getByTestId('increment'));
    });

    expect(getByTestId('value').textContent).toBe('1');
  });

  it('should use custom compare function when provided', () => {
    const renderCount = vi.fn();
    const atom = createAtom({ user: { name: 'test', age: 25 } });

    const TestComponent = () => {
      const userName = useAtom(
        atom,
        (state) => state.user.name,
        (a, b) => a?.toLowerCase() === b?.toLowerCase()
      );

      renderCount();
      return <div data-testid="value">{userName}</div>;
    };

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('value').textContent).toBe('test');
    expect(renderCount).toHaveBeenCalledTimes(1);

    // Update with same value but different case - should not trigger re-render
    act(() => {
      atom.set({ user: { name: 'TEST', age: 25 } });
    });

    expect(renderCount).toHaveBeenCalledTimes(1);
    expect(getByTestId('value').textContent).toBe('test');

    // Update with actually different value - should trigger re-render
    act(() => {
      atom.set({ user: { name: 'john', age: 25 } });
    });

    expect(renderCount).toHaveBeenCalledTimes(2);
    expect(getByTestId('value').textContent).toBe('john');
  });

  it('should handle undefined values correctly', () => {
    const atom = createAtom<{ value: string | undefined }>({
      value: undefined
    });

    const TestComponent = () => {
      const value = useAtom(atom, (state) => state.value);
      return <div data-testid="value">{value ?? 'empty'}</div>;
    };

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('value').textContent).toBe('empty');

    act(() => {
      atom.set({ value: 'defined' });
    });

    expect(getByTestId('value').textContent).toBe('defined');

    act(() => {
      atom.set({ value: undefined });
    });

    expect(getByTestId('value').textContent).toBe('empty');
  });

  it('should work with updater functions', () => {
    const atom = createAtom(0);

    const TestComponent = () => {
      const count = useAtom(atom);
      return (
        <div>
          <div data-testid="count">{count}</div>
          <button
            data-testid="increment"
            onClick={() => atom.set((c) => c + 1)}
          >
            Increment
          </button>
        </div>
      );
    };

    const { getByTestId } = render(<TestComponent />);
    expect(getByTestId('count').textContent).toBe('0');

    act(() => {
      fireEvent.click(getByTestId('increment'));
    });
    expect(getByTestId('count').textContent).toBe('1');

    act(() => {
      fireEvent.click(getByTestId('increment'));
    });
    expect(getByTestId('count').textContent).toBe('2');
  });

  // https://github.com/statelyai/xstate/issues/5306
  it('should work with readonly atoms', () => {
    const booleanTestAtom = createAtom(() => 13 > 12);

    const TestComponent = () => {
      const booleanValue = useAtom(booleanTestAtom);

      booleanValue satisfies boolean;

      // @ts-expect-error
      booleanValue satisfies number;

      return <div data-testid="value">{booleanValue.toString()}</div>;
    };

    render(<TestComponent />);
    expect(screen.getByTestId('value').textContent).toBe('true');
  });
});

describe('createStoreHook', () => {
  it('should create a hook that returns state and triggers', () => {
    const useCountStore = createStoreHook({
      context: { count: 0 },
      on: {
        inc: (ctx, event: { by: number }) => ({
          ...ctx,
          count: ctx.count + event.by
        }),
        reset: (ctx) => ({
          ...ctx,
          count: 0
        })
      }
    });

    const Counter = () => {
      const [count, triggers] = useCountStore((s) => s.context.count);

      return (
        <div>
          <div data-testid="count">{count}</div>
          <button
            data-testid="increment"
            onClick={() => triggers.inc({ by: 1 })}
          >
            +1
          </button>
          <button
            data-testid="increment-5"
            onClick={() => triggers.inc({ by: 5 })}
          >
            +5
          </button>
          <button data-testid="reset" onClick={() => triggers.reset()}>
            Reset
          </button>
        </div>
      );
    };

    render(<Counter />);

    const countDisplay = screen.getByTestId('count');
    const incrementBtn = screen.getByTestId('increment');
    const increment5Btn = screen.getByTestId('increment-5');
    const resetBtn = screen.getByTestId('reset');

    // Initial state
    expect(countDisplay.textContent).toBe('0');

    // Increment by 1
    fireEvent.click(incrementBtn);
    expect(countDisplay.textContent).toBe('1');

    // Increment by 5
    fireEvent.click(increment5Btn);
    expect(countDisplay.textContent).toBe('6');

    // Reset
    fireEvent.click(resetBtn);
    expect(countDisplay.textContent).toBe('0');
  });

  it('should work without selector (return full snapshot)', () => {
    const useFullStore = createStoreHook({
      context: { count: 0, name: 'Test' },
      on: {
        inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
        setName: (ctx, event: { name: string }) => ({
          ...ctx,
          name: event.name
        })
      }
    });

    const Component = () => {
      const [snapshot, triggers] = useFullStore();

      return (
        <div>
          <div data-testid="name">{snapshot.context.name}</div>
          <div data-testid="count">{snapshot.context.count}</div>
          <div data-testid="status">{snapshot.status}</div>
          <button onClick={() => triggers.inc()}>Increment</button>
          <input
            data-testid="name-input"
            value={snapshot.context.name}
            onChange={(e) => triggers.setName({ name: e.target.value })}
          />
        </div>
      );
    };

    render(<Component />);

    // Check initial state
    expect(screen.getByTestId('name').textContent).toBe('Test');
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('status').textContent).toBe('active');

    // Update count
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('count').textContent).toBe('1');

    // Update name
    const nameInput = screen.getByTestId('name-input') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Updated' } });
    expect(screen.getByTestId('name').textContent).toBe('Updated');
  });

  it('should work with custom comparison function', () => {
    let renderCount = 0;

    const useOptimizedStore = createStoreHook({
      context: { count: 0, name: 'Test' },
      on: {
        inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }),
        setName: (ctx, event: { name: string }) => ({
          ...ctx,
          name: event.name
        })
      }
    });

    const OptimizedComponent = () => {
      renderCount++;
      // Only re-render if count changes (custom comparison)
      const [count, triggers] = useOptimizedStore(
        (s) => s.context.count,
        (a, b) => a === b
      );

      return (
        <div>
          <div data-testid="count">{count}</div>
          <button data-testid="inc-count" onClick={() => triggers.inc()}>
            Inc Count
          </button>
          <button
            data-testid="change-name"
            onClick={() => triggers.setName({ name: 'Changed' })}
          >
            Change Name
          </button>
        </div>
      );
    };

    render(<OptimizedComponent />);

    expect(renderCount).toBe(1);
    expect(screen.getByTestId('count').textContent).toBe('0');

    // Changing name shouldn't trigger re-render since we only select count
    fireEvent.click(screen.getByTestId('change-name'));
    expect(renderCount).toBe(1); // No re-render

    // Changing count should trigger re-render
    fireEvent.click(screen.getByTestId('inc-count'));
    expect(renderCount).toBe(2);
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('should maintain stable store instances across renders', () => {
    const storeInstances: any[] = [];

    const useTestStore = createStoreHook({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
      }
    });

    const Component = () => {
      const [count, triggers] = useTestStore((s) => s.context.count);

      // Capture the triggers object to check stability
      storeInstances.push(triggers);

      return (
        <div>
          <div data-testid="count">{count}</div>
          <button onClick={() => triggers.inc()}>Increment</button>
        </div>
      );
    };

    render(<Component />);

    // Click to trigger re-render
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('button'));

    // All trigger objects should be the same reference (stable)
    expect(storeInstances.length).toBeGreaterThan(1);
    expect(
      storeInstances.every((instance) => instance === storeInstances[0])
    ).toBe(true);
  });

  it('should handle emitted events', () => {
    const onEmit = vi.fn();

    const useEmittingStore = createStoreHook({
      context: { count: 0 },
      emits: {
        countChanged: (payload: { newCount: number }) => {
          onEmit(payload);
        }
      },
      on: {
        inc: (ctx, _event: { type: 'inc' }, enq) => {
          const newCount = ctx.count + 1;
          enq.emit.countChanged({ newCount });
          return { ...ctx, count: newCount };
        }
      }
    });

    const Component = () => {
      const [count, triggers] = useEmittingStore((s) => s.context.count);

      return (
        <div>
          <div data-testid="count">{count}</div>
          <button onClick={() => triggers.inc()}>Increment</button>
        </div>
      );
    };

    render(<Component />);

    fireEvent.click(screen.getByRole('button'));

    expect(onEmit).toHaveBeenCalledWith({ type: 'countChanged', newCount: 1 });
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('should work with multiple independent hook instances', () => {
    const useCounterStore = createStoreHook({
      context: { count: 0 },
      on: {
        inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
      }
    });

    const Counter1 = () => {
      const [count, triggers] = useCounterStore((s) => s.context.count);
      return (
        <div>
          <div data-testid="count-1">{count}</div>
          <button data-testid="inc-1" onClick={() => triggers.inc()}>
            +
          </button>
        </div>
      );
    };

    const Counter2 = () => {
      const [count, triggers] = useCounterStore((s) => s.context.count);
      return (
        <div>
          <div data-testid="count-2">{count}</div>
          <button data-testid="inc-2" onClick={() => triggers.inc()}>
            +
          </button>
        </div>
      );
    };

    render(
      <>
        <Counter1 />
        <Counter2 />
      </>
    );

    // Both should start at 0
    expect(screen.getByTestId('count-1').textContent).toBe('0');
    expect(screen.getByTestId('count-2').textContent).toBe('0');

    // Increment first counter only
    fireEvent.click(screen.getByTestId('inc-1'));
    expect(screen.getByTestId('count-1').textContent).toBe('1');
    expect(screen.getByTestId('count-2').textContent).toBe('0'); // Should remain 0

    // Increment second counter twice
    fireEvent.click(screen.getByTestId('inc-2'));
    fireEvent.click(screen.getByTestId('inc-2'));
    expect(screen.getByTestId('count-1').textContent).toBe('1'); // Should remain 1
    expect(screen.getByTestId('count-2').textContent).toBe('2');
  });

  it('should properly type the trigger object', () => {
    const useTypedStore = createStoreHook({
      context: { count: 0, name: 'test' },
      on: {
        increment: (ctx, event: { by: number }) => ({
          ...ctx,
          count: ctx.count + event.by
        }),
        decrement: (ctx, event: { by: number }) => ({
          ...ctx,
          count: ctx.count - event.by
        }),
        setName: (ctx, event: { name: string }) => ({
          ...ctx,
          name: event.name
        }),
        reset: (ctx) => ({
          ...ctx,
          count: 0
        })
      }
    });

    const TypedComponent = () => {
      const [state, triggers] = useTypedStore();

      // Test that triggers have correct types
      return (
        <div>
          <div data-testid="count">{state.context.count}</div>
          <div data-testid="name">{state.context.name}</div>
          <button onClick={() => triggers.increment({ by: 5 })}>+5</button>
          <button onClick={() => triggers.decrement({ by: 2 })}>-2</button>
          <button onClick={() => triggers.setName({ name: 'updated' })}>
            Set Name
          </button>
          <button onClick={() => triggers.reset()}>Reset</button>
        </div>
      );
    };

    render(<TypedComponent />);

    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('name').textContent).toBe('test');

    // Test all trigger methods work correctly
    fireEvent.click(screen.getByText('+5'));
    expect(screen.getByTestId('count').textContent).toBe('5');

    fireEvent.click(screen.getByText('-2'));
    expect(screen.getByTestId('count').textContent).toBe('3');

    fireEvent.click(screen.getByText('Set Name'));
    expect(screen.getByTestId('name').textContent).toBe('updated');

    fireEvent.click(screen.getByText('Reset'));
    expect(screen.getByTestId('count').textContent).toBe('0');
  });

  it('should work with complex state selections', () => {
    const useComplexStore = createStoreHook({
      context: {
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark', notifications: true },
        items: [1, 2, 3]
      },
      on: {
        updateUser: (ctx, event: { name?: string; age?: number }) => ({
          ...ctx,
          user: { ...ctx.user, ...event }
        }),
        addItem: (ctx, event: { item: number }) => ({
          ...ctx,
          items: [...ctx.items, event.item]
        }),
        toggleTheme: (ctx) => ({
          ...ctx,
          settings: {
            ...ctx.settings,
            theme: ctx.settings.theme === 'dark' ? 'light' : 'dark'
          }
        })
      }
    });

    const UserComponent = () => {
      const [userName, triggers] = useComplexStore((s) => s.context.user.name);

      return (
        <div>
          <div data-testid="user-name">{userName}</div>
          <button onClick={() => triggers.updateUser({ name: 'Jane' })}>
            Update Name
          </button>
        </div>
      );
    };

    const ThemeComponent = () => {
      const [theme, triggers] = useComplexStore(
        (s) => s.context.settings.theme
      );

      return (
        <div>
          <div data-testid="theme">{theme}</div>
          <button onClick={() => triggers.toggleTheme()}>Toggle Theme</button>
        </div>
      );
    };

    const ItemsComponent = () => {
      const [itemCount, triggers] = useComplexStore(
        (s) => s.context.items.length
      );

      return (
        <div>
          <div data-testid="item-count">{itemCount}</div>
          <button onClick={() => triggers.addItem({ item: Math.random() })}>
            Add Item
          </button>
        </div>
      );
    };

    render(
      <>
        <UserComponent />
        <ThemeComponent />
        <ItemsComponent />
      </>
    );

    // Initial state
    expect(screen.getByTestId('user-name').textContent).toBe('John');
    expect(screen.getByTestId('theme').textContent).toBe('dark');
    expect(screen.getByTestId('item-count').textContent).toBe('3');

    // Update user name
    fireEvent.click(screen.getByText('Update Name'));
    expect(screen.getByTestId('user-name').textContent).toBe('Jane');

    // Toggle theme
    fireEvent.click(screen.getByText('Toggle Theme'));
    expect(screen.getByTestId('theme').textContent).toBe('light');

    // Add item
    fireEvent.click(screen.getByText('Add Item'));
    expect(screen.getByTestId('item-count').textContent).toBe('4');
  });
});
