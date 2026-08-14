import { setup, types, createAsyncLogic } from 'xstate';

export const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

export interface Turn {
  role: 'user' | 'assistant';
  text: string;
}

/**
 * Stand-in for a chat completion call. Swap `run` for a real client call (the
 * `input` carries the transcript, the return value is the reply text) and the
 * machine is unchanged.
 */
const think = createAsyncLogic({
  run: async ({ input }: { input: { transcript: Turn[] } }) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const last = input.transcript.at(-1)?.text ?? '';
    return { reply: `Here is what I know about "${last}".` };
  }
});

/**
 * Delivers the reply. Interrupting the user leaves the `responding` state,
 * which stops this actor mid-delivery — no cancellation bookkeeping needed.
 */
const respond = createAsyncLogic({
  run: async ({ input }: { input: { reply: string } }) => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { spoken: input.reply };
  }
});

export const conversationMachine = setup({
  schemas: {
    context: types<{ transcript: Turn[]; pendingReply: string | null }>(),
    events: {
      userMessage: types<{ text: string }>()
    }
  },
  delays: {
    // How long the user may stay quiet before the session is closed.
    inactivity: 1200,
    // How long to wait after a message for the user to keep typing.
    endOfTurn: 200
  }
}).createMachine({
  context: { transcript: [], pendingReply: null },
  initial: 'idle',
  states: {
    idle: {
      on: {
        userMessage: ({ context, event }, enq) => {
          enq(log, `user: ${event.text}`);
          return {
            target: 'listening',
            context: {
              transcript: [
                ...context.transcript,
                { role: 'user' as const, text: event.text }
              ]
            }
          };
        }
      },
      after: { inactivity: { target: 'sessionEnded' } }
    },
    listening: {
      on: {
        // More typing from the same turn: append and restart the end-of-turn
        // timer by re-entering `listening`.
        userMessage: ({ context, event }, enq) => {
          enq(log, `user (continued): ${event.text}`);
          return {
            target: 'listening',
            context: {
              transcript: [
                ...context.transcript,
                { role: 'user' as const, text: event.text }
              ]
            }
          };
        }
      },
      after: { endOfTurn: { target: 'thinking' } }
    },
    thinking: {
      entry: (_, enq) => enq(log, 'agent is thinking...'),
      invoke: {
        src: think,
        input: ({ context }) => ({ transcript: context.transcript }),
        onDone: ({ event }) => ({
          target: 'responding',
          context: { pendingReply: event.output.reply }
        })
      },
      on: {
        // Barge-in before the reply exists: throw the plan away.
        userMessage: ({ context, event }, enq) => {
          enq(log, `barge-in while thinking: ${event.text}`);
          return {
            target: 'listening',
            context: {
              transcript: [
                ...context.transcript,
                { role: 'user' as const, text: event.text }
              ],
              pendingReply: null
            }
          };
        }
      }
    },
    responding: {
      entry: ({ context }, enq) =>
        enq(log, `agent starts responding: ${context.pendingReply}`),
      invoke: {
        src: respond,
        input: ({ context }) => ({ reply: context.pendingReply! }),
        onDone: ({ context, event }, enq) => {
          enq(log, `agent finished: ${event.output.spoken}`);
          return {
            target: 'idle',
            context: {
              transcript: [
                ...context.transcript,
                { role: 'assistant' as const, text: event.output.spoken }
              ],
              pendingReply: null
            }
          };
        }
      },
      on: {
        // Barge-in mid-delivery: the partial reply is recorded as such and the
        // invoked `respond` actor is stopped by leaving this state.
        userMessage: ({ context, event }, enq) => {
          enq(log, `barge-in while responding: ${event.text}`);
          return {
            target: 'listening',
            context: {
              transcript: [
                ...context.transcript,
                { role: 'assistant' as const, text: '(interrupted)' },
                { role: 'user' as const, text: event.text }
              ],
              pendingReply: null
            }
          };
        }
      }
    },
    sessionEnded: {
      type: 'final',
      output: ({ context }) => ({
        turns: context.transcript.length,
        transcript: context.transcript
      })
    }
  }
});
