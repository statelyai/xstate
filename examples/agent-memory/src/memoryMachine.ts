import { setup, types, createAsyncLogic } from 'xstate';

export const log = (message: string) =>
  console.log(`${Date.now() % 100000} ${message}`);

export interface Message {
  role: 'user' | 'assistant';
  text: string;
}

/** How many messages may sit in the window before it is compacted. */
const WINDOW_LIMIT = 6;
/** How many of the oldest messages are folded into the summary each time. */
const COMPACT_COUNT = 4;

/** Mock completion call. Swap `run` for a real client call. */
const reply = createAsyncLogic({
  run: async ({
    input
  }: {
    input: { summary: string | null; messages: Message[] };
  }) => {
    await new Promise((resolve) => setTimeout(resolve, 80));
    const last = input.messages.at(-1)?.text ?? '';
    return { text: `re: ${last}` };
  }
});

/** Mock summarizer. A real one would send the messages to a cheap model. */
const summarize = createAsyncLogic({
  run: async ({
    input
  }: {
    input: { summary: string | null; messages: Message[] };
  }) => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const topics = input.messages
      .filter((message) => message.role === 'user')
      .map((message) => message.text)
      .join('; ');
    const summary = input.summary
      ? `${input.summary} | then: ${topics}`
      : `earlier: ${topics}`;
    return { summary };
  }
});

export const memoryMachine = setup({
  schemas: {
    context: types<{
      summary: string | null;
      messages: Message[];
      compactions: number;
    }>(),
    events: {
      userMessage: types<{ text: string }>(),
      endSession: types<{}>()
    }
  }
}).createMachine({
  context: { summary: null, messages: [], compactions: 0 },
  initial: 'chatting',
  states: {
    chatting: {
      on: {
        userMessage: ({ context, event }, enq) => {
          enq(log, `user: ${event.text}`);
          return {
            target: 'replying',
            context: {
              messages: [
                ...context.messages,
                { role: 'user' as const, text: event.text }
              ]
            }
          };
        },
        endSession: { target: 'ended' }
      }
    },
    replying: {
      invoke: {
        src: reply,
        input: ({ context }) => ({
          summary: context.summary,
          messages: context.messages
        }),
        onDone: ({ context, event }, enq) => {
          enq(log, `assistant: ${event.output.text}`);
          return {
            target: 'checkingWindow',
            context: {
              messages: [
                ...context.messages,
                { role: 'assistant' as const, text: event.output.text }
              ]
            }
          };
        }
      }
    },
    // The window check is a state, not an `if` buried in an action, so the
    // decision to compact is visible in the state chart.
    checkingWindow: {
      always: ({ context }, enq) => {
        if (context.messages.length <= WINDOW_LIMIT) {
          return { target: 'chatting' };
        }
        enq(
          log,
          `window at ${context.messages.length} messages: compacting oldest ${COMPACT_COUNT}`
        );
        return { target: 'summarizing' };
      }
    },
    summarizing: {
      invoke: {
        src: summarize,
        input: ({ context }) => ({
          summary: context.summary,
          messages: context.messages.slice(0, COMPACT_COUNT)
        }),
        // The compacted messages are replaced by the summary, so the window
        // shrinks while the conversation keeps its history.
        onDone: ({ context, event }, enq) => {
          const messages = context.messages.slice(COMPACT_COUNT);
          enq(
            log,
            `summary: ${event.output.summary} (window now ${messages.length})`
          );
          return {
            target: 'chatting',
            context: {
              summary: event.output.summary,
              messages,
              compactions: context.compactions + 1
            }
          };
        }
      },
      on: {
        // Messages that arrive during compaction are buffered by appending
        // them to the window; the summarizer only ever sees the slice it was
        // given as input.
        userMessage: ({ context, event }, enq) => {
          enq(log, `user (during compaction): ${event.text}`);
          return {
            context: {
              messages: [
                ...context.messages,
                { role: 'user' as const, text: event.text }
              ]
            }
          };
        }
      }
    },
    ended: {
      type: 'final',
      output: ({ context }) => ({
        compactions: context.compactions,
        summary: context.summary,
        window: context.messages.map((message) => message.text)
      })
    }
  }
});
