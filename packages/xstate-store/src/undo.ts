import {
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
import { createStoreTransition } from './store';

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
 * @example
 *
 * ```ts
 * // Skip certain events from undo/redo
 * const store = createStore(
 *   undoRedo(
 *     {
 *       context: { count: 0 },
 *       on: {
 *         inc: (ctx) => ({ count: ctx.count + 1 }),
 *         log: (ctx) => ctx // No state change, just logging
 *       }
 *     },
 *     {
 *       skipEvents: (event) => event.type === 'log'
 *     }
 *   )
 * );
 *
 * store.send({ type: 'inc' }); // count = 1
 * store.send({ type: 'log' }); // count = 1 (logged but not undoable)
 * store.send({ type: 'inc' }); // count = 2
 * store.trigger.undo(); // count = 1 (skips log event)
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
    /** A function that returns the transaction ID of an event. */
    getTransactionId?: (event: ExtractEvents<TEventPayloadMap>) => string;
    /**
     * A function that returns whether an event should be skipped during
     * undo/redo. Skipped events are not stored in history and are not replayed
     * during undo/redo.
     */
    skipEvents?: (event: ExtractEvents<TEventPayloadMap>) => boolean;
  }
): StoreLogic<
  StoreSnapshot<TContext>,
  ExtractEvents<TEventPayloadMap> | { type: 'undo' } | { type: 'redo' },
  EmitsFromStoreConfig<any>
> {
  type TEvent = ExtractEvents<TEventPayloadMap>;
  const logic: AnyStoreLogic = {
    getInitialSnapshot: () => ({
      status: 'active',
      context: storeConfig.context,
      output: undefined,
      error: undefined
    }),
    transition: createStoreTransition(storeConfig.on)
  };

  const enhancedLogic: AnyStoreLogic = {
    getInitialSnapshot: () => ({
      status: 'active',
      context: storeConfig.context,
      output: undefined,
      error: undefined,
      events: [],
      undoStack: []
    }),
    transition: (snapshot, event) => {
      if (event.type === 'undo') {
        const events = snapshot.events.slice();
        const undoStack = snapshot.undoStack.slice();
        if (!snapshot.events.length) {
          return [snapshot, []];
        }

        // Get the transaction ID of the last event
        const lastTransactionId = events[events.length - 1].transactionId;

        // Remove all events with the same transaction ID
        // If transactionId is undefined, only remove the last event
        const eventsToUndo: UndoEvent<TEvent>[] = [];
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

        // Filter out events that should be skipped during undo
        const eventsToReplay = events.filter(
          (undoEvent: UndoEvent<TEvent>) =>
            !options?.skipEvents?.(undoEvent.event)
        );

        // Replay remaining events to get to the new state
        let state = {
          ...logic.getInitialSnapshot(),
          events,
          undoStack
        };

        for (const { event } of eventsToReplay) {
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

          // Skip events that should not be redone
          if (options?.skipEvents?.(undoEvent.event)) {
            continue;
          }

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

      const [state, effects] = logic.transition(snapshot, event);
      const isEventSkipped = options?.skipEvents?.(event);
      const events = isEventSkipped
        ? snapshot.events
        : snapshot.events.slice().concat({
            event,
            transactionId: options?.getTransactionId?.(event)
          });

      return [
        {
          ...state,
          events,
          // Clear the undo stack when new events occur
          undoStack: []
        },
        effects
      ];
    }
  };

  return enhancedLogic;
}
