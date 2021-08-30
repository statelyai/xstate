import { assign, createMachine } from 'xstate';

export interface DebounceMachineContext {
  action?: () => void;
}

export type DebounceMachineEvent = {
  type: 'GO';
  action: () => void;
};

const debounceMachine = createMachine<
  DebounceMachineContext,
  DebounceMachineEvent
>(
  {
    id: 'debounce',
    initial: 'idle',
    states: {
      idle: {
        on: {
          GO: {
            actions: 'assignActionToContext',
            target: 'debouncing'
          }
        }
      },
      debouncing: {
        on: {
          GO: {
            actions: 'assignActionToContext',
            target: 'debouncing'
          }
        },
        after: {
          2000: {
            target: 'idle',
            actions: 'performAction'
          }
        }
      }
    }
  },
  {
    actions: {
      clearAction: assign((context) => ({
        action: undefined
      })),
      assignActionToContext: assign((context, event) => {
        return {
          action: event.action
        };
      }),
      performAction: (context) => {
        return context.action?.();
      }
    }
  }
);

export default debounceMachine;
