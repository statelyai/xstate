import { createMachine } from '../src';
import { createModel } from '../src/model';

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
    });

    // Example of an externally-defined assign action
    const assignName = userModel.assign(
      {
        name: (_, event) => {
          return event.value;
        }
      },
      'updateName'
    );

    const machine = createMachine<
      typeof userModel['initialContext'],
      UserEvent
    >({
      context: userModel.initialContext,
      initial: 'active',
      states: {
        active: {
          on: {
            updateName: {
              // pre-defined assign action
              actions: assignName
            },
            updateAge: {
              // inline assign action
              actions: userModel.assign((_, e) => {
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
