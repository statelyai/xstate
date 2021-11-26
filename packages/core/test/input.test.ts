import { AnyEventObject, createMachine, interpret } from '../src';
import { createModel } from '../src/model';

describe('input', () => {
  it('Should allow input to be passed in to the machine initially', (done) => {
    const machine = createMachine<
      {},
      AnyEventObject,
      any,
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

  it('Should error in TS when you do pass a property that input does not accept', () => {
    createMachine<
      {},
      AnyEventObject,
      any,
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
      any,
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

  it(`Should NOT allow service.input to receive a partial`, () => {
    const machine = createMachine<
      {},
      AnyEventObject,
      any,
      {
        input: {
          foo: string;
          bar: string;
        };
      }
    >(
      {},
      {
        input: {
          foo: 'foo',
          bar: 'bar'
        }
      }
    );

    const service = interpret(machine).start();

    service.input(
      // @ts-expect-error
      {
        // Only a partial of what's above
        foo: 'changed'
      }
    );

    expect(service.state.input).toEqual({
      foo: 'changed'
    });
  });

  describe('withConfig', () => {
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

    it('Should NOT allow a partial', () => {
      const model = createModel({}).withInput(
        {} as { foo: string; bar: string }
      );
      const machine = model.createMachine({});

      machine.withConfig({
        // @ts-expect-error
        input: {
          foo: 'foo'
        }
      });
    });
  });

  describe('When users listen for the input on xstate.input', () => {
    it('Should already be updated by the time they receive it', (done) => {
      const machine = createMachine<
        {},
        AnyEventObject,
        any,
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

  it('Should keep previous inputs stored in state.history', () => {
    const machine = createMachine<
      {},
      AnyEventObject,
      any,
      {
        input: {
          foo: string;
        };
      }
    >(
      {},
      {
        input: {
          foo: 'foo'
        }
      }
    );

    const service = interpret(machine).start();

    service.input({
      foo: 'changed'
    });

    expect(service.state.history?.input).toEqual({
      foo: 'foo'
    });
  });
});

describe('createModel', () => {
  it('Should allow you to define the input type', () => {
    const model = createModel({}).withInput(
      {} as {
        foo: string;
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
