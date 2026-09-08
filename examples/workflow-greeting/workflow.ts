import { types, createMachine, createAsyncLogic } from 'xstate';
// https://github.com/serverlessworkflow/specification/tree/main/examples#greeting-example
export const workflow = createMachine({
  schemas: {
    context: types<{
      greeting: string | undefined;
      person: { name: string };
    }>(),
    input: types<{
      person: {
        name: string;
      };
    }>()
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
  id: 'greeting',
  context: ({ input }) => ({ greeting: undefined, person: input.person }),
  initial: 'Greet',
  states: {
    Greet: {
      invoke: {
        src: 'greetingFunction',
        input: ({ context }) => ({
          name: context.person.name
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
