import {
  ActorContext,
  ActorRef,
  Behavior,
  EventObject,
  Observer
} from './types';
import { doneInvoke, error } from './actions';
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

type PromiseEvents<T> =
  | { type: 'fulfill'; data: T }
  | { type: 'reject'; error: unknown };

type PromiseState<T> =
  | {
      status: 'pending';
      data: undefined;
      error: undefined;
    }
  | {
      status: 'fulfilled';
      data: T;
      error: undefined;
    }
  | {
      status: 'rejected';
      data: undefined;
      error: any;
    };

export function fromPromise<T>(
  promiseFn: () => Promise<T>
): Behavior<PromiseEvents<T>, PromiseState<T>> {
  const initialState: PromiseState<T> = {
    error: undefined,
    data: undefined,
    status: 'pending'
  };

  return {
    transition: (state, event, { parent, id, observers }) => {
      switch (event.type) {
        case 'fulfill':
          parent?.send(doneInvoke(id, event.data));
          return {
            error: undefined,
            data: event.data,
            status: 'fulfilled'
          };
        case 'reject':
          parent?.send(error(id, event.error));
          observers.forEach((observer) => {
            observer.error(event.error);
          });
          return {
            error: event.error,
            data: undefined,
            status: 'rejected'
          };
        default:
          return state;
      }
    },
    initialState,
    start: ({ self }) => {
      promiseFn().then(
        (data) => {
          self.send({ type: 'fulfill', data });
        },
        (reason) => {
          self.send({ type: 'reject', error: reason });
        }
      );

      return initialState;
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
      mailbox.push(event);
      flush();
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
    id: options.id || 'anonymous',
    observers
  };

  state = behavior.start ? behavior.start(actorCtx) : state;

  return actor;
}
