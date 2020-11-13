import { createMachine, ExtractEvent } from '../src';
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
    }).withAssigners({
      assignName: {
        name: (_, event: ExtractEvent<UserEvent, 'updateName'>) => event.value
      },
      updateAge: (_, event: ExtractEvent<UserEvent, 'updateAge'>) => {
        return {
          age: event.value
        };
      }
    });

    const machine = createMachine<typeof userModel['context'], UserEvent>({
      context: () => userModel.context,
      initial: 'active',
      states: {
        active: {
          on: {
            updateName: {
              actions: userModel.actions.assignName
            },
            updateAge: {
              actions: userModel.actions.updateAge
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
