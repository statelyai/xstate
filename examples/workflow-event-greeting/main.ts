import { createMachine, createAsyncLogic, createActor } from 'xstate';
import { z } from 'zod';
// https://github.com/serverlessworkflow/specification/tree/main/examples#event-based-greeting-example
export const workflow = createMachine({
  types: {
    events: {} as {
      type: 'greet';
      greet: {
        name: string;
      };
    }
  },
  actorSources: {
    greetingFunction: createAsyncLogic({
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
  },
  id: 'event-greeting',
  initial: 'Waiting',
  states: {
    Waiting: {
      on: {
        greet: 'Greet'
      }
    },
    Greet: {
      invoke: {
        src: 'greetingFunction',
        input: ({ event }) => ({
          name: event.greet.name
        }),
        onDone: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'Greeted',
            context: {
              ...context,
              greeting: (({ event }) => event.output.greeting)({
                context: context,
                event: event
              })
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
const actor = createActor(workflow);
actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});
actor.start();
actor.send({
  type: 'greet',
  greet: { name: 'Jenny' }
});
