import { fireEvent, screen, render, act } from '@testing-library/react';
import { create, createStoreFromZustand } from '../src/zustand.ts';

describe('create (React hook)', () => {
  it('returns a hook that selects state', () => {
    const useStore = create((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 }))
    }));

    const Counter = () => {
      const count = useStore((s) => s.count);
      return (
        <div>
          <span data-testid="count">{count}</span>
          <button onClick={() => useStore.getState().increment()}>inc</button>
        </div>
      );
    };

    render(<Counter />);
    expect(screen.getByTestId('count').textContent).toBe('0');

    fireEvent.click(screen.getByText('inc'));
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('returns full state when called without selector', () => {
    const useStore = create((set) => ({
      count: 0,
      name: 'test',
      increment: () => set((s) => ({ count: s.count + 1 }))
    }));

    const Display = () => {
      const state = useStore();
      return (
        <div>
          <span data-testid="count">{state.count}</span>
          <span data-testid="name">{state.name}</span>
          <button onClick={() => state.increment()}>inc</button>
        </div>
      );
    };

    render(<Display />);
    expect(screen.getByTestId('count').textContent).toBe('0');
    expect(screen.getByTestId('name').textContent).toBe('test');

    fireEvent.click(screen.getByText('inc'));
    expect(screen.getByTestId('count').textContent).toBe('1');
  });

  it('getState() returns merged state outside components', () => {
    const useStore = create((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 }))
    }));

    expect(useStore.getState().count).toBe(0);
    expect(typeof useStore.getState().increment).toBe('function');

    // Calling action via getState triggers the store
    act(() => {
      useStore.getState().increment();
    });
    expect(useStore.getState().count).toBe(1);
  });

  it('setState() dispatches dangerouslySet', () => {
    const useStore = create((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 }))
    }));

    act(() => {
      useStore.setState({ count: 42 });
    });
    expect(useStore.getState().count).toBe(42);
  });

  it('setState() with updater function', () => {
    const useStore = create((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 }))
    }));

    act(() => {
      useStore.setState((s) => ({ count: s.count + 10 }));
    });
    expect(useStore.getState().count).toBe(10);
  });

  it('subscribe() notifies with Zustand-style (state, prev)', () => {
    const useStore = create((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 }))
    }));

    const states: { count: number }[] = [];
    const unsub = useStore.subscribe((state, prev) => {
      states.push({ count: state.count });
    });

    act(() => {
      useStore.getState().increment();
      useStore.getState().increment();
    });

    expect(states).toEqual([{ count: 1 }, { count: 2 }]);
    unsub();
  });

  it('getInitialState() returns initial merged state', () => {
    const useStore = create((set) => ({
      count: 0,
      increment: () => set((s) => ({ count: s.count + 1 }))
    }));

    act(() => {
      useStore.getState().increment();
    });

    expect(useStore.getInitialState().count).toBe(0);
    expect(typeof useStore.getInitialState().increment).toBe('function');
  });

  it('re-renders only when selected value changes', () => {
    const useStore = create((set) => ({
      count: 0,
      name: 'test',
      incCount: () => set((s) => ({ count: s.count + 1 })),
      setName: (n: string) => set({ name: n })
    }));

    let renderCount = 0;

    const CountDisplay = () => {
      const count = useStore((s) => s.count);
      renderCount++;
      return <span data-testid="count">{count}</span>;
    };

    render(<CountDisplay />);
    expect(renderCount).toBe(1);

    // Changing name should NOT re-render CountDisplay
    act(() => {
      useStore.getState().setName('updated');
    });
    expect(renderCount).toBe(1);

    // Changing count SHOULD re-render
    act(() => {
      useStore.getState().incCount();
    });
    expect(renderCount).toBe(2);
  });

  it('works with async actions', async () => {
    const useStore = create((set) => ({
      data: null as string | null,
      loading: false,
      fetchData: async () => {
        set({ loading: true });
        await Promise.resolve();
        set({ data: 'loaded', loading: false });
      }
    }));

    const Display = () => {
      const { data, loading } = useStore();
      return (
        <div>
          <span data-testid="loading">{String(loading)}</span>
          <span data-testid="data">{data ?? 'null'}</span>
          <button onClick={() => useStore.getState().fetchData()}>fetch</button>
        </div>
      );
    };

    render(<Display />);
    expect(screen.getByTestId('loading').textContent).toBe('false');

    fireEvent.click(screen.getByText('fetch'));
    expect(screen.getByTestId('loading').textContent).toBe('true');

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(screen.getByTestId('loading').textContent).toBe('false');
    expect(screen.getByTestId('data').textContent).toBe('loaded');
  });

  it('actions in state returned by hook trigger store updates', () => {
    const useStore = create((set) => ({
      count: 0,
      increment: (by: number) => set((s) => ({ count: s.count + by }))
    }));

    const Counter = () => {
      const { count, increment } = useStore();
      return (
        <div>
          <span data-testid="count">{count}</span>
          <button onClick={() => increment(5)}>+5</button>
        </div>
      );
    };

    render(<Counter />);
    expect(screen.getByTestId('count').textContent).toBe('0');

    fireEvent.click(screen.getByText('+5'));
    expect(screen.getByTestId('count').textContent).toBe('5');
  });
});
