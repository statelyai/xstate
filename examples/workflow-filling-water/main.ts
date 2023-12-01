import { assign, createMachine, interpret } from 'xstate';

async function delay(ms: number, errorProbability: number = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < errorProbability) {
        reject({ type: 'ServiceNotAvailable' });
      } else {
        resolve();
      }
    }, ms);
  });
}

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
        {
          target: 'AddWater',
          guard: ({ context }) => context.counts.current < context.counts.max
        },
        {
          target: 'GlassFull'
        }
      ]
    },
    AddWater: {
      after: {
        500: {
          actions: assign({
            counts: ({ context }) => ({
              ...context.counts,
              current: context.counts.current + 1
            })
          }),
          target: 'CheckIfFull'
        }
      }
    },
    GlassFull: {
      type: 'final'
    }
  }
});

const actor = interpret(workflow, {
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
