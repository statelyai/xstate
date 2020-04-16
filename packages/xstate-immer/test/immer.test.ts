// @ts-ignore
import { createMachine, interpret } from 'xstate';
import { assign, createUpdater, ImmerUpdateEvent } from '../src';

describe('@xstate/immer', () => {
  it('should update the context without modifying previous contexts', () => {
    const context = {
      count: 0
    };
    const countMachine = createMachine<typeof context>({
      id: 'count',
      context,
      initial: 'active',
      states: {
        active: {
          on: {
            INC: {
              actions: assign<typeof context>((ctx) => ctx.count++)
            }
          }
        }
      }
    });

    const zeroState = countMachine.initialState;
    const oneState = countMachine.transition(zeroState, 'INC');
    const twoState = countMachine.transition(zeroState, 'INC');

    expect(zeroState.context).toEqual({ count: 0 });
    expect(oneState.context).toEqual({ count: 1 });
    expect(twoState.context).toEqual({ count: 1 });
  });

  it('should perform multiple updates correctly', () => {
    const context = {
      count: 0
    };
    const countMachine = createMachine<typeof context>(
      {
        id: 'count',
        context,
        initial: 'active',
        states: {
          active: {
            on: {
              INC_TWICE: {
                actions: ['increment', 'increment']
              }
            }
          }
        }
      },
      {
        actions: {
          increment: assign<typeof context>((ctx) => ctx.count++)
        }
      }
    );

    const zeroState = countMachine.initialState;
    const twoState = countMachine.transition(zeroState, 'INC_TWICE');

    expect(zeroState.context).toEqual({ count: 0 });
    expect(twoState.context).toEqual({ count: 2 });
  });

  it('should perform deep updates correctly', () => {
    const context = {
      foo: {
        bar: {
          baz: [1, 2, 3]
        }
      }
    };
    const countMachine = createMachine<typeof context>(
      {
        id: 'count',
        context,
        initial: 'active',
        states: {
          active: {
            on: {
              INC_TWICE: {
                actions: ['pushBaz', 'pushBaz']
              }
            }
          }
        }
      },
      {
        actions: {
          pushBaz: assign<typeof context>((ctx) => ctx.foo.bar.baz.push(0))
        }
      }
    );

    const zeroState = countMachine.initialState;
    const twoState = countMachine.transition(zeroState, 'INC_TWICE');

    expect(zeroState.context.foo.bar.baz).toEqual([1, 2, 3]);
    expect(twoState.context.foo.bar.baz).toEqual([1, 2, 3, 0, 0]);
  });

  it('should create updates', () => {
    const context = {
      foo: {
        bar: {
          baz: [1, 2, 3]
        }
      }
    };

    const bazUpdater = createUpdater<
      typeof context,
      ImmerUpdateEvent<'UPDATE_BAZ', number>
    >('UPDATE_BAZ', (ctx, input) => {
      ctx.foo.bar.baz.push(input);
    });

    const countMachine = createMachine<typeof context>({
      id: 'count',
      context,
      initial: 'active',
      states: {
        active: {
          on: {
            [bazUpdater.type]: {
              actions: bazUpdater.assign
            }
          }
        }
      }
    });

    const zeroState = countMachine.initialState;

    const twoState = countMachine.transition(zeroState, bazUpdater(4));

    expect(zeroState.context.foo.bar.baz).toEqual([1, 2, 3]);
    expect(twoState.context.foo.bar.baz).toEqual([1, 2, 3, 4]);
  });

  it('should create updates (form example)', (done) => {
    const context = {
      name: '',
      age: undefined as number | undefined
    };

    const nameUpdater = createUpdater<
      typeof context,
      ImmerUpdateEvent<'UPDATE_NAME', string>
    >('UPDATE_NAME', (ctx, input) => {
      ctx.name = input;
    });

    const ageUpdater = createUpdater<
      typeof context,
      ImmerUpdateEvent<'UPDATE_AGE', number>
    >('UPDATE_AGE', (ctx, input) => {
      ctx.age = input;
    });

    type FormEvent =
      | ReturnType<typeof nameUpdater>
      | ReturnType<typeof ageUpdater>
      | {
          type: 'SUBMIT';
        };

    const formMachine = createMachine<typeof context, FormEvent>({
      initial: 'editing',
      context,
      states: {
        editing: {
          on: {
            [nameUpdater.type]: { actions: nameUpdater.assign },
            [ageUpdater.type]: { actions: ageUpdater.assign },
            SUBMIT: 'submitting'
          }
        },
        submitting: {
          on: {
            '': {
              target: 'success',
              cond: (ctx) => {
                return ctx.name === 'David' && ctx.age === 0;
              }
            }
          }
        },
        success: {
          type: 'final'
        }
      }
    });

    const service = interpret(formMachine)
      .onDone(() => {
        done();
      })
      .start();

    service.send(nameUpdater('David'));
    service.send(ageUpdater(0));

    service.send('SUBMIT');
  });
});
