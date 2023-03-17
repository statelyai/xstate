import { assign, createMachine, interpret } from 'xstate';
import { createDevTools, inspect } from '../src/index.js';

// mute the warning about this not being implemented by jsdom
window.open = () => null;

const windowListenersUsedArguments: Array<any[]> = [];
const windowAddEventListener = window.addEventListener;
window.addEventListener = function (...args: any[]) {
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
    postMessage(ev) {
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
  it('should handle circular structures in context', (done) => {
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

    const devTools = createDevTools();

    devTools.onRegister(() => {
      done();
    });

    inspect({
      iframe: false,
      devTools
    });

    const service = interpret(machine).start();

    // The devTools will notify the listeners:
    // 1. the built-in service listener
    // 2. the test listener that calls done() above
    // with the service. The built-in service listener is responsible for
    // stringifying the service's machine definition (which contains a circular structure)
    // and will throw an error if circular structures are not handled.
    expect(() => devTools.register(service)).not.toThrow();
  });

  it('should handle circular structures in events', (done) => {
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

    const devTools = createDevTools();

    devTools.onRegister((inspectedService) => {
      inspectedService.onTransition((state) => {
        if (state.event.type === 'CIRCULAR') {
          done();
        }
      });
    });

    inspect({
      iframe: false,
      devTools
    });

    const service = interpret(machine).start();

    service.send({
      type: 'CIRCULAR',
      value: circularStructure
    });

    expect(() => devTools.register(service)).not.toThrow();
  });

  it('should accept a serializer', () => {
    expect.assertions(2);
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

    inspect({
      iframe: false,
      devTools,
      serialize: (_key, value) => {
        if (value instanceof Map) {
          return 'map';
        }

        return value;
      }
    })?.subscribe((state) => {
      if (state.event.type === 'service.register') {
        expect(JSON.parse(state.event.machine).context).toEqual({
          map: 'map',
          deep: {
            map: 'map'
          }
        });
      }

      if (
        state.event.type === 'service.event' &&
        JSON.parse(state.event.event).name === 'TEST'
      ) {
        expect(JSON.parse(state.event.event).data).toEqual({
          type: 'TEST',
          serialized: 'map',
          deep: {
            serialized: 'map'
          }
        });
      }
    });

    const service = interpret(machine).start();

    devTools.register(service);

    service.send({
      type: 'TEST',
      serialized: new Map(), // test value to serialize
      deep: {
        serialized: new Map()
      }
    });
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

    const service = interpret(machine).start();

    devTools.onRegister(() => {
      done();
    });

    expect(() => devTools.register(service)).not.toThrow();
  });

  it('should successfully serialize value with unsafe toJSON when serializer manages to replace it', () => {
    const machine = createMachine({
      context: {},
      on: {
        EV: {
          actions: assign({
            value: (_ctx, ev: any) => ev.value
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

    const service = interpret(machine).start();
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
          "event": "{"name":"EV","data":{"type":"EV","value":{"unsafe":"[unsafe]"}},"$$type":"scxml","type":"external"}",
          "sessionId": "x:7",
          "type": "service.event",
        },
        {
          "sessionId": "x:7",
          "state": "{"value":{},"done":false,"context":{"value":{"unsafe":"[unsafe]"}},"historyValue":{},"actions":[{"type":"xstate.assign","params":{"context":{"value":{"unsafe":"[unsafe]"}},"actions":[]}}],"event":{"type":"EV","value":{"unsafe":"[unsafe]"}},"_event":{"name":"EV","data":{"type":"EV","value":{"unsafe":"[unsafe]"}},"$$type":"scxml","type":"external"},"_sessionid":"x:7","_initial":false,"changed":true,"transitions":[{"actions":[{"type":"xstate.assign","params":{"assignment":{}}}],"event":"EV","source":"#(machine)","external":false,"eventType":"EV"}],"children":{},"tags":[]}",
          "type": "service.state",
        },
      ]
    `);

    // this is important because this moves the previous `state` to `state.history` (this was the case in v4)
    // and serializing a `state` with a `state.history` containing unsafe value should still work
    service.send({ type: 'UNKNOWN' });

    expect(iframeMock.flushMessages()).toMatchInlineSnapshot(`
      [
        {
          "event": "{"name":"UNKNOWN","data":{"type":"UNKNOWN"},"$$type":"scxml","type":"external"}",
          "sessionId": "x:7",
          "type": "service.event",
        },
        {
          "sessionId": "x:7",
          "state": "{"value":{},"done":false,"context":{"value":{"unsafe":"[unsafe]"}},"historyValue":{},"actions":[],"event":{"type":"UNKNOWN"},"_event":{"name":"UNKNOWN","data":{"type":"UNKNOWN"},"$$type":"scxml","type":"external"},"_sessionid":"x:7","_initial":false,"changed":false,"transitions":[],"children":{},"tags":[]}",
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

    const service = interpret(machine).start();
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
});
