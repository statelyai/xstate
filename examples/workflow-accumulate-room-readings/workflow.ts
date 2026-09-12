import { types, createMachine, createAsyncLogic } from 'xstate';
export async function delay(
  ms: number,
  errorProbability: number = 0
): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < errorProbability) {
        reject(
          Object.assign(new Error('ServiceNotAvailable'), {
            type: 'ServiceNotAvailable'
          })
        );
      } else {
        resolve();
      }
    }, ms);
  });
}
// https://github.com/serverlessworkflow/specification/blob/main/examples/README.md#accumulate-room-readings
export const workflow = createMachine({
  schemas: {
    events: {
      TemperatureEvent: types<{
        type: 'TemperatureEvent';
        roomId: string;
        temperature: number;
      }>(),
      HumidityEvent: types<{
        type: 'HumidityEvent';
        roomId: string;
        humidity: number;
      }>()
    },
    context: types<{
      temperature: number | null;
      humidity: number | null;
    }>()
  },
  delays: {
    PT1H: 10000
  },
  actors: {
    produceReport: createAsyncLogic({
      schemas: {
        input: types<{
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
      on: {
        TemperatureEvent: ({ context, event }) => {
          return {
            context: {
              ...context,
              temperature: event.temperature
            }
          };
        },
        HumidityEvent: ({ context, event }) => {
          return {
            context: {
              ...context,
              humidity: event.humidity
            }
          };
        }
      },
      after: {
        PT1H: ({ context }) => {
          if (!(context.temperature !== null && context.humidity !== null)) {
            return { target: 'ConsumeReading', reenter: true };
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
          target: 'ConsumeReading',
          context: { temperature: null, humidity: null }
        }
      }
    }
  }
});
// TODO: make this per room (not in original workflow)
