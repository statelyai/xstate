import { assign, fromPromise, createActor, setup } from 'xstate';

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

interface PatientInfo {
  name: string;
  pet: string;
  reason: string;
}

// https://github.com/serverlessworkflow/specification/tree/main/examples#event-based-service-invocation
export const workflow = setup({
  actors: {
    MakeAppointmentAction: fromPromise(
      async ({ input }: { input: { patientInfo: PatientInfo } }) => {
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
      }
    )
  }
}).createMachine({
  id: 'VetAppointmentWorkflow',
  types: {} as {
    context: {
      patientInfo: PatientInfo | null;
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
});

const actor = createActor(workflow, {
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
