import { createMachine, createAsyncLogic, types } from 'xstate';

export type Prompt = (question: string, signal: AbortSignal) => Promise<string>;

/** The caller owns the prompt resource; stopping the workflow aborts its request. */
export function createWorkflow(prompt: Prompt) {
  const onboardingWorkflow = createMachine({
    schemas: { context: types<{ name: string | undefined }>() },
    actors: {
      prompt: createAsyncLogic({
        schemas: {
          input: types<{ question: string }>(),
          output: types<{ response: string }>()
        },
        run: async ({ input, signal }) => ({
          response: await prompt(input.question, signal)
        })
      })
    },
    id: 'onboarding',
    initial: 'Welcome',
    context: { name: undefined },
    states: {
      Welcome: {
        invoke: {
          src: 'prompt',
          input: { question: 'What is your name?' },
          onDone: ({ context, event }) => ({
            target: 'Personalize',
            context: { ...context, name: event.output.response }
          })
        }
      },
      Personalize: {
        invoke: {
          src: 'prompt',
          input: ({ context }) => ({
            question: `Welcome ${context.name}, press enter to finish the onboarding process`
          }),
          onDone: { target: 'Completed' }
        }
      },
      Completed: { type: 'final' }
    }
  });
  return createMachine({
    actors: { onboarding: onboardingWorkflow },
    id: 'async-function-invocation',
    initial: 'Onboard',
    states: {
      Onboard: {
        invoke: { src: 'onboarding', onDone: { target: 'Onboarded' } }
      },
      Onboarded: { type: 'final' }
    }
  });
}
