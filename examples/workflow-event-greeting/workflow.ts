import { types, createMachine, createAsyncLogic } from 'xstate';
// https://github.com/serverlessworkflow/specification/tree/main/examples#event-based-greeting-example
export const workflow = createMachine({
  schemas: {
    events: {
      greet: types<{
        type: 'greet';
        greet: {
          name: string;
        };
      }>()
    }
  },
  actors: {
    greetingFunction: createAsyncLogic({
      schemas: {
        input: types<{
          name: string;
        }>()
      },
      run: async ({ input }) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return {
          greeting: `Hello, ${input.name}!`
        };
      }
    })
  },
  id: 'event-greeting',
  initial: 'Waiting',
  states: {
    Waiting: {
      on: {
        greet: { target: 'Greet' }
      }
    },
    Greet: {
      invoke: {
        src: 'greetingFunction',
        input: ({ event }) => ({
          name: event.greet.name
        }),
        onDone: ({ context, event }) => {
          return {
            target: 'Greeted',
            context: {
              ...context,
              greeting: event.output.greeting
            }
          };
        }
      }
    },
    Greeted: {
      type: 'final',
      output: ({ context }) => ({
        greeting: context.greeting
      })
    }
  }
});
