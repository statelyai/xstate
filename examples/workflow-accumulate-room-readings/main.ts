import { assign, createMachine, fromPromise, interpret } from 'xstate';

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
export const workflow = createMachine(
  {
    id: 'roomreadings',
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
    initial: 'ConsumeReading',
    context: {
      temperature: null,
      humidity: null
    },
    states: {
      ConsumeReading: {
        entry: assign({
          temperature: null,
          humidity: null
        }),
        on: {
          TemperatureEvent: {
            actions: assign({
              temperature: ({ event }) => event.temperature
            })
          },
          HumidityEvent: {
            actions: assign({
              humidity: ({ event }) => event.humidity
            })
          }
        },
        after: {
          PT1H: {
            guard: ({ context }) =>
              context.temperature !== null && context.humidity !== null,
            target: 'GenerateReport'
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
  },
  {
    delays: {
      PT1H: 10_000
    },
    actors: {
      produceReport: fromPromise(async ({ input }) => {
        console.log('Starting ProduceReport', input);
        await delay(1_000);
        console.log('ProduceReport done');
        return;
      })
    }
  }
);

// TODO: make this per room (not in original workflow)

const actor = interpret(workflow);

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

await delay(11_000);

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
