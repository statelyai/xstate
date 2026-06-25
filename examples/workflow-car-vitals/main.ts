import { createMachine, createAsyncLogic, createActor, log } from 'xstate';
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
const vitalsWorkflow = createMachine({
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
          onDone: ({ context, event, guards, actions }, enq) => {
            return {
              context: {
                ...context,
                tirePressure: (({ event }) => event.output)({
                  context: context,
                  event: event
                })
              }
            };
          }
        },
        {
          src: 'checkOilPressure',
          onDone: ({ context, event, guards, actions }, enq) => {
            return {
              context: {
                ...context,
                oilPressure: (({ event }) => event.output)({
                  context: context,
                  event: event
                })
              }
            };
          }
        },
        {
          src: 'checkCoolantLevel',
          onDone: ({ context, event, guards, actions }, enq) => {
            return {
              context: {
                ...context,
                coolantLevel: (({ event }) => event.output)({
                  context: context,
                  event: event
                })
              }
            };
          }
        },
        {
          src: 'checkBattery',
          onDone: ({ context, event, guards, actions }, enq) => {
            return {
              context: {
                ...context,
                battery: (({ event }) => event.output)({
                  context: context,
                  event: event
                })
              }
            };
          }
        }
      ],
      always: ({ context, event, guards, actions }, enq) => {
        if (
          !(({ context }) => {
            return !!(
              context.tirePressure &&
              context.oilPressure &&
              context.coolantLevel &&
              context.battery
            );
          })({ context, event })
        ) {
          return;
        }
        return { target: 'VitalsChecked' };
      }
    },
    VitalsChecked: {
      type: 'final',
      output: ({ context }) => context
    }
  },
  actorSources: {
    checkTirePressure: createAsyncLogic({
      run: async () => {
        console.log('Starting checkTirePressure');
        await delay(1000);
        console.log('Completed checkTirePressure');
        return { value: 100 };
      }
    }),
    checkOilPressure: createAsyncLogic({
      run: async () => {
        console.log('Starting checkOilPressure');
        await delay(1500);
        console.log('Completed checkOilPressure');
        return { value: 100 };
      }
    }),
    checkCoolantLevel: createAsyncLogic({
      run: async () => {
        console.log('Starting checkCoolantLevel');
        await delay(500);
        console.log('Completed checkCoolantLevel');
        return { value: 100 };
      }
    }),
    checkBattery: createAsyncLogic({
      run: async () => {
        console.log('Starting checkBattery');
        await delay(1200);
        console.log('Completed checkBattery');
        return { value: 100 };
      }
    })
  }
});
// https://github.com/serverlessworkflow/specification/blob/main/examples/README.md#car-vitals-checks
export const workflow = createMachine({
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
        onDone: ({ context, event, guards, actions }, enq) => {
          enq(({ event }) => {
            console.log('Done with vitals check', event.output);
          });
          return { target: 'CheckContinueVitalChecks' };
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
    CarTurnedOffEvent: ({ context, event, guards, actions }, enq) => {
      enq(log('Car turned off'));
      return { target: '.WhenCarIsOn' };
    }
  },
  actorSources: {
    vitalscheck: vitalsWorkflow
  }
});
const actor = createActor(workflow);
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
