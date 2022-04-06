import { createMachine, interpret } from 'xstate';
import { createDevTools, inspect } from '../src';

describe('@xstate/inspect', () => {
  it('should handle circular structures in context', (done) => {
    const circularStructure = {
      get cycle() {
        return circularStructure;
      }
    };

    const machine = createMachine({
      initial: 'active',
      context: circularStructure,
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

  it('should not crash when registering machine with very deep context when serializer manages to replace it', (done) => {
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
});
