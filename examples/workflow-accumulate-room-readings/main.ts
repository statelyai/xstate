import { createActor } from 'xstate';
import { workflow, delay } from './workflow.ts';

const actor = createActor(workflow);
actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});
actor.start();
actor.send({
  type: 'TemperatureEvent',
  roomId: 'kitchen',
  temperature: 20
});
await delay(1000);
actor.send({
  type: 'HumidityEvent',
  roomId: 'kitchen',
  humidity: 50
});
await delay(11000);
actor.send({
  type: 'TemperatureEvent',
  roomId: 'kitchen',
  temperature: 10
});
await delay(1000);
actor.send({
  type: 'HumidityEvent',
  roomId: 'kitchen',
  humidity: 30
});
await delay(1000);
