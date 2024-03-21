import { assign, createMachine, fromPromise } from 'xstate';
import OpenAI from 'openai';

const openai = new OpenAI({
  organization: process.env.OPENAI_ORGANIZATION,
  apiKey: process.env.OPENAI_API_KEY
});

const createChatCompletion = fromPromise(
  ({
    input
  }: {
    input: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
  }) => openai.chat.completions.create(input)
);

const createSlackPost = fromPromise(
  async ({
    input
  }: {
    input: {
      channel: string;
    };
  }) => {
    // TODO: add Slack integration here
  }
);

export const machine = createMachine({
  id: 'openai-summarizer',
  types: {
    input: {} as {
      text: string;
    },
    context: {} as {
      text: string;
      summary: string | null;
    },
    actors: {} as
      | {
          src: 'OpenAI.createChatCompletion';
          logic: typeof createChatCompletion;
        }
      | {
          src: 'Slack.postMessage';
          logic: typeof createSlackPost;
        }
  },
  context: ({ input }) => ({
    text: input.text,
    summary: null
  }),
  initial: 'Generating summary',
  states: {
    'Generating summary': {
      invoke: {
        src: 'OpenAI.createChatCompletion',
        input: ({ context }) => ({
          model: 'gpt-3.5-turbo-16k',
          messages: [
            {
              role: 'user',
              content: `Summarize the following text with the most unique and helpful points, into a numbered list of key points and takeaways: \n ${context.text}`
            }
          ]
        }),
        onDone: {
          target: 'Posting to Slack',
          actions: assign({
            summary: ({ event }) => event.output.choices[0].message.content
          })
        },
        onError: {
          target: 'error'
        }
      }
    },
    'Posting to Slack': {
      invoke: {
        src: 'Slack.postMessage',
        input: ({ context }) => ({
          channel: '<channel ID>',
          text: context.summary
        })
      },
      onDone: { target: 'final' }
    },
    error: {
      // ...
    },
    done: {
      type: 'final'
    }
  }
});
