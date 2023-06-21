import {
  assign,
  createMachine,
  forwardTo,
  fromPromise,
  interpret,
  sendParent,
  log
} from 'xstate';

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

const vitalsWorkflow = createMachine(
  {
    id: 'vitalscheck',
    context: {
      tirePressure: null,
      oilPressure: null,
      coolantLevel: null,
      battery: null
    },
    initial: 'CheckVitals',
    states: {
      CheckVitals: {
        invoke: [
          {
            src: 'checkTirePressure',
            onDone: {
              actions: assign({
                tirePressure: ({ event }) => event.output
              })
            }
          },
          {
            src: 'checkOilPressure',
            onDone: {
              actions: assign({
                oilPressure: ({ event }) => event.output
              })
            }
          },
          {
            src: 'checkCoolantLevel',
            onDone: {
              actions: assign({
                coolantLevel: ({ event }) => event.output
              })
            }
          },
          {
            src: 'checkBattery',
            onDone: {
              actions: assign({
                battery: ({ event }) => event.output
              })
            }
          }
        ],
        always: {
          guard: ({ context }) => {
            return !!(
              context.tirePressure &&
              context.oilPressure &&
              context.coolantLevel &&
              context.battery
            );
          },
          target: 'VitalsChecked'
        }
      },
      VitalsChecked: {
        type: 'final',
        output: ({ context }) => context
      }
    }
  },
  {
    actors: {
      checkTirePressure: fromPromise(async () => {
        console.log('Starting checkTirePressure');
        await delay(1000);
        console.log('Completed checkTirePressure');
        return { value: 100 };
      }),
      checkOilPressure: fromPromise(async () => {
        console.log('Starting checkOilPressure');
        await delay(1500);
        console.log('Completed checkOilPressure');
        return { value: 100 };
      }),
      checkCoolantLevel: fromPromise(async () => {
        console.log('Starting checkCoolantLevel');
        await delay(500);
        console.log('Completed checkCoolantLevel');
        return { value: 100 };
      }),
      checkBattery: fromPromise(async () => {
        console.log('Starting checkBattery');
        await delay(1200);
        console.log('Completed checkBattery');
        return { value: 100 };
      })
    }
  }
);

// https://github.com/serverlessworkflow/specification/blob/main/examples/README.md#car-vitals-checks
export const workflow = createMachine(
  {
    id: 'checkcarvitals',
    initial: 'WhenCarIsOn',
    states: {
      WhenCarIsOn: {
        on: {
          CarTurnedOnEvent: 'DoCarVitalChecks'
        }
      },
      DoCarVitalChecks: {
        invoke: {
          src: 'vitalscheck',
          onDone: {
            actions: ({ event }) => {
              console.log('Done with vitals check', event.output);
            },
            target: 'CheckContinueVitalChecks'
          }
        }
      },
      CheckContinueVitalChecks: {
        after: {
          1000: 'DoCarVitalChecks'
        }
      }
    },
    on: {
      CarTurnedOffEvent: {
        actions: log('Car turned off'),
        target: '.WhenCarIsOn'
      }
    }
  },
  {
    actors: {
      vitalscheck: vitalsWorkflow
    }
  }
);

const actor = interpret(workflow);

actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();

await delay(1000);

actor.send({
  type: 'CarTurnedOnEvent'
});

await delay(6000);

actor.send({
  type: 'CarTurnedOffEvent'
});
