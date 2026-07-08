import { createMachine, createAsyncLogic, createActor } from 'xstate';
import { z } from 'zod';
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
  actorSources: {
    MakeAppointmentAction: createAsyncLogic({
      schemas: {
        input: z.custom<{
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
        MakeVetAppointment: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'MakeVetAppointmentState',
            context: {
              ...context,
              patientInfo: (({ event }) => event.patientInfo)({
                context: context,
                event: event
              })
            }
          };
        }
      }
    },
    MakeVetAppointmentState: {
      invoke: {
        src: 'MakeAppointmentAction',
        input: ({ context }) => ({
          patientInfo: context.patientInfo
        }),
        onDone: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'Idle',
            context: {
              ...context,
              appointmentInfo: (({ event }) => event.output)({
                context: context,
                event: event
              })
            }
          };
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
