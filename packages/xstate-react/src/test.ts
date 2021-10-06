import { assign, createMachine } from 'xstate';
import { useMachine } from './useMachine';

const machine = createMachine<
  { errorMessage?: string; idLoading: string },
  | { type: 'ADD_LIKE'; id: string }
  | {
      type: 'REMOVE_LIKE';
      id: string;
    }
  | {
      type: 'done.invoke.removeLike';
      data: {
        something: boolean;
      };
    },
  any,
  import('./test.typegen').Typegen0
>({
  tsTypes: true,
  initial: 'idle',
  context: {
    idLoading: ''
  },
  states: {
    idle: {
      entry: [assign({ idLoading: '' })],
      on: {
        ADD_LIKE: {
          actions: [
            assign({
              idLoading: (c, e) => e.id
            })
          ],
          target: 'addPending'
        },
        REMOVE_LIKE: {
          actions: [
            assign({
              idLoading: (c, e) => e.id
            })
          ],
          target: 'removePending'
        }
      }
    },
    waitingForRefetch: {
      tags: ['loading'],
      entry: ['refetch'],
      after: {
        500: 'idle'
      }
    },
    addPending: {
      tags: ['loading'],
      invoke: {
        src: 'addLike',
        onDone: {
          target: 'waitingForRefetch'
        },
        onError: {
          target: 'idle',
          actions: 'showAddErrorMessage'
        }
      }
    },
    removePending: {
      tags: ['loading'],
      invoke: {
        src: 'removeLike',
        onDone: {
          target: 'waitingForRefetch',
          actions: 'logToConsole'
        },
        onError: {
          target: 'idle',
          actions: 'showRemoveErrorMessage'
        }
      }
    }
  }
});

const useTest = () => {
  const [] = useMachine(machine, {
    services: {
      removeLike: async () => {
        return {
          something: true
        };
      },
      addLike: async () => {}
    },
    actions: {
      logToConsole: (context, event) => {}
    }
  });
};
