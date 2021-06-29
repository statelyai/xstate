import { ActorContext, ActorRef, Behavior, EventObject, Observer } from '.';
import { doneInvoke } from './actions';
import { toActorRef } from './Actor';
import { toObserver } from './utils';

/**
 * Returns an actor behavior from a reducer and its initial state.
 *
 * @param transition The pure reducer that returns the next state given the current state and event.
 * @param initialState The initial state of the reducer.
 * @returns An actor behavior
 */
export function fromReducer<TState, TEvent extends EventObject>(
  transition: (
    state: TState,
    event: TEvent,
    actorContext: ActorContext<TEvent, TState>
  ) => TState,
  initialState: TState
): Behavior<TEvent, TState> {
  return {
    transition,
    initialState
  };
}

export function fromPromise<T>(
  promiseFn: () => Promise<T>
): Behavior<{ type: 'resolve'; data: T }, T | undefined> {
  return {
    transition: (state, event, { parent, id }) => {
      switch (event.type) {
        case 'resolve':
          parent?.send(doneInvoke(id, event.data));
          return event.data;
        default:
          return state;
      }
    },
    initialState: undefined,
    start: ({ self }) => {
      promiseFn().then((data) => {
        self.send({ type: 'resolve', data });
      });

      return undefined;
    }
  };
}

interface SpawnBehaviorOptions {
  id?: string;
  parent?: ActorRef<any>;
}

export function spawnBehavior<TEvent extends EventObject, TEmitted>(
  behavior: Behavior<TEvent, TEmitted>,
  options: SpawnBehaviorOptions = {}
): ActorRef<TEvent, TEmitted> {
  let state = behavior.initialState;
  const observers = new Set<Observer<TEmitted>>();
  const mailbox: TEvent[] = [];
  let flushing = false;

  const enqueue = (event: TEvent): void => {
    mailbox.push(event);
    flush();
  };

  const flush = () => {
    if (flushing) {
      return;
    }
    flushing = true;
    while (mailbox.length > 0) {
      const event = mailbox.shift()!;
      state = behavior.transition(state, event, actorCtx);
      observers.forEach((observer) => observer.next(state));
    }
    flushing = false;
  };

  const actor = toActorRef({
    id: options.id,
    send: (event: TEvent) => {
      enqueue(event);
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

  const actorCtx = {
    parent: options.parent,
    self: actor,
    id: options.id || 'anonymous'
  };

  state = behavior.start?.(actorCtx) ?? state;

  return actor;
}
