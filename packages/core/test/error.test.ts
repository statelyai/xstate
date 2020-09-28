// @ts-nocheck
import { createMachine, assign, interpret } from '../src';

describe('errors', () => {
  it('stuff', (done) => {
    interface ToggleContext {
      counts: number[];
    }

    const myMachine = createMachine<ToggleContext>(
      {
        id: 'machine',
        initial: 'idle',
        context: {
          counts: []
        },
        states: {
          idle: {
            on: { ASYNC: 'async-state', SYNC: 'sync-state' }
          },
          'sync-state': {
            always: {
              target: 'success',
              actions: 'update-counts'
            }
          },
          'async-state': {
            invoke: {
              id: 'test-ivoke',
              src: 'runPromise',
              onDone: {
                target: 'success',
                actions: 'update-counts'
              },
              onError: {
                target: 'fail',
                actions: 'update-counts'
              }
            }
          },
          success: { type: 'final' },
          fail: { type: 'final' }
        }
      },
      {
        actions: {
          'update-counts': assign({
            counts: () => {
              throw new Error('force a crash');
            }
          })
        },
        services: {
          runPromise: () =>
            new Promise((res) => {
              setTimeout(() => {
                res(10);
              }, 10);
            })
        }
      }
    );

    const service = interpret(myMachine).onError((error) => {
      expect(error.message).toEqual(expect.stringMatching(/force a crash/));
      done();
    });
    service.start();

    service.send('ASYNC');
  });
});
