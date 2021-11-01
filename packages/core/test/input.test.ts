import { AnyEventObject, createMachine, interpret } from '../src';
import { createModel } from '../src/model';

describe('input', () => {
  it('Should allow input to be passed in to the machine initially', (done) => {
    const machine = createMachine<
      {},
      AnyEventObject,
      {
        input: {
          foo: string;
        };
      }
    >(
      {
        entry: [
          (_, __, meta) => {
            expect(meta.state.input).toEqual({
              foo: 'foo'
            });
            done();
          }
        ]
      },
      {
        input: {
          foo: 'foo'
        }
      }
    );

    interpret(machine).start();
  });

  it('Should fail when you do pass a property that input does not accept', () => {
    createMachine<
      {},
      AnyEventObject,
      {
        input: {
          foo: string;
        };
      }
    >(
      {},
      {
        input: {
          foo: 'foo',
          // @ts-expect-error
          bar: 'bar'
        }
      }
    );
  });

  it(`Should allow updating the input during the machine's lifecycle with service.input`, (done) => {
    const machine = createMachine<
      {},
      AnyEventObject,
      {
        input: {
          foo: string;
        };
      }
    >(
      {
        initial: 'notReceivedInput',
        states: {
          notReceivedInput: {
            always: [
              {
                cond: (_, __, meta) => {
                  return meta.state.input.foo === 'bar';
                },
                target: 'receivedInput'
              }
            ]
          },
          receivedInput: {
            entry: [
              (_, __, meta) => {
                expect(meta.state.input).toEqual({
                  foo: 'bar'
                });
                done();
              }
            ]
          }
        }
      },
      {
        input: {
          foo: 'foo'
        }
      }
    );

    const service = interpret(machine).start();

    service.input({
      foo: 'bar'
    });
  });

  it('Should allow you to update the input with withConfig', (done) => {
    const machine = createMachine({
      entry: [
        (_, __, meta) => {
          expect(meta.state.input).toEqual({
            foo: 'foo'
          });
          done();
        }
      ]
    });

    interpret(
      machine.withConfig({
        input: {
          foo: 'foo'
        }
      })
    ).start();
  });

  it.todo('Should only require a partial of the input to update them');

  describe('When users listen for the input on xstate.input', () => {
    it('Should already be updated by the time they receive it', (done) => {
      const machine = createMachine<
        {},
        AnyEventObject,
        {
          input: {
            foo: string;
          };
        }
      >({
        on: {
          'xstate.input': {
            actions: [
              (_, __, meta) => {
                expect(meta.state.input).toEqual({
                  foo: 'bar'
                });
                done();
              }
            ]
          }
        }
      });

      const service = interpret(machine).start();

      service.input({
        foo: 'bar'
      });
    });
  });
});

describe('createModel', () => {
  it('Should allow you to define the input type', () => {
    const model = createModel(
      {},
      {
        input: {} as {
          foo: string;
        }
      }
    );

    model.createMachine(
      {},
      {
        input: {
          // @ts-expect-error
          bar: ''
        }
      }
    );
  });
});
