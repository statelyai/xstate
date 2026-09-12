import { types, createMachine } from 'xstate';

// https://github.com/serverlessworkflow/specification/tree/main/examples#monitor-patient-vital-signs-example
export const workflow = createMachine({
  id: 'patientVitalsWorkflow',
  schemas: {
    input: types<{
      patientId: string;
    }>(),
    context: types<{
      patientId: string;
    }>(),
    events: {
      'org.monitor.highBodyTemp': types<{
        type: 'org.monitor.highBodyTemp';
        source: 'monitoringSource';
        id: string;
        time: string;
        patientId: string;
        data: { value: string };
      }>(),
      'org.monitor.highBloodPressure': types<{
        type: 'org.monitor.highBloodPressure';
        source: 'monitoringSource';
        id: string;
        time: string;
        patientId: string;
        data: { value: string };
      }>(),
      'org.monitor.highRespirationRate': types<{
        type: 'org.monitor.highRespirationRate';
        source: 'monitoringSource';
        id: string;
        time: string;
        patientId: string;
        data: { value: string };
      }>()
    }
  },
  context: ({ input }) => ({
    patientId: input.patientId
  }),
  initial: 'MonitorVitals',
  states: {
    MonitorVitals: {
      on: {
        'org.monitor.highBodyTemp': ({ context, actions }, enq) => {
          enq(actions['sendTylenolOrder'], { context });
        },
        'org.monitor.highBloodPressure': ({ context, actions }, enq) => {
          enq(actions['callNurse'], { context });
        },
        'org.monitor.highRespirationRate': ({ context, actions }, enq) => {
          enq(actions['callPulmonologist'], { context });
        }
      }
    }
  },
  actions: {
    sendTylenolOrder: ({ context }) => {
      console.log('Executing sendTylenolOrder for patient:', context.patientId);
    },
    callNurse: ({ context }) => {
      console.log('Executing callNurse for patient:', context.patientId);
    },
    callPulmonologist: ({ context }) => {
      console.log(
        'Executing callPulmonologist for patient:',
        context.patientId
      );
    }
  }
});
