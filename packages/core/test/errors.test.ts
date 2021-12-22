import { createMachine, interpret } from '../src';

describe('error handling', () => {
  it('interpreter should not settle on target state if transition actions throw sync errors', (done) => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: {
              target: 'b',
              actions: () => {
                throw new Error('oops');
              }
            }
          },
          onError: 'c'
        },
        b: {},
        c: {}
      }
    });

    const service = interpret(machine)
      .onTransition((s) => {
        if (s.matches('b')) {
          throw new Error('Should not reach "b" state');
        }

        if (s.matches('c')) {
          done();
        }
      })
      .start();

    service.send('EVENT');
  });

  it('interpreter should not settle on target state if entry actions throw sync errors', (done) => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: {
              target: 'b'
            }
          },
          onError: 'c'
        },
        b: {
          entry: () => {
            throw new Error('oops');
          }
        },
        c: {}
      }
    });

    const service = interpret(machine)
      .onTransition((s) => {
        if (s.matches('b')) {
          throw new Error('Should not reach "b" state');
        }

        if (s.matches('c')) {
          done();
        }
      })
      .start();

    service.send('EVENT');
  });

  it.skip('interpreter should not settle on target state if exit actions throw sync errors', (done) => {
    const machine = createMachine({
      initial: 'a',
      states: {
        a: {
          on: {
            EVENT: 'b'
          },
          onError: 'c',
          exit: () => {
            throw new Error('oops'); // TODO: this causes infinite loop
          }
        },
        b: {},
        c: {}
      }
    });

    const service = interpret(machine)
      .onTransition((s) => {
        if (s.matches('b')) {
          throw new Error('Should not reach "b" state');
        }

        if (s.matches('c')) {
          done();
        }
      })
      .start();

    service.send('EVENT');
  });
});
