import { assign, createMachine, Sender } from 'xstate';

export interface InfiniteScrollMachineContext {
  data: Data[];
  totalEntries: number;
  errorMessage?: string;
}

interface Data {
  id: number;
}

export type InfiniteScrollMachineEvent =
  | {
      type: 'SCROLL_TO_BOTTOM';
    }
  | {
      type: 'RECEIVED_DATA';
      data: Data[];
      totalEntries: number;
    };

const infiniteScrollMachine = createMachine<
  InfiniteScrollMachineContext,
  InfiniteScrollMachineEvent
>(
  {
    id: 'infiniteScroll',
    initial: 'fetchingRowOfData',
    context: {
      totalEntries: Infinity,
      data: []
    },
    states: {
      fetchingRowOfData: {
        on: {
          RECEIVED_DATA: {
            target: 'checkingIfThereIsMoreData',
            actions: 'assignDataToContext'
          }
        },
        invoke: {
          src: 'fetchRowOfData',
          onError: {
            target: 'idle',
            actions: 'assignErrorMessageToContext'
          }
        }
      },
      idle: {
        exit: 'clearErrorMessage',
        on: {
          SCROLL_TO_BOTTOM: { target: 'fetchingRowOfData' }
        }
      },
      checkingIfThereIsMoreData: {
        always: [
          {
            cond: 'thereIsMoreData',
            target: 'idle'
          },
          {
            target: 'noMoreDataToFetch'
          }
        ]
      },
      noMoreDataToFetch: {
        type: 'final'
      }
    }
  },
  {
    guards: {
      thereIsMoreData: (context) => {
        return context.totalEntries > context.data.length;
      }
    },
    services: {
      fetchRowOfData: () => (send: Sender<InfiniteScrollMachineEvent>) => {}
    },
    actions: {
      assignDataToContext: assign((context, event) => {
        if (event.type !== 'RECEIVED_DATA') return {};
        return {
          data: [...context.data, ...event.data],
          totalEntries: event.totalEntries
        };
      }),
      clearErrorMessage: assign((context) => ({
        errorMessage: undefined
      })),
      assignErrorMessageToContext: assign((context, event: any) => {
        return {
          errorMessage: event.data?.message || 'An unknown error occurred'
        };
      })
    }
  }
);

export default infiniteScrollMachine;
