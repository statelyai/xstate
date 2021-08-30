import { assign, createMachine } from 'xstate';

export interface ConfirmationDialogMachineContext {
  action?: () => Promise<void>;
  errorMessage?: string;
}

type ConfirmationDialogMachineEvent =
  | {
      type: 'OPEN_DIALOG';
      action: () => Promise<void>;
    }
  | {
      type: 'CONFIRM';
    }
  | {
      type: 'CANCEL';
    };

const confirmationDialogMachine = createMachine<
  ConfirmationDialogMachineContext,
  ConfirmationDialogMachineEvent
>(
  {
    id: 'confirmationDialog',
    initial: 'closed',
    states: {
      closed: {
        id: 'closed',
        on: {
          OPEN_DIALOG: {
            target: 'open',
            actions: 'assignActionToContext'
          }
        }
      },
      open: {
        exit: 'clearErrorMessage',
        initial: 'idle',
        states: {
          idle: {
            on: {
              CANCEL: { target: '#closed' },
              CONFIRM: { target: 'executingAction' }
            }
          },
          executingAction: {
            invoke: {
              src: 'executeAction',
              onError: {
                target: 'idle',
                actions: 'assignErrorMessageToContext'
              },
              onDone: {
                target: '#closed',
                actions: ['clearActionFromContext', 'onSuccess']
              }
            }
          }
        }
      }
    }
  },
  {
    services: {
      executeAction: (context) => () => {
        // For demonstration purposes, I've commented this out.
        // await context.action()
      }
    },
    actions: {
      assignActionToContext: assign((context, event) => {
        if (event.type !== 'OPEN_DIALOG') return {};
        return {
          action: event.action
        };
      }),
      assignErrorMessageToContext: assign((context, event: any) => {
        return {
          errorMessage: event.data?.message || 'An unknown error occurred'
        };
      }),
      clearErrorMessage: assign((context) => ({
        errorMessage: undefined
      })),
      clearActionFromContext: assign((context) => ({
        action: undefined
      })),
      onSuccess: () => {
        alert('onSuccess fired!');
      }
    }
  }
);

export default confirmationDialogMachine;
