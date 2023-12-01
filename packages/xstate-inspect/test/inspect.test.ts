import { assign, createMachine, createActor } from 'xstate';
import { createDevTools, inspect } from '../src/index.ts';

// mute the warning about this not being implemented by jsdom
window.open = () => null;

const windowListenersUsedArguments: Array<any> = [];
const windowAddEventListener = window.addEventListener;
window.addEventListener = function (...args: any) {
  windowListenersUsedArguments.push(args);
  return windowAddEventListener.apply(this, args);
};

afterEach(() => {
  const args = [...windowListenersUsedArguments];
  windowListenersUsedArguments.length = 0;
  args.forEach((args) => window.removeEventListener.apply(window, args));
});

const createIframeMock = () => {
  const messages: any = [];

  // if only we wouldn't transpile down to es5 we could wrap this in a custom class extending EventTarget
  // transpiled classes can't extend native classes because they are calling super like this: var _this = _super.call(this) || this;
  // and native classes must be instantiated with new/super
  const iframe = new EventTarget() as HTMLIFrameElement;

  (iframe as any).contentWindow = {
    postMessage(ev: any) {
      messages.push(ev);
    }
  };

  iframe.setAttribute = () => {};

  return {
    iframe,
    initConnection() {
      iframe.dispatchEvent(new Event('load'));
      window.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: 'xstate.inspecting'
          }
        })
      );
    },
    flushMessages() {
      const [...flushed] = messages;
      messages.length = 0;
      return flushed;
    }
  };
};

describe('@xstate/inspect', () => {
  it('should handle circular structures in context', () => {
    const circularStructure = {
      get cycle() {
        return circularStructure;
      }
    };

    const machine = createMachine({
      id: 'whatever',
      context: circularStructure,
      initial: 'active',
      states: {
        active: {}
      }
    });

    const iframeMock = createIframeMock();
    const devTools = createDevTools();

    inspect({
      iframe: iframeMock.iframe,
      devTools
    });

    iframeMock.initConnection();

    const service = createActor(machine).start();

    // The devTools will notify the listeners:
    // 1. the built-in service listener
    // 2. the test listener that calls done() above
    // with the service. The built-in service listener is responsible for
    // stringifying the service's machine definition (which contains a circular structure)
    // and will throw an error if circular structures are not handled.
    expect(() => devTools.register(service)).not.toThrow();

    expect(iframeMock.flushMessages()).toMatchInlineSnapshot(`
      [
        {
          "id": "x:1",
          "machine": "{"id":"whatever","key":"whatever","type":"compound","initial":{"target":["#whatever.active"],"source":"#whatever","actions":[],"eventType":null},"history":false,"states":{"active":{"id":"whatever.active","key":"active","type":"atomic","initial":{"target":[],"source":"#whatever.active","actions":[],"eventType":null},"history":false,"states":{},"on":{},"transitions":[],"entry":[],"exit":[],"order":1,"invoke":[],"tags":[]}},"on":{},"transitions":[],"entry":[],"exit":[],"order":-1,"invoke":[],"tags":[]}",
          "parent": undefined,
          "sessionId": "x:1",
          "state": "{"status":"active","context":{"cycle":"[Circular]"},"value":"active","children":{},"historyValue":{},"tags":[]}",
          "type": "service.register",
        },
      ]
    `);
  });

  it('should handle circular structures in events', () => {
    const circularStructure = {
      get cycle() {
        return circularStructure;
      }
    };

    const machine = createMachine({
      initial: 'active',
      states: {
        active: {}
      }
    });

    const iframeMock = createIframeMock();
    const devTools = createDevTools();

    inspect({
      iframe: iframeMock.iframe,
      devTools
    });

    iframeMock.initConnection();

    const service = createActor(machine).start();

    expect(() => devTools.register(service)).not.toThrow();

    iframeMock.flushMessages();

    service.send({
      type: 'CIRCULAR',
      value: circularStructure
    });

    expect(iframeMock.flushMessages()).toMatchInlineSnapshot(`
      [
        {
          "event": "{"type":"CIRCULAR","value":{"cycle":"[Circular]"}}",
          "sessionId": "x:3",
          "type": "service.event",
        },
        {
          "sessionId": "x:3",
          "state": "{"status":"active","context":{},"value":"active","children":{},"historyValue":{},"tags":[]}",
          "type": "service.state",
        },
      ]
    `);
  });

  it('should accept a serializer', () => {
    const machine = createMachine({
      initial: 'active',
      context: {
        map: new Map(),
        deep: {
          map: new Map()
        }
      },
      states: {
        active: {}
      }
    });

    const devTools = createDevTools();
    const iframeMock = createIframeMock();

    inspect({
      iframe: iframeMock.iframe,
      devTools,
      serialize: (_key, value) => {
        if (value instanceof Map) {
          return 'map';
        }

        return value;
      }
    });

    iframeMock.initConnection();

    const service = createActor(machine).start();

    devTools.register(service);

    service.send({
      type: 'TEST',
      serialized: new Map(), // test value to serialize
      deep: {
        serialized: new Map()
      }
    });

    expect(iframeMock.flushMessages()).toMatchInlineSnapshot(`
      [
        {
          "id": "x:5",
          "machine": "{"id":"(machine)","key":"(machine)","type":"compound","initial":{"target":["#(machine).active"],"source":"#(machine)","actions":[],"eventType":null},"history":false,"states":{"active":{"id":"(machine).active","key":"active","type":"atomic","initial":{"target":[],"source":"#(machine).active","actions":[],"eventType":null},"history":false,"states":{},"on":{},"transitions":[],"entry":[],"exit":[],"order":1,"invoke":[],"tags":[]}},"on":{},"transitions":[],"entry":[],"exit":[],"order":-1,"invoke":[],"tags":[]}",
          "parent": undefined,
          "sessionId": "x:5",
          "state": "{"status":"active","context":{"map":"map","deep":{"map":"map"}},"value":"active","children":{},"historyValue":{},"tags":[]}",
          "type": "service.register",
        },
        {
          "event": "{"type":"TEST","serialized":"map","deep":{"serialized":"map"}}",
          "sessionId": "x:5",
          "type": "service.event",
        },
        {
          "sessionId": "x:5",
          "state": "{"status":"active","context":{"map":"map","deep":{"map":"map"}},"value":"active","children":{},"historyValue":{},"tags":[]}",
          "type": "service.state",
        },
      ]
    `);
  });

  // TODO: the value is still available on `machine.definition.initial` and that is not handled by the serializer
  it.skip('should not crash when registering machine with very deep context when serializer manages to replace it', (done) => {
    type DeepObject = { nested?: DeepObject };

    const deepObj: DeepObject = {};

    let current = deepObj;
    for (let i = 0; i < 20_000; i += 1) {
      current.nested = {};
      current = current.nested;
    }

    const machine = createMachine({
      initial: 'active',
      context: deepObj,
      states: {
        active: {}
      }
    });

    const devTools = createDevTools();

    inspect({
      iframe: false,
      devTools,
      serialize: (key, value) => {
        if (key === 'nested') {
          return '[very deep]';
        }

        return value;
      }
    });

    const service = createActor(machine).start();

    devTools.onRegister(() => {
      done();
    });

    expect(() => devTools.register(service)).not.toThrow();
  });

  it('should successfully serialize value with unsafe toJSON when serializer manages to replace it', () => {
    const machine = createMachine({
      context: {},
      types: {} as {
        events: { type: 'EV'; value: any };
      },
      on: {
        EV: {
          actions: assign({
            value: ({ event }) => event.value
          })
        }
      }
    });

    const devTools = createDevTools();
    const iframeMock = createIframeMock();

    inspect({
      iframe: iframeMock.iframe,
      devTools,
      serialize(_key, value) {
        if (value && typeof value === 'object' && 'unsafe' in value) {
          return {
            ...value,
            unsafe: '[unsafe]'
          };
        }
        return value;
      }
    });

    iframeMock.initConnection();

    const service = createActor(machine).start();
    devTools.register(service);

    iframeMock.flushMessages();

    service.send({
      type: 'EV',
      value: {
        unsafe: {
          get toJSON() {
            throw new Error('oops');
          }
        }
      }
    });

    expect(iframeMock.flushMessages()).toMatchInlineSnapshot(`
      [
        {
          "event": "{"type":"EV","value":{"unsafe":"[unsafe]"}}",
          "sessionId": "x:7",
          "type": "service.event",
        },
        {
          "sessionId": "x:7",
          "state": "{"status":"active","context":{"value":{"unsafe":"[unsafe]"}},"value":{},"children":{},"historyValue":{},"tags":[]}",
          "type": "service.state",
        },
      ]
    `);

    // this is important because this moves the previous `state` to `state.history` (this was the case in v4)
    // and serializing a `state` with a `state.history` containing unsafe value should still work
    service.send({
      // @ts-expect-error
      type: 'UNKNOWN'
    });

    expect(iframeMock.flushMessages()).toMatchInlineSnapshot(`
      [
        {
          "event": "{"type":"UNKNOWN"}",
          "sessionId": "x:7",
          "type": "service.event",
        },
        {
          "sessionId": "x:7",
          "state": "{"status":"active","context":{"value":{"unsafe":"[unsafe]"}},"value":{},"children":{},"historyValue":{},"tags":[]}",
          "type": "service.state",
        },
      ]
    `);
  });

  it('should only send events once to the inspector after restarting a service', () => {
    const machine = createMachine({});

    const devTools = createDevTools();
    const iframeMock = createIframeMock();

    inspect({
      iframe: iframeMock.iframe,
      devTools
    });

    iframeMock.initConnection();

    const service = createActor(machine).start();
    devTools.register(service);

    service.stop();
    service.start();
    devTools.register(service);

    iframeMock.flushMessages();

    service.send({ type: 'EV' });

    expect(
      iframeMock
        .flushMessages()
        .filter((message: any) => message.type === 'service.event')
    ).toHaveLength(1);
  });

  it('browser inspector should use targetWindow if provided', () => {
    const windowMock = jest.fn() as unknown as Window;
    const windowSpy = jest.spyOn(window, 'open');
    windowSpy.mockImplementation(() => windowMock);

    const localWindowMock = jest.fn() as unknown as Window;
    const devTools = createDevTools();

    inspect({
      devTools,
      iframe: undefined,
      targetWindow: localWindowMock
    });

    expect(windowSpy).not.toHaveBeenCalled();

    windowSpy.mockRestore();
  });
});
