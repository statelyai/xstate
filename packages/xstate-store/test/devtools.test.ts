import { createStore } from '../src/store.ts';
import { devtools } from '../src/devtools.ts';

// Mock Redux DevTools Extension
function createMockConnection() {
  return {
    init: vi.fn(),
    send: vi.fn(),
    unsubscribe: vi.fn(),
    error: vi.fn()
  };
}

function installMockExtension() {
  const connection = createMockConnection();
  (globalThis as any).window = {
    __REDUX_DEVTOOLS_EXTENSION__: {
      connect: vi.fn(() => connection)
    }
  };
  return connection;
}

function removeMockExtension() {
  delete (globalThis as any).window;
}

describe('devtools', () => {
  let connection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    connection = installMockExtension();
  });

  afterEach(() => {
    removeMockExtension();
  });

  describe('basic functionality', () => {
    it('should init devtools with initial context', () => {
      const store = createStore({
        context: { count: 0 },
        on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
      }).with(devtools({ name: 'Test' }));

      expect(connection.init).toHaveBeenCalledWith({ count: 0 });
    });

    it('should connect with provided name', () => {
      createStore({
        context: { count: 0 },
        on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
      }).with(devtools({ name: 'MyStore' }));

      expect(
        (globalThis as any).window.__REDUX_DEVTOOLS_EXTENSION__.connect
      ).toHaveBeenCalledWith(expect.objectContaining({ name: 'MyStore' }));
    });

    it('should use default name when not provided', () => {
      createStore({
        context: { count: 0 },
        on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
      }).with(devtools());

      expect(
        (globalThis as any).window.__REDUX_DEVTOOLS_EXTENSION__.connect
      ).toHaveBeenCalledWith(
        expect.objectContaining({ name: '@xstate/store' })
      );
    });

    it('should send action and state on transitions', () => {
      const store = createStore({
        context: { count: 0 },
        on: {
          inc: (ctx) => ({ count: ctx.count + 1 }),
          add: (ctx, e: { by: number }) => ({ count: ctx.count + e.by })
        }
      }).with(devtools({ name: 'Test' }));

      store.trigger.inc();

      expect(connection.send).toHaveBeenCalledWith(
        { type: 'inc' },
        { count: 1 }
      );

      store.trigger.add({ by: 5 });

      expect(connection.send).toHaveBeenCalledWith(
        { type: 'add', by: 5 },
        { count: 6 }
      );
    });

    it('should send multiple actions in order', () => {
      const store = createStore({
        context: { count: 0 },
        on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
      }).with(devtools({ name: 'Test' }));

      store.trigger.inc();
      store.trigger.inc();
      store.trigger.inc();

      expect(connection.send).toHaveBeenCalledTimes(3);
      expect(connection.send).toHaveBeenNthCalledWith(
        1,
        { type: 'inc' },
        { count: 1 }
      );
      expect(connection.send).toHaveBeenNthCalledWith(
        2,
        { type: 'inc' },
        { count: 2 }
      );
      expect(connection.send).toHaveBeenNthCalledWith(
        3,
        { type: 'inc' },
        { count: 3 }
      );
    });
  });

  describe('enabled option', () => {
    it('should not connect when enabled is false', () => {
      const store = createStore({
        context: { count: 0 },
        on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
      }).with(devtools({ enabled: false }));

      store.trigger.inc();

      expect(connection.init).not.toHaveBeenCalled();
      expect(connection.send).not.toHaveBeenCalled();
    });
  });

  describe('no devtools extension', () => {
    it('should work without devtools extension installed', () => {
      removeMockExtension();

      const store = createStore({
        context: { count: 0 },
        on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
      }).with(devtools({ name: 'Test' }));

      // Should not throw
      store.trigger.inc();
      expect(store.getSnapshot().context.count).toBe(1);
    });
  });

  describe('sanitizers', () => {
    it('should apply stateSanitizer before sending', () => {
      const store = createStore({
        context: { count: 0, _secret: 'hidden' },
        on: {
          inc: (ctx) => ({ ...ctx, count: ctx.count + 1 })
        }
      }).with(
        devtools({
          name: 'Test',
          stateSanitizer: ({ _secret, ...rest }) => rest
        })
      );

      expect(connection.init).toHaveBeenCalledWith({ count: 0 });

      store.trigger.inc();

      expect(connection.send).toHaveBeenCalledWith(
        { type: 'inc' },
        { count: 1 }
      );
    });

    it('should apply actionSanitizer before sending', () => {
      const store = createStore({
        context: { count: 0 },
        on: {
          login: (ctx, e: { token: string }) => ctx
        }
      }).with(
        devtools({
          name: 'Test',
          actionSanitizer: (action) => ({
            ...action,
            token: action.token ? '***' : undefined
          })
        })
      );

      store.send({ type: 'login', token: 'secret123' });

      expect(connection.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'login', token: '***' }),
        expect.any(Object)
      );
    });
  });

  describe('maxAge', () => {
    it('should pass maxAge to connection', () => {
      createStore({
        context: { count: 0 },
        on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
      }).with(devtools({ name: 'Test', maxAge: 100 }));

      expect(
        (globalThis as any).window.__REDUX_DEVTOOLS_EXTENSION__.connect
      ).toHaveBeenCalledWith(expect.objectContaining({ maxAge: 100 }));
    });
  });

  describe('composability', () => {
    it('should work with other extensions', () => {
      const store = createStore({
        context: { count: 0 },
        on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
      }).with(devtools({ name: 'Test' }));

      store.trigger.inc();

      expect(store.getSnapshot().context.count).toBe(1);
      expect(connection.send).toHaveBeenCalledWith(
        { type: 'inc' },
        { count: 1 }
      );
    });

    it('should preserve store.select() functionality', () => {
      const store = createStore({
        context: { count: 0, name: 'test' },
        on: { inc: (ctx) => ({ ...ctx, count: ctx.count + 1 }) }
      }).with(devtools({ name: 'Test' }));

      const count = store.select((ctx) => ctx.count);
      expect(count.get()).toBe(0);

      store.trigger.inc();
      expect(count.get()).toBe(1);
    });

    it('should preserve subscriptions', () => {
      const store = createStore({
        context: { count: 0 },
        on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
      }).with(devtools({ name: 'Test' }));

      const values: number[] = [];
      store.subscribe((snapshot) => {
        values.push(snapshot.context.count);
      });

      store.trigger.inc();
      store.trigger.inc();

      expect(values).toEqual([1, 2]);
    });

    it('should preserve effects from transitions', () => {
      const effectFn = vi.fn();

      const store = createStore({
        context: { count: 0 },
        on: {
          inc: (ctx, _e, enq) => {
            enq.effect(effectFn);
            return { count: ctx.count + 1 };
          }
        }
      }).with(devtools({ name: 'Test' }));

      store.trigger.inc();

      expect(effectFn).toHaveBeenCalledOnce();
      expect(connection.send).toHaveBeenCalled();
    });
  });
});
