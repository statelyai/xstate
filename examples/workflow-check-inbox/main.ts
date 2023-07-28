import {
  assign,
  createMachine,
  fromCallback,
  fromPromise,
  interpret,
  waitFor
} from 'xstate';

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
}

// https://github.com/serverlessworkflow/specification/tree/main/examples#check-inbox-periodically
export const workflow = createMachine(
  {
    id: 'checkInbox',
    initial: 'Idle',
    context: {
      messages: null
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
  },
  {
    actors: {
      schedule: fromCallback(({ input, sendBack }) => {
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
        ];
      }),
      sendTextsFunction: fromPromise(async ({ input }) => {
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
      })
    }
  }
);

const actor = interpret(workflow);

actor.subscribe({
  complete() {
    console.log('workflow completed', actor.getSnapshot().output);
  }
});

actor.start();
