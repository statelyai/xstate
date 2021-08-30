import { assign, createMachine } from 'xstate';

export interface QueueMachineContext {
  queue: QueueItemWithTime[];
}

interface QueueItem {
  action: 'ALERT_BROWSER_AFTER_PAUSE' | 'FAIL_AFTER_PAUSE';
}

interface QueueItemWithTime extends QueueItem {
  timeAdded: string;
}

export type QueueMachineEvent =
  | {
      type: 'ADD_TO_QUEUE';
      items: QueueItem[];
    }
  | {
      type: 'RETRY';
    }
  | {
      type: 'CLEAR_QUEUE';
    };

const queueMachine = createMachine<QueueMachineContext, QueueMachineEvent>(
  {
    id: 'queue',
    /**
     * Check initially if we should execute items in the queue
     */
    initial: 'checkingIfThereAreMoreItems',
    context: {
      queue: []
    },
    on: {
      CLEAR_QUEUE: {
        target: 'idle',
        actions: 'clearQueue'
      }
    },
    states: {
      idle: {
        on: {
          ADD_TO_QUEUE: {
            actions: 'addItemToQueue',
            target: 'executingItem'
          }
        }
      },
      executingItem: {
        on: {
          ADD_TO_QUEUE: {
            actions: 'addItemToQueue'
          }
        },
        invoke: {
          src: 'executeOldestItemInQueue',
          onDone: {
            target: 'checkingIfThereAreMoreItems',
            actions: 'removeOldestItemFromQueue'
          },
          onError: {
            target: 'awaitingRetry'
          }
        }
      },
      awaitingRetry: {
        on: {
          ADD_TO_QUEUE: {
            actions: 'addItemToQueue',
            target: 'executingItem'
          },
          RETRY: { target: 'executingItem' }
        }
      },
      checkingIfThereAreMoreItems: {
        on: {
          ADD_TO_QUEUE: {
            actions: 'addItemToQueue'
          }
        },
        always: [
          {
            cond: 'thereAreMoreItemsInTheQueue',
            target: 'executingItem'
          },
          {
            target: 'idle'
          }
        ]
      }
    }
  },
  {
    guards: {
      thereAreMoreItemsInTheQueue: (context) => {
        return context.queue.length > 0;
      }
    },
    services: {
      executeOldestItemInQueue: async (context) => {
        const oldestItem = context.queue[0];

        if (!oldestItem) return;

        switch (oldestItem.action) {
          case 'ALERT_BROWSER_AFTER_PAUSE': {
            await wait(2000);
            alert('Alert from ALERT_BROWSER_AFTER_PAUSE');
            break;
          }
          case 'FAIL_AFTER_PAUSE': {
            await wait(2000);
            throw new Error('Something went wrong!');
          }
        }
      }
    },
    actions: {
      clearQueue: assign((context) => ({
        queue: []
      })),
      addItemToQueue: assign((context, event) => {
        if (event.type !== 'ADD_TO_QUEUE') return {};
        return {
          queue: [
            ...context.queue,
            ...(event.items?.map((item) => ({
              ...item,
              timeAdded: new Date().toISOString()
            })) || [])
          ]
        };
      }),
      removeOldestItemFromQueue: assign((context) => {
        const [, ...newQueue] = context.queue;
        return {
          queue: newQueue
        };
      })
    }
  }
);

export default queueMachine;

// Utility function for awaiting
const wait = (interval: number) =>
  new Promise((resolve) => setTimeout(resolve, interval));
