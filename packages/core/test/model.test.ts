import { createMachine, assign } from '../src';
import { assertEvent, createModel } from '../src/model';

describe('createModel', () => {
  it('model.machine creates a machine that is updated', () => {
    type UserEvent =
      | {
          type: 'updateName';
          value: string;
        }
      | { type: 'updateAge'; value: number }
      | { type: 'anotherEvent' };

    interface UserContext {
      name: string;
      age: number;
    }

    const userModel = createModel<UserContext, UserEvent>({
      name: 'David',
      age: 30
    }).withActions({
      assignName: assign({
        name: (ctx, event) => {
          if (assertEvent(event, 'updateName')) {
            return event.value;
          }
          return ctx.name;
        }
      }),
      updateAge: assign((ctx, event) => {
        if (!('value' in event) || typeof event.value !== 'number') {
          return ctx;
        }

        return {
          age: event.value
        };
      })
    });

    const machine = createMachine<typeof userModel['context'], UserEvent>({
      context: userModel.context,
      initial: 'active',
      states: {
        active: {
          on: {
            updateName: {
              actions: userModel.actions.assignName
            },
            updateAge: {
              // actions: [userModel.actions.updateAge]
              // actions: assign({
              //   age: (_, e) => e.value
              // })
              actions: assign((_, e) => {
                return {
                  age: e.value
                };
              })
            }
          }
        }
      }
    });

    const updatedState = machine.transition(undefined, {
      type: 'updateName',
      value: 'Anyone'
    });

    expect(updatedState.context.name).toEqual('Anyone');
  });
});
