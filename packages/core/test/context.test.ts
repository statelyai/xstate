import { createMachine } from '../src';

describe('state context', () => {
  it('should assign context when a state is entered (property value)', () => {
    const machine = createMachine({
      initial: 'inactive',
      context: {
        count: 0,
        message: 'secret'
      },
      states: {
        inactive: {
          on: {
            TRIGGER: 'active'
          }
        },
        active: {
          context: {
            count: 10
          }
        }
      }
    });

    const { initialState } = machine;

    expect(initialState.context).toEqual({
      count: 0,
      message: 'secret'
    });

    const nextState = machine.transition(initialState, 'TRIGGER');

    expect(nextState.context).toEqual({
      count: 10,
      message: 'secret'
    });
  });

  it('should assign context when a state is entered (property assigner)', () => {
    const machine = createMachine({
      initial: 'inactive',
      context: {
        count: 0,
        message: 'secret'
      },
      states: {
        inactive: {
          on: {
            TRIGGER: 'active'
          }
        },
        active: {
          context: {
            // Note: original ctx.message is used here
            count: ctx => ctx.count + ctx.message.length,
            message: ctx => ctx.message.repeat(2)
          }
        }
      }
    });

    const nextState = machine.transition(undefined, 'TRIGGER');

    expect(nextState.context).toEqual({
      count: 6,
      message: 'secretsecret'
    });
  });

  it('should assign context when a state is entered (full assigner)', () => {
    const machine = createMachine({
      initial: 'inactive',
      context: {
        count: 0,
        message: 'secret'
      },
      states: {
        inactive: {
          on: {
            TRIGGER: 'active'
          }
        },
        active: {
          context: ctx => {
            const newMessage = ctx.message.repeat(2);
            const newCount = newMessage.length;

            return {
              message: newMessage,
              count: newCount
            };
          }
        }
      }
    });

    const nextState = machine.transition(undefined, 'TRIGGER');

    expect(nextState.context).toEqual({
      count: 12,
      message: 'secretsecret'
    });
  });
});
