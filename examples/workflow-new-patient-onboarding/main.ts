import {
  assign,
  createMachine,
  forwardTo,
  fromPromise,
  interpret,
  sendParent
} from 'xstate';
import { retry, handleWhen, ConstantBackoff } from 'cockatiel';

const retryPolicy = retry(
  handleWhen((err) => (err as any).type === 'ServiceNotAvailable'),
  {
    maxAttempts: 10,
    backoff: new ConstantBackoff(3000)
  }
);

retryPolicy.onRetry((data) => {
  console.log('Retrying...', data);
});

async function delay(ms: number, errorProbability: number): Promise<void> {
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

// https://github.com/serverlessworkflow/specification/blob/main/examples/README.md#New-Patient-Onboarding
export const workflow = createMachine(
  {
    id: 'patientonboarding',
    types: {} as {
      events: { type: 'NewPatientEvent'; name: string; condition: string };
      context: {
        patient: {
          name: string;
          condition: string;
        } | null;
      };
    },
    initial: 'Idle',
    context: {
      patient: null
    },
    states: {
      Idle: {
        on: {
          NewPatientEvent: {
            target: 'Onboard',
            actions: assign({
              patient: ({ event }) => ({
                name: event.name,
                condition: event.condition
              })
            })
          }
        }
      },
      Onboard: {
        initial: 'StorePatient',
        states: {
          StorePatient: {
            invoke: {
              src: 'StoreNewPatientInfo',
              input: ({ context }) => context.patient,
              onDone: {
                target: 'AssignDoctor'
              },
              onError: {
                target: '#End'
              }
            }
          },
          AssignDoctor: {
            invoke: {
              src: 'AssignDoctor',
              onDone: {
                target: 'ScheduleAppt'
              },
              onError: {
                target: '#End'
              }
            }
          },
          ScheduleAppt: {
            invoke: {
              src: 'ScheduleAppt',
              onDone: {
                target: 'Done'
              },
              onError: {
                target: '#End'
              }
            }
          },
          Done: {
            type: 'final'
          }
        },
        onDone: {
          target: 'End',
          actions: assign({
            patient: null
          })
        }
      },
      End: {
        id: 'End',
        type: 'final'
      }
    }
  },
  {
    actors: {
      StoreNewPatientInfo: fromPromise(async ({ input }) => {
        console.log('Starting StoreNewPatientInfo', input);
        await retryPolicy.execute(() => delay(1000, 0.5));
        console.log('Completed StoreNewPatientInfo');
      }),
      AssignDoctor: fromPromise(async () => {
        console.log('Starting AssignDoctor');
        await retryPolicy.execute(() => delay(1000, 0.5));
        console.log('Completed AssignDoctor');
      }),
      ScheduleAppt: fromPromise(async () => {
        console.log('Starting ScheduleAppt');
        await retryPolicy.execute(() => delay(1000, 0.5));
        console.log('Completed ScheduleAppt');
      })
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

actor.send({
  type: 'NewPatientEvent',
  name: 'John Doe',
  condition: 'Broken Arm'
});
