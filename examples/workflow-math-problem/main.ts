import { createMachine, createAsyncLogic, createActor } from 'xstate';
import { z } from 'zod';
// https://github.com/serverlessworkflow/specification/tree/main/examples#solving-math-problems-example
export const workflow = createMachine({
  types: {
    context: {} as {
      results: string[] | undefined;
    }
  },
  actorSources: {
    batchMathFunction: createAsyncLogic({
      schemas: {
        input: z.custom<{
          problems: string[];
        }>()
      },
      run: async ({ input }) => {
        return await Promise.all(
          input.problems.map(async (problem) => {
            console.log('solving', problem);
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return {
              problem,
              result: `Solved ${problem}`
            };
          })
        );
      }
    })
  },
  id: 'math-problem',
  initial: 'Solve',
  context: {
    results: undefined
  },
  states: {
    Solve: {
      invoke: {
        src: 'batchMathFunction',
        input: ({ event }) => ({
          problems: event.input.expressions
        }),
        onDone: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'Solved',
            context: {
              ...context,
              results: (({ event }) => event.output.map((r) => r.result))({
                context: context,
                event: event
              })
            }
          };
        }
      }
    },
    Solved: {
      type: 'final',
      output: ({ context }) => ({
        results: context.results
      })
    }
  }
});
const actor = createActor(workflow, {
  input: {
    expressions: ['2+2', '4-1', '10x3', '20/2']
  }
});
actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});
actor.start();
