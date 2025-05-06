import { AnyStore, EventFromStore, InternalStore } from './types';
import { createStoreCore, StoreMiddleware } from './store';
import { createStoreTransition } from './store';
import { StoreFromConfig } from './store';
import { AnyStoreConfig, EventFromStoreConfig } from './types';

type UndoEvent<T extends AnyStore> = {
  event: EventFromStore<T>;
  transactionId?: string;
};

export function undoRedo<T extends AnyStoreConfig>(
  storeConfig: T,
  options?: {
    getTransactionId?: (event: EventFromStoreConfig<T>) => string;
  }
): StoreFromConfig<T> & { undo: () => void; redo: () => void } {
  // const events: UndoEvent[] = [];
  // const undoStack: UndoEvent[] = [];

  const transition = createStoreTransition(storeConfig.on);
  const newStore = createStoreCore(
    storeConfig.context,
    storeConfig.on,
    storeConfig.emits,
    undefined,
    (snapshot, event) => {
      const [state, effects] = transition(snapshot, event);
      state.events = snapshot.events?.concat({
        event,
        transactionId: options?.getTransactionId?.(event)
      });
      state.undoStack = snapshot.undoStack;

      return [state, effects];
    },
    () => ({
      events: [],
      undoStack: [],
      context: storeConfig.context,
      status: 'active',
      output: undefined,
      error: undefined
    })
  );

  Object.assign(newStore, {
    undo() {
      const events = newStore.getSnapshot().events.slice();
      const undoStack = newStore.getSnapshot().undoStack.slice();
      if (!events.length) {
        return;
      }

      // Get the transaction ID of the last event
      const lastTransactionId = events[events.length - 1].transactionId;

      // Remove all events with the same transaction ID
      const eventsToUndo: UndoEvent[] = [];
      while (
        events.length > 0 &&
        events[events.length - 1].transactionId === lastTransactionId
      ) {
        const event = events.pop()!;
        eventsToUndo.unshift(event);
        undoStack.push(event);
      }

      // Replay remaining events to get to the new state
      let state = newStore.getInitialSnapshot();
      for (const { event } of events) {
        state = newStore.transition(state, event)[0];
      }
      state.events = events;
      state.undoStack = undoStack;
      (newStore as unknown as InternalStore<any, any, any>)['~atom'].set(state);
    },
    redo() {
      const events = newStore.getSnapshot().events.slice();
      const undoStack = newStore.getSnapshot().undoStack.slice();
      if (!undoStack.length) {
        return;
      }

      // Get the transaction ID of the last undone event
      const lastTransactionId = undoStack[undoStack.length - 1].transactionId;

      // Apply all events with the same transaction ID
      let state = newStore.getSnapshot();
      while (
        undoStack.length > 0 &&
        undoStack[undoStack.length - 1].transactionId === lastTransactionId
      ) {
        const undoEvent = undoStack.pop()!;
        events.push(undoEvent);
        state = newStore.transition(state, undoEvent.event)[0];
      }
      state.events = events;
      state.undoStack = undoStack;

      (newStore as unknown as InternalStore<any, any, any>)['~atom'].set(state);
    }
  });

  return newStore;
}

export const createUndoRedoMiddleware = (options?: {
  getTransactionId?: (event: EventFromStoreConfig<any>) => string;
}): StoreMiddleware<any, any, any> => ({
  getInitialSnapshot: (prevInitialSnapshot) => {
    return {
      ...prevInitialSnapshot,
      events: [],
      undoStack: []
    };
  },
  transition: (snapshot, event, previousTransition, initialSnapshot) => {
    if (event.type === 'undo') {
      const events = snapshot.events?.slice() as UndoEvent[];
      const undoStack = snapshot.undoStack?.slice() as UndoEvent[];
      if (!events.length) {
        return [snapshot, []];
      }

      const lastTransactionId = events[events.length - 1].transactionId;
      const eventsToUndo: UndoEvent[] = [];
      while (
        events.length > 0 &&
        events[events.length - 1].transactionId === lastTransactionId
      ) {
        const event = events.pop()!;
        eventsToUndo.unshift(event);
        undoStack.push(event);
      }
      let state = initialSnapshot;
      for (const { event } of events) {
        state = previousTransition(state, event.event)[0];
      }
      const newSnapshot = {
        ...state,
        events,
        undoStack
      };
      return [newSnapshot, []];
    }
    if (event.type === 'redo') {
      const events = snapshot.events?.slice() as UndoEvent[];
      const undoStack = snapshot.undoStack?.slice() as UndoEvent[];
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
        state = previousTransition(state, undoEvent.event)[0];
      }
      const newSnapshot = {
        ...state,
        events,
        undoStack
      };

      return [newSnapshot, []];
    }
    const [state, effects] = previousTransition(snapshot, event);
    state.events = snapshot.events?.concat({
      event,
      transactionId: options?.getTransactionId?.(event)
    });
    state.undoStack = snapshot.undoStack;
    return [state, effects];
  }
});
