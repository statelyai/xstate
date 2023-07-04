import { assign, createMachine, fromPromise, interpret, waitFor } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#event-based-greeting-example
export const workflow = createMachine(
  {
    id: 'event-greeting',
    types: {} as {
      events: { type: 'greet'; greet: { name: string } };
    },
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
  },
  {
    actors: {
      greetingFunction: fromPromise(async ({ input }) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return {
          greeting: `Hello, ${input.name}!`
        };
      })
    }
  }
);

const actor = interpret(workflow);

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
