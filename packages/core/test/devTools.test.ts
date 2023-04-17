import { XStateDevInterface } from '../src/dev/index.ts';
import {
  interpret,
  DevToolsAdapter,
  createMachine,
  sendTo
} from '../src/index.ts';
import { isStateLike } from '../src/utils.ts';

describe('devTools', () => {
  it('should register actors with a global devTools adapter', (done) => {
    (global as any).__xstate__ = {
      register(actor) {
        expect(actor).toBeDefined();

        actor.inspect((state) => {
          if (isStateLike(state) && state.matches('active')) {
            done();
          }
        });
      }
    } as XStateDevInterface;

    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            TOGGLE: 'active'
          }
        },
        active: {}
      }
    });

    const service = interpret(machine, {
      devTools: true
    });

    service.start();
    service.send({ type: 'TOGGLE' });
  });

  it('should register actors in a system with a global devTools adapter', (done) => {
    (global as any).__xstate__ = {
      register(actor) {
        expect(actor).toBeDefined();

        actor.inspect((state) => {
          if (isStateLike(state) && state.matches('active')) {
            done();
          }
        });
      }
    } as XStateDevInterface;

    const machine = createMachine({
      initial: 'inactive',
      entry: () => console.log('entered'),
      states: {
        inactive: {
          on: {
            TOGGLE: 'active'
          }
        },
        active: {}
      }
    });

    const parentMachine = createMachine({
      invoke: {
        id: 'child',
        src: machine
      },
      on: {
        TOGGLE: {
          actions: sendTo('child', { type: 'TOGGLE' })
        }
      }
    });

    const service = interpret(parentMachine, {
      devTools: true
    });

    service.start();
    service.send({ type: 'TOGGLE' });
  });

  it('should register actors with a custom devTools adapter', (done) => {
    const customAdapter: DevToolsAdapter = (service) => {
      service.inspect((state) => {
        if (isStateLike(state) && state.matches('active')) {
          done();
        }
      });
    };

    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            TOGGLE: 'active'
          }
        },
        active: {}
      }
    });

    const service = interpret(machine, {
      devTools: customAdapter
    });

    service.start();
    service.send({ type: 'TOGGLE' });
  });

  it('should register actors in a system with a custom devTools adapter', (done) => {
    const customAdapter: DevToolsAdapter = (service) => {
      service.inspect((state) => {
        if (isStateLike(state) && state.matches('active')) {
          done();
        }
      });
    };

    const machine = createMachine({
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            TOGGLE: 'active'
          }
        },
        active: {}
      }
    });

    const parentMachine = createMachine({
      invoke: {
        id: 'child',
        src: machine
      },
      on: {
        TOGGLE: {
          actions: sendTo('child', { type: 'TOGGLE' })
        }
      }
    });

    const service = interpret(parentMachine, {
      devTools: customAdapter
    });

    service.start();
    service.send({ type: 'TOGGLE' });
  });
});
