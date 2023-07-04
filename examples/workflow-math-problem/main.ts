import { assign, createMachine, fromPromise, interpret, waitFor } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#solving-math-problems-example
export const workflow = createMachine(
  {
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
          onDone: {
            target: 'Solved',
            actions: assign({
              results: ({ event }) => event.output
            })
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
  },
  {
    actors: {
      batchMathFunction: fromPromise(async ({ input }) => {
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
      })
    }
  }
);

const actor = interpret(workflow, {
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
