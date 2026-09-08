import { types, createMachine } from 'xstate';

// https://github.com/serverlessworkflow/specification/blob/main/examples/README.md#filling-a-glass-of-water
export const workflow = createMachine({
  id: 'fillglassofwater',
  schemas: {
    events: {
      WaterAddedEvent: types<{
        type: 'WaterAddedEvent';
      }>()
    },
    context: types<{
      counts: {
        current: number;
        max: number;
      };
    }>(),
    input: types<{
      current: number;
      max: number;
    }>()
  },
  initial: 'CheckIfFull',
  context: ({ input }) => ({
    counts: input
  }),
  states: {
    CheckIfFull: {
      always: ({ context }) => {
        if (context.counts.current < context.counts.max) {
          return { target: 'AddWater' };
        }
        return {
          target: 'GlassFull'
        };
      }
    },
    AddWater: {
      after: {
        500: ({ context }) => {
          return {
            target: 'CheckIfFull',
            context: {
              ...context,
              counts: {
                ...context.counts,
                current: context.counts.current + 1
              }
            }
          };
        }
      }
    },
    GlassFull: {
      type: 'final'
    }
  }
});
