import { fireEvent, screen, render } from '@testing-library/react';
import {
  createStore,
  fromStore,
  createStoreConfig,
  createAtom
} from '../src/index.ts';
import { useSelector } from '../src/react.ts';
import {
  useActor,
  useActorRef,
  useSelector as useXStateSelector
} from '@xstate/react';
import ReactDOM from 'react-dom';
import { useStore } from '../src/react.ts';
import { useAtom } from '../src/react.ts';
import { act } from '@testing-library/react';
import { vi } from 'vitest';
import { useEffect } from 'react';

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
});
