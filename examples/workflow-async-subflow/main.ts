import { assign, createMachine, fromPromise, interpret } from 'xstate';
import readline from 'readline';

// https://github.com/serverlessworkflow/specification/tree/main/examples#async-subflow-invocation-example

const rl = readline.createInterface({
  input: process.stdin,
  // @ts-ignore
  output: process.stdout
});

const prompt = (question: string) =>
  new Promise<string>((resolve) => rl.question(question, resolve));

const onboardingWorkflow = createMachine(
  {
    id: 'onboarding',
    initial: 'Welcome',
    context: {
      name: undefined
    },
    states: {
      Welcome: {
        invoke: {
          src: 'prompt',
          input: {
            question: 'What is your name?'
          },
          onDone: {
            target: 'Personalize',
            actions: assign({
              name: ({ event }) => event.output.response
            })
          }
        }
      },
      Personalize: {
        invoke: {
          src: 'prompt',
          input: ({ context }) => ({
            question: `Welcome ${context.name}, press enter to finish the onboarding process`
          }),
          onDone: 'Completed'
        }
      },
      Completed: {
        type: 'final'
      }
    }
  },
  {
    actors: {
      prompt: fromPromise(async ({ input }) => {
        const response = await prompt(input.question);
        return {
          response
        };
      })
    }
  }
);

export const workflow = createMachine(
  {
    id: 'async-function-invocation',
    initial: 'Onboard',
    states: {
      Onboard: {
        invoke: {
          src: 'onboarding',
          onDone: 'Onboarded'
        }
      },
      Onboarded: {
        type: 'final'
      }
    }
  },
  {
    actors: {
      onboarding: onboardingWorkflow
    }
  }
);

const actor = interpret(workflow);

actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
    rl.close();
  }
});

actor.start();
