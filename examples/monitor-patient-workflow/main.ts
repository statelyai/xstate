#!/usr/bin/env vite-node --script
import { assign, createMachine, fromPromise, interpret } from 'xstate';

// id: patientVitalsWorkflow
// name: Monitor Patient Vitals
// version: '1.0.0'
// specVersion: '0.8'
// start: MonitorVitals
// events:
// - name: HighBodyTemperature
//   type: org.monitor.highBodyTemp
//   source: monitoringSource
//   correlation:
//   - contextAttributeName: patientId
// - name: HighBloodPressure
//   type: org.monitor.highBloodPressure
//   source: monitoringSource
//   correlation:
//   - contextAttributeName: patientId
// - name: HighRespirationRate
//   type: org.monitor.highRespirationRate
//   source: monitoringSource
//   correlation:
//   - contextAttributeName: patientId
// functions:
// - name: callPulmonologist
//   operation: http://myapis.org/patientapis.json#callPulmonologist
// - name: sendTylenolOrder
//   operation: http://myapis.org/patientapis.json#tylenolOrder
// - name: callNurse
//   operation: http://myapis.org/patientapis.json#callNurse
// states:
// - name: MonitorVitals
//   type: event
//   exclusive: true
//   onEvents:
//   - eventRefs:
//     - HighBodyTemperature
//     actions:
//     - functionRef:
//         refName: sendTylenolOrder
//         arguments:
//           patientid: "${ .patientId }"
//   - eventRefs:
//     - HighBloodPressure
//     actions:
//     - functionRef:
//         refName: callNurse
//         arguments:
//           patientid: "${ .patientId }"
//   - eventRefs:
//     - HighRespirationRate
//     actions:
//     - functionRef:
//         refName: callPulmonologist
//         arguments:
//           patientid: "${ .patientId }"
//   end:
//     terminate: true

// https://github.com/serverlessworkflow/specification/tree/main/examples#monitor-patient-vital-signs-example
export const workflow = createMachine(
  {
    id: 'patientVitalsWorkflow',
    types: {} as {
      context: {
        patientId: string;
      };
      events:
        | {
            type: 'org.monitor.highBodyTemp';
            source: 'monitoringSource';
            id: string;
            time: string;
            patientId: string;
            data: { value: string };
          }
        | {
            type: 'org.monitor.highBloodPressure';
            source: 'monitoringSource';
            id: string;
            time: string;
            patientId: string;
            data: { value: string };
          }
        | {
            type: 'org.monitor.highRespirationRate';
            source: 'monitoringSource';
            id: string;
            time: string;
            patientId: string;
            data: { value: string };
          };
    },
    context: ({ input }) => ({
      patientId: input.patientId
    }),
    initial: 'MonitorVitals',
    states: {
      MonitorVitals: {
        on: {
          'org.monitor.highBodyTemp': {
            actions: 'sendTylenolOrder'
          },
          'org.monitor.highBloodPressure': {
            actions: 'callNurse'
          },
          'org.monitor.highRespirationRate': {
            actions: 'callPulmonologist'
          }
        }
      }
    }
  },
  {
    actions: {
      sendTylenolOrder: ({ context }) => {
        console.log(
          'Executing sendTylenolOrder for patient:',
          context.patientId
        );
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
  }
);

const actor = interpret(workflow, {
  input: {
    patientId: 'patient1'
  }
});

actor.subscribe({
  next(state) {
    console.log('Received event', state.event);
  },
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();

setInterval(() => {
  // send an event at random
  const event = (
    [
      'org.monitor.highBodyTemp',
      'org.monitor.highBloodPressure',
      'org.monitor.highRespirationRate'
    ] as const
  )[Math.floor(Math.random() * 3)];

  actor.send({
    type: event,
    source: 'monitoringSource',
    id: 'event1',
    time: new Date().toISOString(),
    patientId: 'patient1',
    data: { value: 'value1' }
  });
}, 3000);
