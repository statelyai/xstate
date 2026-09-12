import { types, createMachine, createAsyncLogic } from 'xstate';
import { retry, handleWhen, ConstantBackoff } from 'cockatiel';
const retryPolicy = retry(
  handleWhen(
    (err) =>
      typeof err === 'object' &&
      err !== null &&
      'type' in err &&
      err.type === 'ServiceNotAvailable'
  ),
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
// https://github.com/serverlessworkflow/specification/blob/main/examples/README.md#New-Patient-Onboarding
export const workflow = createMachine({
  id: 'patientonboarding',
  schemas: {
    events: {
      NewPatientEvent: types<{
        type: 'NewPatientEvent';
        name: string;
        condition: string;
      }>()
    },
    context: types<{
      patient: {
        name: string;
        condition: string;
      } | null;
    }>()
  },
  initial: 'Idle',
  context: {
    patient: null
  },
  states: {
    Idle: {
      on: {
        NewPatientEvent: ({ context, event }) => {
          return {
            target: 'Onboard',
            context: {
              ...context,
              patient: {
                name: event.name,
                condition: event.condition
              }
            }
          };
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
      onDone: ({ context }) => {
        return { target: 'End', context: { ...context, patient: null } };
      }
    },
    End: {
      id: 'End',
      type: 'final'
    }
  },
  actors: {
    StoreNewPatientInfo: createAsyncLogic({
      schemas: { input: types<{ name: string; condition: string } | null>() },
      run: async ({ input }) => {
        console.log('Starting StoreNewPatientInfo', input);
        await retryPolicy.execute(() => delay(1000, 0.5));
        console.log('Completed StoreNewPatientInfo');
      }
    }),
    AssignDoctor: createAsyncLogic({
      run: async () => {
        console.log('Starting AssignDoctor');
        await retryPolicy.execute(() => delay(1000, 0.5));
        console.log('Completed AssignDoctor');
      }
    }),
    ScheduleAppt: createAsyncLogic({
      run: async () => {
        console.log('Starting ScheduleAppt');
        await retryPolicy.execute(() => delay(1000, 0.5));
        console.log('Completed ScheduleAppt');
      }
    })
  }
});
