import {
  AnyStoreConfig,
  AnyStoreLogic,
  EmitsFromStoreConfig,
  EventObject,
  EventPayloadMap,
  ExtractEvents,
  StoreConfig,
  StoreContext,
  StoreLogic,
  StoreSnapshot
} from './types';
import { storeConfigToLogic } from './utils';

type UndoEvent<TEvent extends EventObject> = {
  event: TEvent;
  transactionId?: string;
};

/**
 * Creates store logic with undo/redo functionality.
 *
 * It maintains an event history and allows reverting to previous states by
 * replaying events from the beginning up to a certain point.
 *
 * @example
 *
 * ```ts
 * // Basic usage - each event is its own transaction
 * const store = createStore(
 *   undoRedo({
 *     context: { count: 0 },
 *     on: {
 *       inc: (ctx) => ({ count: ctx.count + 1 }),
 *       dec: (ctx) => ({ count: ctx.count - 1 })
 *     }
 *   })
 * );
 *
 * store.trigger.inc(); // count = 1
 * store.trigger.inc(); // count = 2
 * store.trigger.undo(); // count = 1 (undoes last inc)
 * store.trigger.redo(); // count = 2 (redoes the inc)
 * ```
 *
 * @example
 *
 * ```ts
 * // Grouped events by transaction ID
 * const store = createStore(
 *   undoRedo(
 *     {
 *       context: { count: 0 },
 *       on: {
 *         inc: (ctx) => ({ count: ctx.count + 1 }),
 *         dec: (ctx) => ({ count: ctx.count - 1 })
 *       }
 *     },
 *     {
 *       getTransactionId: (event) => event.type
 *     }
 *   )
 * );
 *
 * store.send({ type: 'inc' }); // count = 1 (1st transaction)
 * store.send({ type: 'inc' }); // count = 2 (1st transaction)
 * store.send({ type: 'dec' }); // count = 1 (2nd transaction)
 * store.send({ type: 'dec' }); // count = 0 (2nd transaction)
 *
 * store.trigger.undo(); // count = 1 (undoes both dec events)
 * store.trigger.undo(); // count = 0 (undoes both inc events)
 * ```
 *
 * @returns Store logic with additional `undo` and `redo` event handlers
 */
export function undoRedo<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap
>(
  storeConfig: StoreConfig<TContext, TEventPayloadMap, TEmittedPayloadMap>,
  options?: {
    getTransactionId?: (event: ExtractEvents<TEventPayloadMap>) => string;
  }
): StoreLogic<
  StoreSnapshot<TContext>,
  ExtractEvents<TEventPayloadMap> | { type: 'undo' } | { type: 'redo' },
  EmitsFromStoreConfig<any>
>;
export function undoRedo<
  TContext extends StoreContext,
  TEvent extends EventObject
>(
  storeLogic: StoreLogic<
    StoreSnapshot<TContext>,
    TEvent,
    EmitsFromStoreConfig<any>
  >,
  options?: {
    getTransactionId?: (event: TEvent) => string;
  }
): StoreLogic<
  StoreSnapshot<TContext>,
  TEvent | { type: 'undo' } | { type: 'redo' },
  EmitsFromStoreConfig<any>
>;
export function undoRedo(
  storeConfigOrLogic: AnyStoreConfig | AnyStoreLogic,
  options?: {
    getTransactionId?: (event: any) => string;
  }
): AnyStoreLogic {
  const logic =
    'transition' in storeConfigOrLogic
      ? storeConfigOrLogic
      : storeConfigToLogic(storeConfigOrLogic);

  const enhancedLogic: AnyStoreLogic = {
    getInitialSnapshot: () => ({
      status: 'active',
      context: logic.getInitialSnapshot().context,
      output: undefined,
      error: undefined,
      events: [],
      undoStack: []
    }),
    transition: (snapshot, event) => {
      if (event.type === 'undo') {
        const events = snapshot.events.slice();
        const undoStack = snapshot.undoStack.slice();
        if (!events.length) {
          return [
            {
              ...snapshot,
              events,
              undoStack
            },
            []
          ];
        }

        // Get the transaction ID of the last event
        const lastTransactionId = events[events.length - 1].transactionId;

        // Remove all events with the same transaction ID
        // If transactionId is undefined, only remove the last event
        const eventsToUndo: UndoEvent<EventObject>[] = [];
        if (lastTransactionId === undefined) {
          // When no transaction ID is provided, each event is its own transaction
          const event = events.pop()!;
          eventsToUndo.unshift(event);
          undoStack.push(event);
        } else {
          // Remove all events with the same transaction ID
          while (true) {
            const event = events.pop()!;
            eventsToUndo.unshift(event);
            undoStack.push(event);
            if (
              lastTransactionId === undefined ||
              !events.length ||
              events[events.length - 1].transactionId !== lastTransactionId
            ) {
              break;
            }
          }
        }

        // Replay remaining events to get to the new state
        let state = {
          ...logic.getInitialSnapshot(),
          events,
          undoStack
        };

        for (const { event } of events) {
          const [newState, _effects] = logic.transition(state, event);
          state = {
            ...newState,
            events,
            undoStack
          };
        }

        return [state, []];
      }

      if (event.type === 'redo') {
        const events = snapshot.events.slice();
        const undoStack = snapshot.undoStack.slice();
        if (!undoStack.length) {
          return [
            {
              ...snapshot,
              events,
              undoStack
            },
            []
          ];
        }

        const lastTransactionId = undoStack[undoStack.length - 1].transactionId;
        let state = {
          ...snapshot,
          events,
          undoStack
        };
        const allEffects: any[] = [];

        while (
          undoStack.length > 0 &&
          undoStack[undoStack.length - 1].transactionId === lastTransactionId
        ) {
          const undoEvent = undoStack.pop()!;
          events.push(undoEvent);
          const [newState, effects] = logic.transition(state, undoEvent.event);
          state = {
            ...newState,
            events,
            undoStack
          };
          allEffects.push(...effects);
        }

        return [state, allEffects];
      }

      const events = snapshot.events.slice();
      const [state, effects] = logic.transition(snapshot, event);
      return [
        {
          ...state,
          events: events.concat({
            event,
            transactionId: options?.getTransactionId?.(event)
          }),
          // Clear the undo stack when new events occur
          undoStack: []
        },
        effects
      ];
    }
  };

  return enhancedLogic;
}
