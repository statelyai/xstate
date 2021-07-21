import { assign, createMachine, interpret } from '../../core/src';
import { makePromptService } from '../src/cli';

jest.mock('prompts', () => {
  return {
    default: () => {
      return {
        name: 'Name',
        age: 24
      };
    }
  };
});

describe('@xstate/cli', () => {
  describe('makePromptService', () => {
    interface Context {
      name?: string;
      age?: string;
    }

    const machine = createMachine<Context>({
      initial: 'askingAboutYou',
      context: {},
      states: {
        askingAboutYou: {
          invoke: makePromptService(
            [
              {
                name: 'name',
                type: 'text',
                message: 'What is your name?'
              },
              {
                name: 'age',
                type: 'number',
                message: 'What is your age?'
              }
            ],
            {
              onDone: {
                actions: assign((_context, event) => {
                  return {
                    name: event.data.name,
                    age: event.data.age
                  };
                }),
                target: 'complete'
              },
              onError: { actions: (_ctx, event) => console.log(event) }
            }
          )
        },
        complete: {
          type: 'final'
        }
      }
    });

    it('Should capture user details via a prompt', (done) => {
      interpret(machine)
        .onTransition((state) => {
          if (state.value === 'complete') {
            expect(state.context).toEqual({
              age: 24,
              name: 'Name'
            });
            done();
          }
        })
        .start();
    });
  });
});
