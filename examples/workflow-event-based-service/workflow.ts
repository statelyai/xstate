import { types, createMachine, createAsyncLogic } from 'xstate';
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
export const workflow = createMachine({
  actors: {
    MakeAppointmentAction: createAsyncLogic({
      schemas: {
        input: types<{
          patientInfo: PatientInfo;
        }>()
      },
      run: async ({ input }) => {
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
    })
  },
  id: 'VetAppointmentWorkflow',
  schemas: {
    context: types<{
      patientInfo: PatientInfo | null;
      appointmentInfo: {
        appointmentId: string;
        appointmentDate: string;
      } | null;
    }>(),
    events: {
      MakeVetAppointment: types<{
        type: 'MakeVetAppointment';
        patientInfo: {
          name: string;
          pet: string;
          reason: string;
        };
      }>()
    }
  },
  initial: 'Idle',
  context: {
    patientInfo: null,
    appointmentInfo: null
  },
  states: {
    Idle: {
      on: {
        MakeVetAppointment: ({ context, event }) => {
          return {
            target: 'MakeVetAppointmentState',
            context: {
              ...context,
              patientInfo: event.patientInfo
            }
          };
        }
      }
    },
    MakeVetAppointmentState: {
      invoke: {
        src: 'MakeAppointmentAction',
        input: ({ context }) => ({
          patientInfo: context.patientInfo!
        }),
        onDone: ({ context, event }) => {
          return {
            target: 'Idle',
            context: {
              ...context,
              appointmentInfo: event.output.appointmentInfo
            }
          };
        }
      }
    }
  }
});
