import { assign, fromCallback, fromPromise, createActor, setup } from 'xstate';

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

interface Message {
  subject: string;
  priority: 'high' | 'low';
}

// https://github.com/serverlessworkflow/specification/tree/main/examples#check-inbox-periodically
export const workflow = setup({
  types: {
    context: {} as {
      messages: Message[];
    }
  },
  actors: {
    schedule: fromCallback<any, { interval: number }>(({ input, sendBack }) => {
      const i = setInterval(() => {
        sendBack({ type: 'reminder' });
      }, input.interval);

      return () => {
        clearInterval(i);
      };
    }),
    checkInboxFunction: fromPromise(async () => {
      await delay(1000);

      return [
        {
          subject: 'Hello',
          priority: 'high'
        },
        {
          subject: 'Hi',
          priority: 'low'
        }
      ] satisfies Message[];
    }),
    sendTextsFunction: fromPromise(
      async ({ input }: { input: { messages: Message[] } }) => {
        await Promise.all(
          input.messages.map(async (message) => {
            console.log('sending text', message.subject);
            if (message.priority === 'high') {
              await delay(100);
            } else {
              await delay(500);
            }
            console.log('text sent', message.subject);
          })
        );

        return {
          status: 'success'
        };
      }
    )
  }
}).createMachine({
  id: 'checkInbox',
  initial: 'Idle',
  context: {
    messages: []
  },
  invoke: {
    src: 'schedule',
    input: {
      interval: 2000
    }
  },
  states: {
    Idle: {
      on: {
        reminder: 'CheckInbox'
      }
    },
    CheckInbox: {
      invoke: {
        src: 'checkInboxFunction',
        onDone: {
          target: 'SendTextForHighPriority',
          actions: assign({
            messages: ({ event }) => event.output
          })
        }
      }
    },
    SendTextForHighPriority: {
      invoke: {
        src: 'sendTextsFunction',
        input: ({ context }) => ({
          messages: context.messages
        }),
        onDone: {
          target: 'Idle'
        }
      }
    }
  }
});

const actor = createActor(workflow);

actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();
