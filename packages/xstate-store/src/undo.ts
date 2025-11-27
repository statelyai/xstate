import {
  AnyStoreLogic,
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

interface UndoRedoOptions<
  TContext extends StoreContext,
  TEvent extends EventObject
> {
  /** A function that returns the transaction ID of an event. */
  getTransactionId?: (
    event: TEvent,
    snapshot: StoreSnapshot<TContext>
  ) => string | null | undefined;
  /**
   * A function that returns whether an event should be skipped during
   * undo/redo. Skipped events are not stored in history and are not replayed
   * during undo/redo.
   */
  skipEvent?: (event: TEvent, snapshot: StoreSnapshot<TContext>) => boolean;
}

interface UndoRedoSnapshotOptions<
  TContext extends StoreContext,
  TEvent extends EventObject
> {
  /** A function that returns the transaction ID of an event. */
  getTransactionId?: (
    event: TEvent,
    snapshot: StoreSnapshot<TContext>
  ) => string | null | undefined;
  /**
   * A function that returns whether a snapshot should be skipped during
   * undo/redo. Skipped events don't save snapshots to history.
   */
  skipEvent?: (event: TEvent, snapshot: StoreSnapshot<TContext>) => boolean;
  /** Maximum number of snapshots to keep in history. Defaults to Infinity. */
  historyLimit?: number;
}

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
 *       skipEvent: (event) => event.type === 'log'
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
  options?: UndoRedoOptions<TContext, ExtractEvents<TEventPayloadMap>>
): StoreLogic<
  StoreSnapshot<TContext>,
  ExtractEvents<TEventPayloadMap> | { type: 'undo' } | { type: 'redo' },
  ExtractEvents<TEmittedPayloadMap>
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
        const eventsToReplay = events;

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

        if (lastTransactionId === undefined) {
          // When no transaction ID is provided, each event is its own transaction
          const undoEvent = undoStack.pop()!;
          events.push(undoEvent);
          const [newState, effects] = logic.transition(state, undoEvent.event);
          state = {
            ...newState,
            events,
            undoStack
          };
          allEffects.push(...effects);
        } else {
          // Remove all events with the same transaction ID
          while (
            undoStack.length > 0 &&
            undoStack[undoStack.length - 1].transactionId === lastTransactionId
          ) {
            const undoEvent = undoStack.pop()!;
            events.push(undoEvent);
            const [newState, effects] = logic.transition(
              state,
              undoEvent.event
            );
            state = {
              ...newState,
              events,
              undoStack
            };
            allEffects.push(...effects);
          }
        }

        return [state, allEffects];
      }

      const [state, effects] = logic.transition(snapshot, event);
      const isEventSkipped = options?.skipEvent?.(event, snapshot);
      const events = isEventSkipped
        ? snapshot.events
        : snapshot.events.concat({
            event,
            transactionId: options?.getTransactionId?.(event, snapshot)
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

/**
 * Creates store logic with undo/redo functionality using snapshot history.
 *
 * Unlike `undoRedo()` which replays events, this maintains a history of full
 * snapshots for faster undo/redo operations at the cost of more memory.
 *
 * @example
 *
 * ```ts
 * // Basic usage - each event is its own transaction
 * const store = createStore(
 *   undoRedoSnapshot({
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
 * store.trigger.undo(); // count = 1 (restores previous snapshot)
 * store.trigger.redo(); // count = 2 (restores next snapshot)
 * ```
 *
 * @example
 *
 * ```ts
 * // With history limit
 * const store = createStore(
 *   undoRedoSnapshot(
 *     {
 *       context: { count: 0 },
 *       on: {
 *         inc: (ctx) => ({ count: ctx.count + 1 })
 *       }
 *     },
 *     {
 *       historyLimit: 10 // Keep only last 10 snapshots
 *     }
 *   )
 * );
 * ```
 *
 * @returns Store logic with additional `undo` and `redo` event handlers
 */
export function undoRedoSnapshot<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap
>(
  storeConfig: StoreConfig<TContext, TEventPayloadMap, TEmittedPayloadMap>,
  options?: UndoRedoSnapshotOptions<TContext, ExtractEvents<TEventPayloadMap>>
): StoreLogic<
  StoreSnapshot<TContext>,
  ExtractEvents<TEventPayloadMap> | { type: 'undo' } | { type: 'redo' },
  ExtractEvents<TEmittedPayloadMap>
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

  const historyLimit = options?.historyLimit ?? Infinity;

  const enhancedLogic: AnyStoreLogic = {
    getInitialSnapshot: () => ({
      status: 'active',
      context: storeConfig.context,
      output: undefined,
      error: undefined,
      past: [],
      future: []
    }),
    transition: (snapshot, event) => {
      if (event.type === 'undo') {
        const past = snapshot.past.slice();
        const future = snapshot.future.slice();

        if (!past.length) {
          return [snapshot, []];
        }

        // Save current snapshot to future
        const currentSnapshot = {
          status: snapshot.status,
          context: snapshot.context,
          output: snapshot.output,
          error: snapshot.error
        };

        // Get the transaction ID of the last snapshot in past
        const lastItem = past[past.length - 1];
        const lastTransactionId = lastItem.transactionId;

        let newSnapshot;

        if (lastTransactionId === undefined) {
          // Each event is its own transaction
          const item = past.pop()!;
          newSnapshot = item.snapshot;
          future.unshift({
            snapshot: currentSnapshot,
            transactionId: lastTransactionId
          });
        } else {
          // Find the first snapshot in this transaction group
          // Remove all snapshots with the same transaction ID
          const transactionSnapshots: typeof past = [];
          while (
            past.length > 0 &&
            past[past.length - 1].transactionId === lastTransactionId
          ) {
            transactionSnapshots.unshift(past.pop());
          }

          // The first snapshot in the transaction is the state before the transaction
          newSnapshot = transactionSnapshots[0].snapshot;

          // Add current state to future with the transaction ID
          future.unshift({
            snapshot: currentSnapshot,
            transactionId: lastTransactionId
          });
        }

        return [
          {
            ...newSnapshot,
            past,
            future
          },
          []
        ];
      }

      if (event.type === 'redo') {
        const past = snapshot.past.slice();
        const future = snapshot.future.slice();

        if (!future.length) {
          return [snapshot, []];
        }

        const firstItem = future[0];
        const firstTransactionId = firstItem.transactionId;

        let newSnapshot;
        if (firstTransactionId === undefined) {
          // Each event is its own transaction
          const item = future.shift()!;
          newSnapshot = item.snapshot;
          past.push(item);
        } else {
          // Restore all snapshots with the same transaction ID
          while (
            future.length > 0 &&
            future[0].transactionId === firstTransactionId
          ) {
            const item = future.shift()!;
            newSnapshot = item.snapshot;
            past.push(item);
          }
        }

        // Apply history limit
        const excessCount = past.length - historyLimit;
        if (excessCount > 0) {
          past.splice(0, excessCount);
        }

        return [
          {
            ...newSnapshot,
            past,
            future
          },
          []
        ];
      }

      const [state, effects] = logic.transition(snapshot, event);
      const isEventSkipped = options?.skipEvent?.(event, snapshot);

      if (isEventSkipped) {
        return [
          {
            ...state,
            past: snapshot.past,
            future: snapshot.future
          },
          effects
        ];
      }

      const past = snapshot.past.slice();
      const currentSnapshot = {
        status: snapshot.status,
        context: snapshot.context,
        output: snapshot.output,
        error: snapshot.error
      };

      past.push({
        snapshot: currentSnapshot,
        transactionId: options?.getTransactionId?.(event, snapshot)
      });

      // Apply history limit
      const excessCount = past.length - historyLimit;
      if (excessCount > 0) {
        past.splice(0, excessCount);
      }

      return [
        {
          ...state,
          past,
          // Clear future when new events occur
          future: []
        },
        effects
      ];
    }
  };

  return enhancedLogic;
}
