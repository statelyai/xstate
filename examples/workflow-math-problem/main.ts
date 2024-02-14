import { assign, fromPromise, createActor, setup } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#solving-math-problems-example
export const workflow = setup({
  types: {
    context: {} as {
      results: string[] | undefined;
    }
  },
  actors: {
    batchMathFunction: fromPromise(
      async ({
        input
      }: {
        input: {
          problems: string[];
        };
      }) => {
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
    )
  }
}).createMachine({
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
            results: ({ event }) => event.output.map((r) => r.result)
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
