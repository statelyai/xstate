import { createMachine, createActor } from 'xstate';

// https://github.com/serverlessworkflow/specification/blob/main/examples/README.md#filling-a-glass-of-water
export const workflow = createMachine({
  id: 'fillglassofwater',
  types: {} as {
    events: {
      type: 'WaterAddedEvent';
    };
    context: {
      counts: {
        current: number;
        max: number;
      };
    };
    input: {
      current: number;
      max: number;
    };
  },
  initial: 'CheckIfFull',
  context: ({ input }) => ({
    counts: input
  }),
  states: {
    CheckIfFull: {
      always: [
        ({ context, event, guards, actions }, enq) => {
          if (
            !(({ context }) => context.counts.current < context.counts.max)({
              context,
              event
            })
          ) {
            return;
          }
          return { target: 'AddWater' };
        },
        {
          target: 'GlassFull'
        }
      ]
    },
    AddWater: {
      after: {
        500: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'CheckIfFull',
            context: {
              ...context,
              counts: (({ context }) => ({
                ...context.counts,
                current: context.counts.current + 1
              }))({ context: context, event: event })
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

const actor = createActor(workflow, {
  input: {
    current: 0,
    max: 10
  }
});

actor.subscribe({
  next(snapshot) {
    console.log('workflow state', snapshot.value);
    console.log('workflow context', snapshot.context);
  },
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();
