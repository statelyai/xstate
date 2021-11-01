import { AnyEventObject, createMachine, interpret } from '../src';

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

  it.todo(
    `Should allow users to listen to the input using on: { 'xstate.input': {} }`
  );

  it.todo('Should allow the input to be accessible on the state');
});

describe('useMachine', () => {
  // TODO - should it require a complete input, or a partial? I think the complete input
  it.todo('Should allow for input to be passed');
});

describe('useInterpret', () => {
  // TODO - should it require a complete input, or a partial? I think the complete input
  it.todo('Should allow for input to be passed');
});

describe('createModel', () => {
  it.todo('Should allow you to define the input type');
});
