import { assign, fromPromise, createActor, setup } from 'xstate';

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
