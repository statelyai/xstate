import {
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
> {
  type TEvent = ExtractEvents<TEventPayloadMap>;
  const logic: StoreLogic<any, any, any> = {
    getInitialSnapshot: () => ({
      status: 'active',
      context: storeConfig.context,
      output: undefined,
      error: undefined
    }),
    transition: createStoreTransition(storeConfig.on)
  };

  const newLogic: StoreLogic<any, any, any> = {
    getInitialSnapshot: () => ({
      status: 'active',
      context: storeConfig.context,
      output: undefined,
      error: undefined,
      events: [],
      undoStack: []
    }),
    transition: (snapshot, event) => {
      const events = snapshot.events.slice();
      if (event.type === 'undo') {
        const undoStack = snapshot.undoStack.slice();
        if (!events.length) {
          return [snapshot, []];
        }

        // Get the transaction ID of the last event
        const lastTransactionId = events[events.length - 1].transactionId;

        // Remove all events with the same transaction ID
        const eventsToUndo: UndoEvent<TEvent>[] = [];
        while (
          events.length > 0 &&
          events[events.length - 1].transactionId === lastTransactionId
        ) {
          const event = events.pop()!;
          eventsToUndo.unshift(event);
          undoStack.push(event);
        }

        // Replay remaining events to get to the new state
        let state = logic.getInitialSnapshot();
        for (const { event } of events) {
          state = logic.transition(state, event)[0];
        }
        state.events = events;
        state.undoStack = undoStack;
        return [state, []];
      }

      if (event.type === 'redo') {
        const events = snapshot.events.slice();
        const undoStack = snapshot.undoStack.slice();
        if (!undoStack.length) {
          return [snapshot, []];
        }

        const lastTransactionId = undoStack[undoStack.length - 1].transactionId;
        let state = snapshot;
        while (
          undoStack.length > 0 &&
          undoStack[undoStack.length - 1].transactionId === lastTransactionId
        ) {
          const undoEvent = undoStack.pop()!;
          events.push(undoEvent);
          state = logic.transition(state, undoEvent.event)[0];
        }
        state.events = events;
        state.undoStack = undoStack;
        return [state, []];
      }

      const [state, effects] = logic.transition(snapshot, event);
      state.events = events.concat({
        event,
        transactionId: options?.getTransactionId?.(event)
      });
      state.undoStack = snapshot.undoStack;
      return [state, effects];
    }
  };

  return newLogic;
}
