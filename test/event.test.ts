import { Machine, sendParent, interpret } from '../src';
import { respond, send } from '../src/actions';
// import { assert } from 'chai';

describe('SCXML events', () => {
  it('should have the origin (id) from the sending service', done => {
    const childMachine = Machine({
      initial: 'active',
      states: {
        active: {
          entry: sendParent('EVENT')
        }
      }
    });

    const parentMachine = Machine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            id: 'child',
            src: childMachine
          },
          on: {
            EVENT: {
              target: 'success',
              cond: (_, __, { _event }) => {
                return _event.origin === 'child';
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    interpret(parentMachine)
      .onDone(() => done())
      .start();
  });

  it('respond() should be able to respond to sender', done => {
    const authServerMachine = Machine({
      initial: 'waitingForCode',
      states: {
        waitingForCode: {
          on: {
            CODE: {
              actions: respond('TOKEN', { delay: 10 })
            }
          }
        }
      }
    });

    const authClientMachine = Machine({
      initial: 'idle',
      states: {
        idle: {
          on: { AUTH: 'authorizing' }
        },
        authorizing: {
          invoke: {
            id: 'auth-server',
            src: authServerMachine
          },
          entry: send('CODE', { to: 'auth-server' }),
          on: {
            TOKEN: 'authorized'
          }
        },
        authorized: {
          type: 'final'
        }
      }
    });

    const service = interpret(authClientMachine)
      .onDone(() => done())
      .start();

    service.send('AUTH');
  });
});
