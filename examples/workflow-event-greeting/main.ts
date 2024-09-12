import { assign, fromPromise, createActor, setup } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#event-based-greeting-example
export const workflow = setup({
  types: {
    events: {} as { type: 'greet'; greet: { name: string } }
  },
  actors: {
    greetingFunction: fromPromise(
      async ({ input }: { input: { name: string } }) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return {
          greeting: `Hello, ${input.name}!`
        };
      }
    )
  }
}).createMachine({
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
