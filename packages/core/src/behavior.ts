import { ActorRef, Behavior, EventObject, Observer } from '.';
import { toActorRef } from './Actor';
import { toEventObject, toObserver } from './utils';

/**
 * Returns an actor behavior from a reducer and its initial state.
 *
 * @param reducer The pure reducer that returns the next state given the current state and event.
 * @param initialState The initial state of the reducer.
 * @returns An actor behavior
 */
export function fromReducer<TState, TEvent extends EventObject>(
  reducer: (state: TState, event: TEvent) => TState,
  initialState: TState
): Behavior<TEvent, TState> {
  return {
    receive: reducer,
    initial: initialState
  };
}

interface SpawnBehaviorOptions {
  id?: string;
  parent?: ActorRef<any>;
}

export function spawnBehavior<TActorEvent extends EventObject, TEmitted>(
  behavior: Behavior<TActorEvent, TEmitted>,
  options: SpawnBehaviorOptions = {}
): ActorRef<TActorEvent, TEmitted> {
  let state = behavior.initial;
  const observers = new Set<Observer<TEmitted>>();

  const actor = toActorRef({
    id: options.id,
    send: (event: TActorEvent) => {
      const eventObject = toEventObject(event);
      state = behavior.receive(state, eventObject, {
        parent: options.parent,
        self: actor
      });
      observers.forEach((observer) => observer.next(state));
    },
    getSnapshot: () => state,
    subscribe: (next, handleError?, complete?) => {
      const observer = toObserver(next, handleError, complete);
      observers.add(observer);
      observer.next(state);

      return {
        unsubscribe: () => {
          observers.delete(observer);
        }
      };
    }
  });

  return actor;
}
