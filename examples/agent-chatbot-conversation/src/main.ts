import { createActor, toPromise } from 'xstate';
import { conversationMachine, log } from './conversationMachine.ts';

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const actor = createActor(conversationMachine);

actor.subscribe((snapshot) => log(`state: ${JSON.stringify(snapshot.value)}`));

actor.start();

const script: Array<[number, string]> = [
  [100, 'What is a state machine?'],
  // Arrives while the agent is still delivering the previous reply: barge-in.
  [700, 'Actually, tell me about actors instead'],
  // Then the user goes quiet, and the inactivity timer ends the session.
  [1500, '']
];

void (async () => {
  for (const [delay, text] of script) {
    await wait(delay);
    if (text) {
      actor.send({ type: 'userMessage', text });
    }
  }
})();

log(`session: ${JSON.stringify(await toPromise(actor), null, 2)}`);
