import { createMachine, createAsyncLogic, createActor } from 'xstate';
import { z } from 'zod';
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
// https://github.com/serverlessworkflow/specification/blob/main/examples/README.md#accumulate-room-readings
export const workflow = createMachine({
  types: {} as {
    events:
      | {
          type: 'TemperatureEvent';
          roomId: string;
          temperature: number;
        }
      | {
          type: 'HumidityEvent';
          roomId: string;
          humidity: number;
        };
    context: {
      temperature: number | null;
      humidity: number | null;
    };
  },
  delays: {
    PT1H: 10000
  },
  actorSources: {
    produceReport: createAsyncLogic({
      schemas: {
        input: z.custom<{
          temperature: number | null;
          humidity: number | null;
        }>()
      },
      run: async ({ input }) => {
        console.log('Starting ProduceReport', input);
        await delay(1000);
        console.log('ProduceReport done');
        return;
      }
    })
  },
  id: 'roomreadings',
  initial: 'ConsumeReading',
  context: {
    temperature: null,
    humidity: null
  },
  states: {
    ConsumeReading: {
      entry: (args, enq) => {
        return {
          context: { ...args.context, temperature: null, humidity: null }
        };
      },
      on: {
        TemperatureEvent: ({ context, event, guards, actions }, enq) => {
          return {
            context: {
              ...context,
              temperature: (({ event }) => event.temperature)({
                context: context,
                event: event
              })
            }
          };
        },
        HumidityEvent: ({ context, event, guards, actions }, enq) => {
          return {
            context: {
              ...context,
              humidity: (({ event }) => event.humidity)({
                context: context,
                event: event
              })
            }
          };
        }
      },
      after: {
        PT1H: ({ context, event, guards, actions }, enq) => {
          if (
            !(({ context }) =>
              context.temperature !== null && context.humidity !== null)({
              context,
              event
            })
          ) {
            return;
          }
          return { target: 'GenerateReport' };
        }
      }
    },
    GenerateReport: {
      invoke: {
        src: 'produceReport',
        input: ({ context }) => ({
          temperature: context.temperature,
          humidity: context.humidity
        }),
        onDone: {
          target: 'ConsumeReading'
        }
      }
    }
  }
});
// TODO: make this per room (not in original workflow)
const actor = createActor(workflow);
actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});
actor.start();
actor.send({
  type: 'TemperatureEvent',
  roomId: 'kitchen',
  temperature: 20
});
await delay(1000);
actor.send({
  type: 'HumidityEvent',
  roomId: 'kitchen',
  humidity: 50
});
await delay(11000);
actor.send({
  type: 'TemperatureEvent',
  roomId: 'kitchen',
  temperature: 10
});
await delay(1000);
actor.send({
  type: 'HumidityEvent',
  roomId: 'kitchen',
  humidity: 30
});
await delay(1000);
