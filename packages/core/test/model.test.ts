import { createMachine } from '../src';
import { createModel } from '../src/model';

describe('createModel', () => {
  it('model.machine creates a machine that is updated', () => {
    type UserEvent = {
      type: 'updateName';
      value: string;
    };

    interface UserContext {
      name: string;
      age: number;
    }

    const userModel = createModel<UserContext, UserEvent>({
      name: 'David',
      age: 30
    }).withUpdaters({
      updateName: {
        name: (_, e: UserEvent) => e.value
      }
    });

    const machine = createMachine<typeof userModel['context'], UserEvent>({
      context: userModel.context,
      initial: 'active',
      states: {
        active: {
          on: {
            updateName: {
              actions: userModel.actions.updateName
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
