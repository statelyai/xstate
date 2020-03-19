import { EventObject, Interpreter, State } from 'xstate';

export interface Unsubscribable {
  unsubscribe(): any | void;
}
export interface Subscribable<T> {
  subscribe(
    next?: (value: T) => void,
    error?: (error: any) => void,
    complete?: () => void
  ): Unsubscribable;
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
  constructor(
    public send: Sender<TEvent>,
    public subscribe: Subscribable<TCurrent>['subscribe'],
    public current: TCurrent,
    public ref: TRef
  ) {}

  public static fromObservable<T>(
    observable: Subscribable<T>
  ): ActorRef<T | undefined, never> {
    return new ActorRef<T | undefined, never, typeof observable>(
      () => void 0,
      observable.subscribe.bind(observable),
      undefined,
      observable
    );
  }

  public static fromPromise<T>(
    promise: PromiseLike<T>
  ): ActorRef<T | undefined, never> {
    return new ActorRef<T | undefined, never, typeof promise>(
      () => void 0,
      (next, handleError, complete) => {
        let unsubscribed = false;
        promise.then(
          response => {
            if (unsubscribed) {
              return;
            }
            next && next(response);
            if (unsubscribed) {
              return;
            }
            complete && complete();
          },
          err => {
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

  public static fromService<TContext, TEvent extends EventObject>(
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
}
