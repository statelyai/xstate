import { createActor } from 'xstate';
import { workflow } from './workflow.ts';

const actor = createActor(workflow, {
  input: {
    applicantId: '123'
  }
});
actor.subscribe({
  next(state) {
    console.log(state.value);
  },
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});
actor.start();
// delay 1000
await new Promise((resolve) => setTimeout(resolve, 1000));
actor.send({
  type: 'ApplicationSubmitted'
});
// delay 1000
await new Promise((resolve) => setTimeout(resolve, 1000));
actor.send({
  type: 'SATScoresReceived'
});
// delay 1000
await new Promise((resolve) => setTimeout(resolve, 1000));
actor.send({
  type: 'RecommendationLetterReceived'
});
