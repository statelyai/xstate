import { types, createMachine, createAsyncLogic } from 'xstate';
// https://github.com/serverlessworkflow/specification/tree/main/examples#solving-math-problems-example
export const workflow = createMachine({
  schemas: {
    input: types<{ expressions: string[] }>(),
    context: types<{
      results: string[] | undefined;
      expressions: string[];
    }>()
  },
  actors: {
    batchMathFunction: createAsyncLogic({
      schemas: {
        input: types<{
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
  context: ({ input }) => ({
    results: undefined,
    expressions: input.expressions
  }),
  states: {
    Solve: {
      invoke: {
        src: 'batchMathFunction',
        input: ({ context }) => ({
          problems: context.expressions
        }),
        onDone: ({ context, event }) => {
          return {
            target: 'Solved',
            context: {
              ...context,
              results: event.output.map((r) => r.result)
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
