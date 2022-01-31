import { createMachine, StateFrom, StateMachine } from '.';
import { assign } from './actions';

export const toAsyncFunction = <
  TOutput,
  TStateMachine extends StateMachine<any, any, any, any, any, any, any>
>(
  machine: TStateMachine,
  toOutput: (state: StateFrom<TStateMachine>) => TOutput
) => (
  input: TStateMachine extends StateMachine<
    infer TContext,
    infer _,
    infer __,
    infer ___,
    infer ____,
    infer _____,
    infer ______
  >
    ? TContext
    : never
): Promise<TOutput> => {};

const createUser = toAsyncFunction(
  /** @xstate-layout N4IgpgJg5mDOIC5QGEBOYCGAXMACArrGKgHRqZYCWAdlAUagMQQD21YJNAbiwNYflseQsUSgADi1iUqbMSAAeiAMwAmZSQAMmgByaA7PuUBWAIxmAnMoA0IAJ6IAtOpIX9qgGwft35QBZlEwBfINtBHHpiMnRsGjoRJmJUFlJxABtsADMUgFtoimEGeUlpWWp5JQRPUxJ9YwNVTWUPfQ8ddVsHKuMLElV3Hs0LfotTZQsQ0JBqFgg4eXDCqPC4yNRiqRlKOSRFRD9VTsRTAxI9HXMdHX0A42MvELCYiISSAFUGXABjZ8gN0u25V2lWMnhIxgOHlM+l0flamkO9mOpg8JFMfgC0K8egsFz8jxAizW-y2O1AlVMOiOCEcuJIHnUbVUFj8Ojhyh0ykmQSAA */
  createMachine({
    tsTypes: {} as import('./toFunction.typegen').Typegen0,
    schema: {
      context: {} as { name: string; age: number; id?: string },
      services: {} as {
        'Create user': {
          data: string;
        };
      }
    },
    id: 'Create user',
    initial: 'Creating user',
    states: {
      'Creating user': {
        invoke: {
          id: 'Create user',
          src: 'Create user',
          onDone: [
            {
              actions: 'Assign id to context',
              target: '#Create user.User created'
            }
          ],
          onError: [
            {
              actions: 'Throw error',
              target: '#Create user.Creating user'
            }
          ]
        }
      },
      'User created': {
        type: 'final'
      }
    }
  }).withConfig({
    actions: {
      'Assign id to context': assign((_, event) => {
        return {
          id: event.data
        };
      }),
      'Throw error': () => {
        throw new Error('Could not create user');
      }
    },
    services: {
      'Create user': async () => {
        return '123';
      }
    }
  }),
  (state) => {
    return {
      id: state.context.id
    };
  }
);

createTask((x) => [
  x.action(
    'Report could not email user',
    async (
      // Inputs can be more than one argument
      input: { id: string }
    ) => {
      // Report could not email user
    }
  ),
  x
    .initialTask('Create user', (input: { age: number; name: string }) => {
      return { id: '123', input };
    })
    .onDone('Email user')
    .onError('Errored'),
  x
    .task('Email user', async (input: { id: string }) => {
      // Email user

      return input;
    })
    .onDone('User created')
    // If you error, the next state will be 'called' with
    // the inputs from the previous state
    .onError('User created', {
      actions: 'Report could not email user'
    }),
  x.finalState('User created'),
  x.finalState('Errored')
]);
