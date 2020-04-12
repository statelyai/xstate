import {
  EventObject,
  // Subscribable,
  InvokeDefinition,
  AnyEventObject,
  Unsubscribable,
  Subscribable,
  ActorLike,
  SCXML,
  InvokeCallback
} from './types';
import { State } from './State';
import { toSCXMLEvent, isPromiseLike } from './utils';
import { error, doneInvoke } from './actions';
import { isFunction } from 'util';

export interface Actor<
  TContext = any,
  TEvent extends EventObject = AnyEventObject
> extends Subscribable<TContext> {
  id: string;
  send: (event: TEvent) => any; // TODO: change to void
  stop?: () => any | undefined;
  toJSON: () => {
    id: string;
  };
  meta?: InvokeDefinition<TContext, TEvent>;
  state?: any;
}

export function createNullActor<TContext, TEvent extends EventObject>(
  id: string
): Actor<TContext, TEvent> {
  return {
    id,
    send: () => void 0,
    subscribe: () => ({
      unsubscribe: () => void 0
    }),
    toJSON: () => ({
      id
    })
  };
}

/**
 * Creates a null actor that is able to be invoked given the provided
 * invocation information in its `.meta` value.
 *
 * @param invokeDefinition The meta information needed to invoke the actor.
 */
export function createInvocableActor<TContext, TEvent extends EventObject>(
  invokeDefinition: InvokeDefinition<TContext, TEvent>
): Actor<any, TEvent> {
  const tempActor = createNullActor<TContext, TEvent>(invokeDefinition.id);

  tempActor.meta = invokeDefinition;

  return tempActor;
}

export function isActor(item: any): item is Actor {
  try {
    return typeof item.send === 'function';
  } catch (e) {
    return false;
  }
}

export type Sender<TEvent extends EventObject> = (event: TEvent) => void;

export interface ActorRef<TCurrent, TEvent extends EventObject, TRef = any> {
  send: Sender<TEvent>;
  // subscribe: Subscribable<TCurrent>['subscribe'];
  current: TCurrent;
  ref: TRef;
  stop: () => void;
  // subscription?: Unsubscribable;
}

class ObservableActorRef<TCurrent extends EventObject>
  implements ActorRef<TCurrent | undefined, never, Subscribable<TCurrent>> {
  public current = undefined;
  private subscription?: Unsubscribable;

  constructor(
    public ref: Subscribable<TCurrent>,
    parent: ActorRef<any, any>,
    id: string // TODO: use "system"
  ) {
    this.subscription = ref.subscribe(
      (value) => {
        parent.send(toSCXMLEvent(value, { origin: this }));
      },
      (err) => {
        parent.send(toSCXMLEvent(error(id, err) as any, { origin: this }));
      },
      () => {
        parent.send(toSCXMLEvent(doneInvoke(id) as any, { origin: this }));
      }
    );
  }

  public send() {
    // no-op
  }
  public subscribe(...args) {
    return this.ref.subscribe(...args);
  }
  public stop() {
    this.subscription && this.subscription.unsubscribe();
  }
}

export function fromObservable<T extends EventObject>(
  observable: Subscribable<T>,
  parent: ActorRef<any, any>,
  id: string
): ActorRef<T | undefined, never> {
  return new ObservableActorRef<T>(observable, parent, id);
}

class PromiseActorRef<T> implements ActorRef<T | undefined, never, Promise<T>> {
  private canceled = false;
  public current: T | undefined = undefined;

  constructor(public ref: Promise<T>, parent: ActorRef<any, any>, id: string) {
    this.ref.then(
      (response) => {
        if (!this.canceled) {
          this.current = response;
          parent.send(
            toSCXMLEvent(doneInvoke(id, response) as any, { origin: this })
          );
        }
      },
      (errorData) => {
        if (!this.canceled) {
          const errorEvent = error(id, errorData);

          parent.send(toSCXMLEvent(errorEvent, { origin: this }));
        }
      }
    );
  }
  public send() {
    // no-op
  }
  public stop() {
    this.canceled = true;
  }
}

export function fromPromise<T>(
  promise: PromiseLike<T>,
  parent: ActorRef<any, any>,
  id: string // TODO: use system
): ActorRef<T | undefined, never> {
  return new PromiseActorRef<T>(Promise.resolve(promise), parent, id);
}

class CallbackActorRef<
  TEmitted extends EventObject = AnyEventObject,
  TEvent extends EventObject = AnyEventObject
> implements ActorRef<TEmitted | undefined, SCXML.Event<TEvent>> {
  private receivers = new Set<(e: EventObject) => void>();
  private listeners = new Set<(e: EventObject) => void>();
  private dispose;
  private canceled = false;
  public current: TEmitted | undefined = undefined;

  constructor(
    public ref: InvokeCallback,
    parent: ActorRef<any, any>,
    id: string
  ) {
    const dispose = this.ref(
      (e: TEmitted) => {
        if (this.canceled) {
          return;
        }

        this.current = e;
        parent.send(toSCXMLEvent(e, { origin: this }));
      },
      (newListener) => {
        this.receivers.add(newListener);
      }
    );

    if (isPromiseLike(dispose)) {
      dispose.then(
        (resolved) => {
          parent.send(
            toSCXMLEvent(doneInvoke(id, resolved) as any, { origin: this })
          );
          this.canceled = true;
        },
        (errorData) => {
          const errorEvent = error(id, errorData);
          parent.send(toSCXMLEvent(errorEvent, { origin: this }));
          // TODO: handle error
          this.canceled = true;
        }
      );
    } else {
      this.dispose = dispose;
    }
  }
  public send(event: SCXML.Event<TEvent>) {
    this.receivers.forEach((receiver) => receiver(event.data));
  }
  public stop() {
    this.canceled = true;

    if (isFunction(this.dispose)) {
      this.dispose();
    }
  }
}

export function fromCallback<
  TEmitted extends EventObject,
  TEvent extends EventObject
>(fn: InvokeCallback, parent: ActorRef<any, any>, id: string) {
  return new CallbackActorRef<TEmitted, TEvent>(fn, parent, id);
  // const receivers = new Set<(e: TEvent) => void>();
  // const listeners = new Set<(e: TEmitted) => void>();

  // const listenForEmitted = (emitted: TEmitted) => {
  //   parent.send(emitted);

  //   listeners.forEach((listener) => listener(emitted));
  // };

  // const stop = fn(listenForEmitted, (newListener) => {
  //   receivers.add(newListener);
  // });

  // const actorRef = new ActorRef<TEmitted | undefined, TEvent>(
  //   (event: TEvent) => receivers.forEach((receiver) => receiver(event)),
  //   (next) => {
  //     if (!next) {
  //       return;
  //     }

  //     listeners.add(next);

  //     return {
  //       unsubscribe: () => {
  //         console.log('unsubscribing');
  //         listeners.delete(next);
  //         stop && stop();
  //       }
  //     };
  //   },
  //   undefined as TEmitted | undefined,
  //   fn
  // );

  // return actorRef;
}

class ServiceActorRef<TContext, TEvent extends EventObject>
  implements ActorRef<State<TContext, TEvent>, TEvent> {
  public current: State<TContext, TEvent>;
  private subscription?: Unsubscribable;

  constructor(
    public ref: ActorLike<State<TContext, TEvent>, TEvent> & {
      state: State<TContext, TEvent>;
    }
  ) {
    this.current = this.ref.state;

    this.subscription = this.ref.subscribe((state) => {
      this.current = state;
    });
  }
  public send(event) {
    this.ref.send(event);
  }
  public stop() {
    this.subscription && this.subscription.unsubscribe();
  }
}

export function fromService<TContext, TEvent extends EventObject>(
  service: ActorLike<State<TContext, TEvent>, TEvent> & {
    state: State<TContext, TEvent>;
  }
): ActorRef<State<TContext, TEvent>, TEvent, typeof service> {
  return new ServiceActorRef<TContext, TEvent>(service);
  // return new ActorRef(
  //   service.send.bind(service),
  //   service.subscribe.bind(service),
  //   service.state,
  //   service
  // );
}
