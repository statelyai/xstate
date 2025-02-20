import { createStore } from './index';

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

    const name = store.select((state) => state.user.name).get();
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
    store.select((state) => state.user.name).subscribe(callback);
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
    store.select((state) => state.user.name).subscribe(callback);
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

    store.select(selector, equalityFn).subscribe(callback);

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
    const subscription = store
      .select((state) => state.user.name)
      .subscribe(callback);
    subscription.unsubscribe();
    store.send({ type: 'UPDATE_NAME', name: 'Jane' });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle updates with multiple subscribers', () => {
    interface PositionContext {
      position: {
        x: number;
        y: number;
      };
    }

    const store = createStore({
      context: {
        position: { x: 0, y: 0 },
        user: { name: 'John', age: 30 }
      } as PositionContext,
      on: {
        positionUpdated: (
          context,
          event: { position: { x: number; y: number } }
        ) => ({
          ...context,
          position: event.position
        }),
        userUpdated: (
          context,
          event: { user: { name: string; age: number } }
        ) => ({
          ...context,
          user: event.user
        })
      }
    });

    // Mock DOM manipulation callback
    const renderCallback = jest.fn();
    store
      .select((state) => state.position)
      .subscribe((position) => {
        renderCallback(position);
      });

    // Mock logger callback for x position only
    const loggerCallback = jest.fn();
    store
      .select((state) => state.position.x)
      .subscribe((x) => {
        loggerCallback(x);
      });

    // Simulate position update
    store.trigger.positionUpdated({
      position: { x: 100, y: 200 }
    });

    // Verify render callback received full position update
    expect(renderCallback).toHaveBeenCalledTimes(1);
    expect(renderCallback).toHaveBeenCalledWith({ x: 100, y: 200 });

    // Verify logger callback received only x position
    expect(loggerCallback).toHaveBeenCalledTimes(1);
    expect(loggerCallback).toHaveBeenCalledWith(100);

    // Simulate another update
    store.trigger.positionUpdated({
      position: { x: 150, y: 300 }
    });

    expect(renderCallback).toHaveBeenCalledTimes(2);
    expect(renderCallback).toHaveBeenLastCalledWith({ x: 150, y: 300 });
    expect(loggerCallback).toHaveBeenCalledTimes(2);
    expect(loggerCallback).toHaveBeenLastCalledWith(150);

    // Simulate changing only the y position
    store.trigger.positionUpdated({
      position: { x: 150, y: 400 }
    });

    expect(renderCallback).toHaveBeenCalledTimes(3);
    expect(renderCallback).toHaveBeenLastCalledWith({ x: 150, y: 400 });

    // loggerCallback should not have been called
    expect(loggerCallback).toHaveBeenCalledTimes(2);

    // Simulate changing only the user
    store.trigger.userUpdated({
      user: { name: 'Jane', age: 25 }
    });

    // renderCallback should not have been called
    expect(renderCallback).toHaveBeenCalledTimes(3);

    // loggerCallback should not have been called
    expect(loggerCallback).toHaveBeenCalledTimes(2);
  });
});
