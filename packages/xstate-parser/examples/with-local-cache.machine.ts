import { assign, createMachine } from 'xstate';

export interface WithLocalCacheMachineContext {
  cache: Cache;
  errorMessage?: string;
  currentVariablesBeingProcessed?: Variables;
}

type Cache = Record<string, Data>;

interface Variables {
  id: string;
}

interface Data {
  name: string;
}

export type WithLocalCacheMachineEvent =
  | {
      type: 'FETCH';
      variables: Variables;
    }
  | {
      type: 'RECEIVE_DATA';
      data: Data;
    }
  | {
      type: 'CANCEL';
    };

const withLocalCacheMachine = createMachine<
  WithLocalCacheMachineContext,
  WithLocalCacheMachineEvent
>(
  {
    id: 'simpleDataFetch',
    initial: 'idle',
    context: {
      cache: {}
    },
    states: {
      idle: {
        on: {
          FETCH: [
            {
              cond: 'itemIsAlreadyInCache',
              target: 'idle'
            },
            {
              target: 'fetching',
              actions: 'assignVariablesToContext'
            }
          ]
        },
        initial: 'noError',
        states: {
          noError: {
            entry: 'clearErrorMessage'
          },
          errored: {}
        }
      },
      fetching: {
        on: {
          FETCH: [
            {
              cond: 'itemIsAlreadyInCache',
              target: 'idle'
            },
            {
              target: 'fetching',
              actions: 'assignVariablesToContext'
            }
          ],
          CANCEL: {
            target: 'idle'
          },
          RECEIVE_DATA: {
            target: 'idle',
            actions: 'assignDataToContext'
          }
        },
        invoke: {
          src: 'fetchData',
          onError: {
            target: 'idle.errored',
            actions: 'assignErrorToContext'
          }
        }
      }
    }
  },
  {
    guards: {
      itemIsAlreadyInCache: (context, event) => {
        if (event.type !== 'FETCH') return false;

        return Boolean(context.cache[JSON.stringify(event.variables)]);
      }
    },
    services: {
      fetchData: () => () => {}
    },
    actions: {
      assignVariablesToContext: assign((context, event) => {
        if (event.type !== 'FETCH') return {};
        return {
          currentVariablesBeingProcessed: event.variables
        };
      }),
      assignDataToContext: assign((context, event) => {
        if (event.type !== 'RECEIVE_DATA') return {};
        return {
          cache: {
            ...context.cache,
            [JSON.stringify(context.currentVariablesBeingProcessed)]: event.data
          }
        };
      }),
      clearErrorMessage: assign((context) => ({
        errorMessage: undefined
      })),
      assignErrorToContext: assign((context, event: any) => {
        return {
          errorMessage: event.data?.message || 'An unknown error occurred'
        };
      })
    }
  }
);

export default withLocalCacheMachine;
