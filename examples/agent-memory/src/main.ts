import { createActor, toPromise, waitFor } from 'xstate';
import { log, memoryMachine } from './memoryMachine.ts';

const actor = createActor(memoryMachine);

actor.subscribe((snapshot) =>
  log(
    `state: ${JSON.stringify(snapshot.value)} window: ${snapshot.context.messages.length}`
  )
);

actor.start();

const prompts = [
  'plan a trip to Lisbon',
  'how many days?',
  'what about food?',
  'any day trips?',
  'budget hotels?',
  'best month to go?',
  'do I need a car?'
];

void (async () => {
  for (const text of prompts) {
    // Wait for the agent to be idle again so each message lands in `chatting`.
    await waitFor(actor, (snapshot) => snapshot.matches('chatting'));
    actor.send({ type: 'userMessage', text });
  }
  await waitFor(actor, (snapshot) => snapshot.matches('chatting'));
  actor.send({ type: 'endSession' });
})();

log(`session: ${JSON.stringify(await toPromise(actor), null, 2)}`);
