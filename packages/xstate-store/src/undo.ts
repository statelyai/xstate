import {
  AnyStoreLogic,
  EventObject,
  EventPayloadMap,
  ExtractEvents,
  StoreConfig,
  StoreContext,
  StoreExtension,
  StoreLogic,
  StoreSnapshot
} from './types';
import { createStoreTransition } from './store';

interface UndoRedoEventOptions<
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
  /**
   * A function to compare snapshots for equality. When true, the new snapshot
   * will not be added to history. Useful for avoiding duplicate snapshots.
   */
  compare?: (
    pastSnapshot: StoreSnapshot<TContext>,
    currentSnapshot: StoreSnapshot<TContext>
  ) => boolean;
}

type UndoRedoStrategyOptions<
  TContext extends StoreContext,
  TEvent extends EventObject
> =
  | ({
      strategy?: 'event';
    } & UndoRedoEventOptions<TContext, TEvent>)
  | ({
      strategy: 'snapshot';
    } & UndoRedoSnapshotOptions<TContext, TEvent>);

// Internal: create undo/redo logic from existing logic (for .with() pattern)
function undoRedoFromLogic<
  TContext extends StoreContext,
  TEvent extends EventObject,
  TEmitted extends EventObject
>(
  logic: StoreLogic<StoreSnapshot<TContext>, TEvent, TEmitted>,
  options?: UndoRedoStrategyOptions<TContext, TEvent>
): StoreLogic<
  StoreSnapshot<TContext>,
  TEvent | { type: 'undo' } | { type: 'redo' },
  TEmitted
> {
  const historyLimit =
    options?.strategy === 'snapshot'
      ? (options.historyLimit ?? Infinity)
      : Infinity;

  if (options?.strategy === 'snapshot') {
    // Snapshot strategy
    const enhancedLogic: AnyStoreLogic = {
      getInitialSnapshot: () => ({
        ...logic.getInitialSnapshot(),
        past: [],
        future: []
      }),
      transition: (snapshot, event) => {
        if (event.type === 'undo') {
          const past = snapshot.past.slice();
          const future = snapshot.future.slice();

          if (!past.length) {
            return [snapshot, [], []];
          }

          const currentSnapshot = {
            status: snapshot.status,
            context: snapshot.context,
            output: snapshot.output,
            error: snapshot.error
          };

          const lastItem = past[past.length - 1];
          const lastTransactionId = lastItem.transactionId;

          let newSnapshot;

          if (lastTransactionId === undefined) {
            const item = past.pop()!;
            newSnapshot = item.snapshot;
            future.unshift({
              snapshot: currentSnapshot,
              transactionId: lastTransactionId
            });
          } else {
            const transactionSnapshots: typeof past = [];
            while (
              past.length > 0 &&
              past[past.length - 1].transactionId === lastTransactionId
            ) {
              transactionSnapshots.unshift(past.pop());
            }
            newSnapshot = transactionSnapshots[0].snapshot;
            future.unshift({
              snapshot: currentSnapshot,
              transactionId: lastTransactionId
            });
          }

          return [{ ...newSnapshot, past, future }, [], []];
        }

        if (event.type === 'redo') {
          const past = snapshot.past.slice();
          const future = snapshot.future.slice();

          if (!future.length) {
            return [snapshot, [], []];
          }

          const firstItem = future[0];
          const firstTransactionId = firstItem.transactionId;

          let newSnapshot;
          if (firstTransactionId === undefined) {
            const item = future.shift()!;
            newSnapshot = item.snapshot;
            past.push(item);
          } else {
            while (
              future.length > 0 &&
              future[0].transactionId === firstTransactionId
            ) {
              const item = future.shift()!;
              newSnapshot = item.snapshot;
              past.push(item);
            }
          }

          const excessCount = past.length - historyLimit;
          if (excessCount > 0) {
            past.splice(0, excessCount);
          }

          return [{ ...newSnapshot, past, future }, [], []];
        }

        const [state, effects] = logic.transition(snapshot, event);
        const isEventSkipped = options?.skipEvent?.(event as TEvent, snapshot);

        if (isEventSkipped) {
          return [
            { ...state, past: snapshot.past, future: snapshot.future },
            effects,
            []
          ];
        }

        const currentSnapshot = {
          status: snapshot.status,
          context: snapshot.context,
          output: snapshot.output,
          error: snapshot.error
        };

        const lastPastSnapshot =
          snapshot.past[snapshot.past.length - 1]?.snapshot;
        const isEqual =
          lastPastSnapshot &&
          options?.compare?.(lastPastSnapshot, currentSnapshot);

        if (isEqual) {
          return [{ ...state, past: snapshot.past, future: [] }, effects, []];
        }

        const past = snapshot.past.slice();
        past.push({
          snapshot: currentSnapshot,
          transactionId: options?.getTransactionId?.(event as TEvent, snapshot)
        });

        const excessCount = past.length - historyLimit;
        if (excessCount > 0) {
          past.splice(0, excessCount);
        }

        return [{ ...state, past, future: [] }, effects, []];
      }
    };
    return enhancedLogic;
  }

  // Event strategy (default)
  type UndoEventItem = { event: TEvent; transactionId?: string };
  const enhancedLogic: AnyStoreLogic = {
    getInitialSnapshot: () => ({
      ...logic.getInitialSnapshot(),
      events: [] as UndoEventItem[],
      undoStack: [] as UndoEventItem[]
    }),
    transition: (snapshot, event) => {
      if (event.type === 'undo') {
        const events = snapshot.events.slice();
        const undoStack = snapshot.undoStack.slice();
        if (!events.length) {
          return [snapshot, [], []];
        }

        const lastTransactionId = events[events.length - 1].transactionId;

        if (lastTransactionId === undefined) {
          const ev = events.pop()!;
          undoStack.push(ev);
        } else {
          while (true) {
            const ev = events.pop()!;
            undoStack.push(ev);
            if (
              !events.length ||
              events[events.length - 1].transactionId !== lastTransactionId
            ) {
              break;
            }
          }
        }

        let state = { ...logic.getInitialSnapshot(), events, undoStack };
        for (const { event: ev } of events) {
          const [newState] = logic.transition(state, ev);
          state = { ...newState, events, undoStack };
        }

        return [state, [], []];
      }

      if (event.type === 'redo') {
        const events = snapshot.events.slice();
        const undoStack = snapshot.undoStack.slice();
        if (!undoStack.length) {
          return [{ ...snapshot, events, undoStack }, [], []];
        }

        const lastTransactionId = undoStack[undoStack.length - 1].transactionId;
        let state = { ...snapshot, events, undoStack };
        const allEffects: any[] = [];

        if (lastTransactionId === undefined) {
          const undoEvent = undoStack.pop()!;
          events.push(undoEvent);
          const [newState, effects] = logic.transition(state, undoEvent.event);
          state = { ...newState, events, undoStack };
          allEffects.push(...effects);
        } else {
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
            state = { ...newState, events, undoStack };
            allEffects.push(...effects);
          }
        }

        return [state, allEffects, []];
      }

      const [state, effects] = logic.transition(snapshot, event);
      const isEventSkipped = options?.skipEvent?.(event as TEvent, snapshot);
      const events = isEventSkipped
        ? snapshot.events
        : snapshot.events.concat({
            event: event as TEvent,
            transactionId: options?.getTransactionId?.(
              event as TEvent,
              snapshot
            )
          });

      return [{ ...state, events, undoStack: [] }, effects, []];
    }
  };

  return enhancedLogic;
}

/**
 * Creates store logic with undo/redo functionality.
 *
 * Supports two strategies:
 *
 * - 'event' (default): Maintains event history and replays events
 * - 'snapshot': Maintains snapshot history for faster undo/redo
 *
 * @example
 *
 * ```ts
 * // Using with .with() (recommended)
 * const store = createStore({
 *   context: { count: 0 },
 *   on: {
 *     inc: (ctx) => ({ count: ctx.count + 1 })
 *   }
 * }).with(undoRedo());
 *
 * store.trigger.inc();
 * store.trigger.undo(); // count = 0
 * ```
 *
 * @example
 *
 * ```ts
 * // Legacy: wrapping config directly
 * const store = createStore(
 *   undoRedo({
 *     context: { count: 0 },
 *     on: {
 *       inc: (ctx) => ({ count: ctx.count + 1 })
 *     }
 *   })
 * );
 * ```
 *
 * @example
 *
 * ```ts
 * // Snapshot strategy with .with()
 * const store = createStore({
 *   context: { count: 0 },
 *   on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
 * }).with(undoRedo({ strategy: 'snapshot', historyLimit: 10 }));
 * ```
 *
 * @returns Store extension or store logic with additional `undo` and `redo`
 *   event handlers
 */
// Overload: extension pattern (no config, just options)
export function undoRedo<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmitted extends EventObject
>(
  options?: UndoRedoStrategyOptions<TContext, ExtractEvents<TEventPayloadMap>>
): StoreExtension<
  TContext,
  TEventPayloadMap,
  {
    undo: null;
    redo: null;
  },
  TEmitted
>;
/**
 * @deprecated Use the .with() pattern instead.
 * @example
 *
 * ```ts
 * const store = createStore({
 *   context: { count: 0 },
 *   on: { inc: (ctx) => ({ count: ctx.count + 1 }) }
 * }).with(undoRedo({ strategy: 'snapshot', historyLimit: 10 }));
 * ```
 */
export function undoRedo<
  TContext extends StoreContext,
  TEventPayloadMap extends EventPayloadMap,
  TEmittedPayloadMap extends EventPayloadMap
>(
  storeConfig: StoreConfig<TContext, TEventPayloadMap, TEmittedPayloadMap>,
  options?: UndoRedoStrategyOptions<TContext, ExtractEvents<TEventPayloadMap>>
): StoreLogic<
  StoreSnapshot<TContext>,
  ExtractEvents<TEventPayloadMap> | { type: 'undo' } | { type: 'redo' },
  ExtractEvents<TEmittedPayloadMap>
>;
// Implementation
export function undoRedo(configOrOptions?: any, options?: any): any {
  // Detect if first arg is a store config (has 'context' property)
  if (configOrOptions && 'context' in configOrOptions) {
    // Legacy pattern: undoRedo(config, options?)
    const storeConfig = configOrOptions;
    const logic: AnyStoreLogic = {
      getInitialSnapshot: () => ({
        status: 'active',
        context: storeConfig.context,
        output: undefined,
        error: undefined
      }),
      transition: createStoreTransition(storeConfig.on)
    };
    return undoRedoFromLogic(logic, options);
  }

  // Extension pattern: undoRedo(options?) returns a function
  const extensionOptions = configOrOptions;
  return (logic: AnyStoreLogic) => undoRedoFromLogic(logic, extensionOptions);
}
