import { assign, createMachine, fromPromise, interpret } from 'xstate';

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

// https://github.com/serverlessworkflow/specification/tree/main/examples#event-based-service-invocation
export const workflow = createMachine(
  {
    id: 'VetAppointmentWorkflow',
    types: {} as {
      context: {
        patientInfo: {
          name: string;
          pet: string;
          reason: string;
        } | null;
        appointmentInfo: {
          appointmentId: string;
          appointmentDate: string;
        } | null;
      };
      events: {
        type: 'MakeVetAppointment';
        patientInfo: {
          name: string;
          pet: string;
          reason: string;
        };
      };
    },
    initial: 'Idle',
    context: {
      patientInfo: null,
      appointmentInfo: null
    },
    states: {
      Idle: {
        on: {
          MakeVetAppointment: {
            target: 'MakeVetAppointmentState',
            actions: assign({
              patientInfo: ({ event }) => event.patientInfo
            })
          }
        }
      },
      MakeVetAppointmentState: {
        invoke: {
          src: 'MakeAppointmentAction',
          input: ({ context }) => ({
            patientInfo: context.patientInfo
          }),
          onDone: {
            target: 'Idle',
            actions: assign({
              appointmentInfo: ({ event }) => event.output
            })
          }
        }
      }
    }
  },
  {
    actors: {
      MakeAppointmentAction: fromPromise(async ({ input }) => {
        console.log('Making vet appointment for', input.patientInfo);
        await delay(2000);

        const appointmentInfo = {
          appointmentId: '1234',
          appointmentDate: new Date().toISOString()
        };

        console.log('Vet appointment made', appointmentInfo);
        return {
          appointmentInfo
        };
      })
    }
  }
);

const actor = interpret(workflow, {
  input: {
    person: { name: 'Jenny' }
  }
});

actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();

actor.send({
  type: 'MakeVetAppointment',
  patientInfo: {
    name: 'Jenny',
    pet: 'Ato',
    reason: 'Annual checkup'
  }
});
