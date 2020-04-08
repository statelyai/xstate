import { EventObject, State } from 'xstate';

export interface Unsubscribable {
  unsubscribe(): any | void;
}
export interface Subscribable<T> {
  subscribe(
    next?: (value: T) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Unsubscribable | undefined;
}

export interface ActorLike<TCurrent, TEvent extends EventObject>
  extends Subscribable<TCurrent> {
  send: Sender<TEvent>;
}

export interface ActorRef<TCurrent, TEvent extends EventObject>
  extends Subscribable<TCurrent> {
  send: Sender<TEvent>;
  current: TCurrent;
}

export type Sender<TEvent extends EventObject> = (event: TEvent) => void;

export class ActorRef<TCurrent, TEvent extends EventObject, TRef = any> {
  private subscription?: Unsubscribable;
  constructor(
    public send: Sender<TEvent>,
    public subscribe: Subscribable<TCurrent>['subscribe'],
    public current: TCurrent,
    public ref: TRef
  ) {
    this.subscription = subscribe((latest) => {
      this.current = latest;
    });
  }

  public stop() {
    this.subscription && this.subscription.unsubscribe();
  }
}

export function fromObservable<T>(
  observable: Subscribable<T>
): ActorRef<T | undefined, never> {
  return new ActorRef<T | undefined, never, typeof observable>(
    () => void 0,
    observable.subscribe.bind(observable),
    undefined,
    observable
  );
}

export function fromPromise<T>(
  promise: PromiseLike<T>
): ActorRef<T | undefined, never> {
  return new ActorRef<T | undefined, never, typeof promise>(
    () => void 0,
    (next, handleError, complete) => {
      let unsubscribed = false;
      promise.then(
        (response) => {
          if (unsubscribed) {
            return;
          }
          next && next(response);
          if (unsubscribed) {
            return;
          }
          complete && complete();
        },
        (err) => {
          if (unsubscribed) {
            return;
          }
          handleError && handleError(err);
        }
      );

      return {
        unsubscribe: () => (unsubscribed = true)
      };
    },
    undefined,
    promise
  );
}

export function fromCallback<TEmitted, TEvent extends EventObject>(
  fn: (
    emit: (emitted: TEmitted) => void,
    receive: (receiver: (event: TEvent) => void) => void
  ) => () => void
) {
  const receivers = new Set<(e: TEvent) => void>();
  const listeners = new Set<(e: TEmitted) => void>();

  const listenForEmitted = (e: TEmitted) => {
    listeners.forEach((listener) => listener(e));
  };

  const stop = fn(listenForEmitted, (newListener) => {
    receivers.add(newListener);
  });

  const actorRef = new ActorRef<TEmitted | undefined, TEvent>(
    (event: TEvent) => receivers.forEach((receiver) => receiver(event)),
    (next) => {
      if (!next) {
        return;
      }

      next && listeners.add(next);

      return {
        unsubscribe: () => {
          listeners.delete(next);
          stop && stop();
        }
      };
    },
    undefined as TEmitted | undefined,
    fn
  );

  return actorRef;
}

export function fromService<TContext, TEvent extends EventObject>(
  service: ActorLike<State<TContext, TEvent>, TEvent> & {
    state: State<TContext, TEvent>;
  }
): ActorRef<State<TContext, TEvent>, TEvent, typeof service> {
  return new ActorRef(
    service.send.bind(service),
    service.subscribe.bind(service),
    service.state,
    service
  );
}
