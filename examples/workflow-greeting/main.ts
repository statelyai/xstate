import { assign, createMachine, fromPromise, interpret, waitFor } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#greeting-example
export const workflow = createMachine(
  {
    id: 'greeting',
    types: {} as {
      input: {
        person: {
          name: string;
        };
      };
    },
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

const actor = interpret(workflow, {
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
