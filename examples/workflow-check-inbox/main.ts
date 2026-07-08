import {
  createMachine,
  createCallbackLogic,
  createAsyncLogic,
  createActor
} from 'xstate';
import { z } from 'zod';
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
export const workflow = createMachine({
  types: {
    context: {} as {
      messages: Message[];
    }
  },
  actorSources: {
    schedule: createCallbackLogic<
      any,
      {
        interval: number;
      }
    >(({ input, sendBack }) => {
      const i = setInterval(() => {
        sendBack({ type: 'reminder' });
      }, input.interval);
      return () => {
        clearInterval(i);
      };
    }),
    checkInboxFunction: createAsyncLogic({
      run: async () => {
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
      }
    }),
    sendTextsFunction: createAsyncLogic({
      schemas: {
        input: z.custom<{
          messages: Message[];
        }>()
      },
      run: async ({ input }) => {
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
    })
  },
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
        onDone: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'SendTextForHighPriority',
            context: {
              ...context,
              messages: (({ event }) => event.output)({
                context: context,
                event: event
              })
            }
          };
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
