import { createActor, setup, toPromise, types } from 'xstate';
import { createInspector } from '@statelyai/sdk';

const inspector = process.env.INSPECT ? createInspector() : undefined;

const log = (message: string) => console.log(message);

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

type Intent = 'billing' | 'support' | 'human' | 'unknown';

/** Mock ASR + intent classifier over a scripted utterance. */
const classify = (utterance: string): Intent => {
  const text = utterance.toLowerCase();
  if (text.includes('agent') || text.includes('human')) return 'human';
  if (text.includes('bill') || text.includes('charge')) return 'billing';
  if (text.includes('broken') || text.includes('reset')) return 'support';
  return 'unknown';
};

const callMachine = setup({
  schemas: {
    context: types<{
      caller: string;
      intent: Intent;
      transcript: string[];
      resolution: string;
    }>(),
    events: {
      answered: types<{}>(),
      // Emitted while the agent is speaking: the caller talks over it.
      utterance: types<{ text: string }>(),
      hangup: types<{}>()
    },
    input: types<{ caller: string }>(),
    output: types<{ intent: Intent; resolution: string; turns: number }>()
  },
  delays: { speechDuration: 300, holdMusic: 1200 }
}).createMachine({
  context: ({ input }) => ({
    caller: input.caller,
    intent: 'unknown',
    transcript: [],
    resolution: 'incomplete'
  }),
  // The caller can hang up at any point in the call, so the handler lives on
  // the root rather than being repeated in every state.
  on: {
    hangup: (_, enq) => {
      enq(log, 'caller hung up');
      return { target: '.ended' };
    }
  },
  initial: 'ringing',
  states: {
    ringing: {
      entry: (_, enq) => enq(log, 'ringing…'),
      on: { answered: { target: 'greeting' } }
    },
    greeting: {
      entry: ({ context }, enq) =>
        enq(log, `agent: hello ${context.caller}, how can I help?`),
      after: { speechDuration: { target: 'listening' } }
    },
    // The listening ↔ speaking pair is the barge-in mechanism: an utterance
    // received while speaking cuts the agent off and routes immediately.
    listening: {
      entry: (_, enq) => enq(log, '[listening]'),
      on: {
        utterance: ({ context, event }, enq) => {
          const intent = classify(event.text);
          enq(log, `caller: ${event.text}  → intent: ${intent}`);
          const transcript = [...context.transcript, event.text];
          if (intent === 'human') {
            return {
              target: 'transferring',
              context: {
                intent,
                transcript,
                resolution: 'waiting for a human'
              }
            };
          }
          if (intent === 'unknown') {
            return { target: 'clarifying', context: { intent, transcript } };
          }
          return {
            target: intent === 'billing' ? 'billing' : 'support',
            context: { intent, transcript }
          };
        }
      }
    },
    clarifying: {
      entry: (_, enq) => enq(log, 'agent: sorry, could you rephrase that?'),
      on: {
        // Barge-in: the caller interrupts mid-sentence and we re-route
        // immediately rather than waiting for the prompt to finish.
        utterance: ({ context, event }, enq) => {
          enq(log, `caller (barge-in): ${event.text}`);
          const intent = classify(event.text);
          const transcript = [...context.transcript, event.text];
          return intent === 'billing'
            ? { target: 'billing', context: { intent, transcript } }
            : { target: 'support', context: { intent, transcript } };
        }
      },
      // If nobody interrupts, the agent stops talking and listens again.
      after: { holdMusic: { target: 'listening' } }
    },
    billing: {
      entry: (_, enq) => enq(log, 'agent: your last charge was $42 on the 3rd'),
      after: {
        speechDuration: {
          target: 'ended',
          context: { resolution: 'billing question answered' }
        }
      }
    },
    support: {
      entry: (_, enq) => enq(log, 'agent: I have queued a device reset'),
      after: {
        speechDuration: {
          target: 'ended',
          context: { resolution: 'reset scheduled' }
        }
      }
    },
    // Hold music plays until a human picks up — or until the caller gives up
    // and hangs up, which the root handler catches.
    transferring: {
      entry: (_, enq) => enq(log, 'agent: transferring you to a human…'),
      after: {
        holdMusic: {
          target: 'ended',
          context: { resolution: 'human agent joined' }
        }
      }
    },
    ended: {
      type: 'final',
      entry: (_, enq) => enq(log, 'call ended'),
      output: ({ context }) => ({
        intent: context.intent,
        resolution: context.resolution,
        turns: context.transcript.length
      })
    }
  }
});

type CallEvent =
  | { type: 'answered' }
  | { type: 'utterance'; text: string }
  | { type: 'hangup' };

/** Plays a scripted caller against the machine, one event every 150ms. */
async function runCall(caller: string, script: CallEvent[]) {
  log(`\n=== call from ${caller}`);
  const actor = createActor(callMachine, {
    input: { caller },
    inspect: inspector?.inspect
  });
  actor.start();
  for (const event of script) {
    await wait(400);
    if (actor.getSnapshot().status === 'active') {
      actor.send(event);
    }
  }
  log(`result: ${JSON.stringify(await toPromise(actor))}`);
}

await runCall('Ada', [
  { type: 'answered' },
  { type: 'utterance', text: 'I have a question about my bill' }
]);

// Barge-in: the caller talks over the clarification prompt.
await runCall('Grace', [
  { type: 'answered' },
  { type: 'utterance', text: 'uhh, hello?' },
  { type: 'utterance', text: 'my router is broken' }
]);

// Hangup from a non-terminal state, handled by the root `on`.
await runCall('Alan', [
  { type: 'answered' },
  { type: 'utterance', text: 'get me an agent' },
  { type: 'hangup' }
]);

inspector?.destroy();
