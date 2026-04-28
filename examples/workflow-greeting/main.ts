import { assign, createLogic, createActor, setup } from 'xstate';
import { z } from 'zod';
// https://github.com/serverlessworkflow/specification/tree/main/examples#greeting-example
export const workflow = setup({
  types: {
    context: {} as {
      greeting: string | undefined;
    },
    input: {} as {
      person: {
        name: string;
      };
    }
  },
  actors: {
    greetingFunction: createLogic({
      schemas: {
        input: z.custom<{
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
  }
}).createMachine({
  id: 'greeting',
  context: {
    greeting: undefined
  },
  initial: 'Greet',
  states: {
    Greet: {
      invoke: {
        src: 'greetingFunction',
        input: ({ event }) => ({
          name: event.input.person.name
        }),
        onDone: {
          target: 'Greeted',
          actions: assign({
            greeting: ({ event }) => event.output.greeting
          })
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
const actor = createActor(workflow, {
  input: {
    person: { name: 'Jenny' }
  }
});
actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});
actor.start();
