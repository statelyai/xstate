import { createStore, select } from './index';

interface TestContext {
  user: {
    name: string;
    age: number;
  };
  settings: {
    theme: 'light' | 'dark';
    notifications: boolean;
  };
}

describe('select', () => {
  it('should get current value', () => {
    const store = createStore({
      context: {
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark', notifications: true }
      } as TestContext,
      on: {
        UPDATE_NAME: (context, event: { name: string }) => ({
          ...context,
          user: { ...context.user, name: event.name }
        }),
        UPDATE_THEME: (context, event: { theme: 'light' | 'dark' }) => ({
          ...context,
          settings: { ...context.settings, theme: event.theme }
        })
      }
    });

    const name = select(store, (state) => state.user.name).get();
    expect(name).toBe('John');
  });

  it('should subscribe to changes', () => {
    const store = createStore({
      context: {
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark', notifications: true }
      } as TestContext,
      on: {
        UPDATE_NAME: (context, event: { name: string }) => ({
          ...context,
          user: { ...context.user, name: event.name }
        }),
        UPDATE_THEME: (context, event: { theme: 'light' | 'dark' }) => ({
          ...context,
          settings: { ...context.settings, theme: event.theme }
        })
      }
    });

    const callback = jest.fn();
    select(store, (state) => state.user.name).subscribe(callback);
    store.send({ type: 'UPDATE_NAME', name: 'Jane' });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('Jane');
  });

  it('should not notify if selected value has not changed', () => {
    const store = createStore({
      context: {
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark', notifications: true }
      } as TestContext,
      on: {
        UPDATE_NAME: (context, event: { name: string }) => ({
          ...context,
          user: { ...context.user, name: event.name }
        }),
        UPDATE_THEME: (context, event: { theme: 'light' | 'dark' }) => ({
          ...context,
          settings: { ...context.settings, theme: event.theme }
        })
      }
    });

    const callback = jest.fn();
    select(store, (state) => state.user.name).subscribe(callback);
    store.send({ type: 'UPDATE_THEME', theme: 'light' });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should support custom equality function', () => {
    const store = createStore({
      context: {
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark', notifications: true }
      } as TestContext,
      on: {
        UPDATE_NAME: (context, event: { name: string }) => ({
          ...context,
          user: { ...context.user, name: event.name }
        }),
        UPDATE_THEME: (context, event: { theme: 'light' | 'dark' }) => ({
          ...context,
          settings: { ...context.settings, theme: event.theme }
        })
      }
    });

    const callback = jest.fn();
    const selector = (context: TestContext) => ({
      name: context.user.name,
      theme: context.settings.theme
    });
    const equalityFn = (a: { name: string }, b: { name: string }) =>
      a.name === b.name; // Only compare names

    select(store, selector, equalityFn).subscribe(callback);

    store.send({ type: 'UPDATE_THEME', theme: 'light' });
    expect(callback).not.toHaveBeenCalled();

    store.send({ type: 'UPDATE_NAME', name: 'Jane' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe correctly', () => {
    const store = createStore({
      context: {
        user: { name: 'John', age: 30 },
        settings: { theme: 'dark', notifications: true }
      } as TestContext,
      on: {
        UPDATE_NAME: (context, event: { name: string }) => ({
          ...context,
          user: { ...context.user, name: event.name }
        }),
        UPDATE_THEME: (context, event: { theme: 'light' | 'dark' }) => ({
          ...context,
          settings: { ...context.settings, theme: event.theme }
        })
      }
    });

    const callback = jest.fn();
    const subscription = select(store, (state) => state.user.name).subscribe(
      callback
    );
    subscription.unsubscribe();
    store.send({ type: 'UPDATE_NAME', name: 'Jane' });

    expect(callback).not.toHaveBeenCalled();
  });
});
