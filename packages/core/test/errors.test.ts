import { createMachine, fromPromise, interpret } from '../src';

const cleanups: (() => void)[] = [];
function installGlobalOnErrorHandler(handler: (ev: ErrorEvent) => void) {
  window.addEventListener('error', handler);
  cleanups.push(() => window.removeEventListener('error', handler));
}

afterEach(() => {
  cleanups.forEach((cleanup) => cleanup());
});

describe('error handling', () => {
  // https://github.com/statelyai/xstate/issues/4004
  it('does not cause an infinite loop when an error is thrown in subscribe', (done) => {
    const machine = createMachine({
      id: 'machine',
      initial: 'initial',
      context: {
        count: 0
      },
      states: {
        initial: {
          on: { activate: 'active' }
        },
        active: {}
      }
    });

    const spy = jest.fn().mockImplementation(() => {
      throw new Error('blah');
    });

    const actor = interpret(machine).start();

    actor.subscribe(spy);
    actor.send({ type: 'activate' });

    expect(spy).toHaveBeenCalledTimes(1);

    installGlobalOnErrorHandler((ev) => {
      ev.preventDefault();
      expect(ev.error.message).toEqual('blah');
      done();
    });
  });

  it('unhandled rejections should be reported globally', (done) => {
    const promiseMachine = createMachine({
      initial: 'pending',
      states: {
        pending: {
          invoke: {
            src: fromPromise(() => Promise.reject(new Error('foo'))),
            onDone: 'success'
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    interpret(promiseMachine).start();

    installGlobalOnErrorHandler((ev) => {
      ev.preventDefault();
      expect(ev.error.message).toEqual('foo');
      done();
    });
  });
});
