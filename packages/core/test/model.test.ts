import { createMachine } from '../src';
import { createModel } from '../src/model';

describe('createModel', () => {
  it('model.assign updates context and is typed correctly', () => {
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

    const machine = createMachine<UserContext, UserEvent>({
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

  it('model.reset resets the context to its initial value', () => {
    type UserEvent =
      | {
          type: 'updateName';
          value: string;
        }
      | { type: 'updateAge'; value: number }
      | { type: 'reset' };

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

    const machine = createMachine<UserContext, UserEvent>({
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
            },
            reset: {
              actions: userModel.reset()
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

    const resetState = machine.transition(undefined, {
      type: 'reset'
    });

    expect(resetState.context).toEqual(userModel.initialContext);
  });
});
