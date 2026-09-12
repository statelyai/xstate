import { createActor } from 'xstate';
import { workflow } from './workflow.ts';

const actor = createActor(workflow, {
  input: {
    patientId: 'patient1'
  }
});

actor.subscribe({
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
