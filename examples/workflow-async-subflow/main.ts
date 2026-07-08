import { createMachine, createAsyncLogic, createActor } from 'xstate';
import readline from 'readline';
import { z } from 'zod';
// https://github.com/serverlessworkflow/specification/tree/main/examples#async-subflow-invocation-example
const rl = readline.createInterface({
  input: process.stdin,
  // @ts-ignore
  output: process.stdout
});
const prompt = (question: string) =>
  new Promise<string>((resolve) => rl.question(question, resolve));
const onboardingWorkflow = createMachine({
  actorSources: {
    prompt: createAsyncLogic({
      schemas: {
        input: z.custom<{
          question: string;
        }>()
      },
      run: async ({ input }) => {
        const response = await prompt(input.question);
        return {
          response
        };
      }
    })
  },
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
        onDone: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'Personalize',
            context: {
              ...context,
              name: (({ event }) => event.output.response)({
                context: context,
                event: event
              })
            }
          };
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
});
export const workflow = createMachine({
  actorSources: {
    onboarding: onboardingWorkflow
  },
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
});
const actor = createActor(workflow);
actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
    rl.close();
  }
});
actor.start();
