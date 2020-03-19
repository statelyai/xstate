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
  send: (event: TEvent) => void;
}

export interface ActorRef<TCurrent, TEvent extends EventObject>
  extends Subscribable<TCurrent> {
  send: (event: TEvent) => void;
  current: TCurrent;
}

export class ActorRef<TCurrent, TEvent extends EventObject> {
  constructor(
    private ref: ActorLike<TCurrent, TEvent>,
    public current: TCurrent
  ) {
    this.send = this.ref.send.bind(ref);
    this.subscribe = this.ref.subscribe.bind(ref);
  }

  public static fromObservable<T>(
    observable: Subscribable<T>
  ): ActorRef<T | undefined, never> {
    return new ActorRef<T | undefined, never>(
      {
        send: () => void 0,
        subscribe: observable.subscribe.bind(observable)
      },
      undefined
    );
  }

  public static fromService<TContext, TEvent extends EventObject>(
    service: Interpreter<TContext, any, TEvent>
  ): ActorRef<State<TContext, TEvent>, TEvent> {
    return new ActorRef(
      {
        send: service.send.bind(service),
        subscribe: service.subscribe.bind(service)
      },
      service.state
    );
  }
}
