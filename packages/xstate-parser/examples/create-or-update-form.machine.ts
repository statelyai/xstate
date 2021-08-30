import { assign, createMachine, Sender } from 'xstate';

export interface CreateOrUpdateFormMachineContext {
  isInEditMode: boolean;
  errorMessage?: string;
  itemToProcess?: Item;
}

interface Item {
  name: string;
}

export type CreateOrUpdateFormMachineEvent =
  | {
      type: 'SUBMIT';
      item: Item;
    }
  | {
      type: 'SUCCESSFULLY_FETCHED_ITEM';
      item: Item;
    }
  | {
      type: 'RETRY';
    };

const createOrUpdateFormMachine = createMachine<
  CreateOrUpdateFormMachineContext,
  CreateOrUpdateFormMachineEvent
>(
  {
    id: 'createOrUpdateForm',
    initial: 'checkingIfInEditMode',
    context: {
      // Randomly true or false
      isInEditMode: Math.random() < 0.5
    },
    states: {
      checkingIfInEditMode: {
        always: [
          {
            cond: 'isInEditMode',
            target: 'fetchingItemToEdit'
          },
          {
            target: 'awaitingSubmit'
          }
        ]
      },
      fetchingItemToEdit: {
        invoke: {
          src: 'fetchItem',
          onError: {
            target: 'failedToFetch',
            actions: 'assignErrorMessageToContext'
          }
        },
        on: {
          SUCCESSFULLY_FETCHED_ITEM: {
            target: 'awaitingSubmit',
            actions: 'assignItemToContext'
          }
        }
      },
      failedToFetch: {
        exit: 'clearErrorMessage',
        on: {
          RETRY: { target: 'fetchingItemToEdit' }
        }
      },
      awaitingSubmit: {
        id: 'awaitingSubmit',
        exit: 'clearErrorMessage',
        on: {
          SUBMIT: {
            target: 'submitting',
            actions: 'assignItemToContext'
          }
        }
      },
      submitting: {
        initial: 'checkingIfInEditMode',
        states: {
          checkingIfInEditMode: {
            always: [
              {
                cond: 'isInEditMode',
                target: 'editing'
              },
              {
                target: 'creating'
              }
            ]
          },
          editing: {
            invoke: {
              src: 'editItem',
              onDone: { target: '#complete', actions: 'onEditSuccess' },
              onError: {
                target: '#awaitingSubmit',
                actions: 'assignErrorMessageToContext'
              }
            }
          },
          creating: {
            invoke: {
              src: 'createItem',
              onDone: { target: '#complete', actions: 'onCreateSuccess' },
              onError: {
                target: '#awaitingSubmit',
                actions: 'assignErrorMessageToContext'
              }
            }
          }
        }
      },
      complete: {
        id: 'complete',
        type: 'final'
      }
    }
  },
  {
    guards: {
      isInEditMode: (context) => {
        return context.isInEditMode;
      }
    },
    services: {
      fetchItem: () => async (send: Sender<CreateOrUpdateFormMachineEvent>) => {
        // send({
        //   type: "SUCCESSFULLY_FETCHED_ITEM",
        //   item: {
        //     name: "Matt Pocock",
        //   },
        // });
      },
      editItem: () => () => {},
      createItem: () => () => {}
    },
    actions: {
      onCreateSuccess: () => {
        alert('onCreateSuccess');
      },
      onEditSuccess: () => {
        alert('onEditSuccess');
      },
      clearErrorMessage: assign((context) => ({
        errorMessage: undefined
      })),
      assignErrorMessageToContext: assign((context, event: any) => {
        return {
          errorMessage: event.data?.message || 'An unknown error occurred'
        };
      }),
      assignItemToContext: assign((context, event) => {
        if (
          event.type !== 'SUCCESSFULLY_FETCHED_ITEM' &&
          event.type !== 'SUBMIT'
        )
          return {};
        return {
          itemToProcess: event.item
        };
      })
    }
  }
);

export default createOrUpdateFormMachine;
