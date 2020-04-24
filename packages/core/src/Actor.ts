import {
  EventObject,
  // Subscribable,
  InvokeDefinition,
  AnyEventObject,
  Unsubscribable,
  Subscribable,
  ActorLike,
  SCXML,
  InvokeCallback,
  InterpreterOptions
} from './types';
import { State } from './State';
import { toSCXMLEvent, isPromiseLike } from './utils';
import { error, doneInvoke } from './actions';
import { isFunction } from 'util';
import { MachineNode } from './MachineNode';
import { Interpreter, interpret } from './interpreter';
import * as actionTypes from './actionTypes';
import { registry } from './registry';

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

export function isActor(item: any): item is ActorRef<any, any> {
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
  start: () => ActorRef<TCurrent, TEvent, TRef>;
  stop: () => void;
  id: string;
  // subscription?: Unsubscribable;
}

class ObservableActorRef<TCurrent extends EventObject>
  implements ActorRef<TCurrent | undefined, never, Subscribable<TCurrent>> {
  public current = undefined;
  private subscription?: Unsubscribable;

  constructor(
    public ref: Subscribable<TCurrent>,
    private parent: ActorRef<any, any>,
    public id: string // TODO: use "system"
  ) {}

  public start() {
    this.subscription = this.ref.subscribe(
      (value) => {
        this.parent.send(toSCXMLEvent(value, { origin: this }));
      },
      (err) => {
        this.parent.send(
          toSCXMLEvent(error(this.id, err) as any, { origin: this })
        );
      },
      () => {
        this.parent.send(
          toSCXMLEvent(doneInvoke(this.id) as any, { origin: this })
        );
      }
    );
    return this;
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

  constructor(
    public ref: Promise<T>,
    private parent: ActorRef<any, any>,
    public id: string
  ) {}
  public start() {
    this.ref.then(
      (response) => {
        if (!this.canceled) {
          this.current = response;
          this.parent.send(
            toSCXMLEvent(doneInvoke(this.id, response) as any, { origin: this })
          );
        }
      },
      (errorData) => {
        if (!this.canceled) {
          const errorEvent = error(this.id, errorData);

          this.parent.send(toSCXMLEvent(errorEvent, { origin: this }));
        }
      }
    );
    return this;
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
  id: string
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
    private parent: ActorRef<any, any>,
    public id: string
  ) {}
  public start() {
    const dispose = this.ref(
      (e: TEmitted) => {
        if (this.canceled) {
          return;
        }

        this.current = e;
        this.parent.send(toSCXMLEvent(e, { origin: this }));
      },
      (newListener) => {
        this.receivers.add(newListener);
      }
    );

    if (isPromiseLike(dispose)) {
      dispose.then(
        (resolved) => {
          this.parent.send(
            toSCXMLEvent(doneInvoke(this.id, resolved) as any, { origin: this })
          );
          this.canceled = true;
        },
        (errorData) => {
          const errorEvent = error(this.id, errorData);
          this.parent.send(toSCXMLEvent(errorEvent, { origin: this }));
          // TODO: handle error
          this.canceled = true;
        }
      );
    } else {
      this.dispose = dispose;
    }
    return this;
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
>(
  fn: InvokeCallback,
  parent: ActorRef<any, any>,
  id: string
): ActorRef<TEmitted | undefined, SCXML.Event<TEvent>> {
  return new CallbackActorRef<TEmitted, TEvent>(fn, parent, id);
}

export function fromMachine<TContext, TEvent extends EventObject>(
  machine: MachineNode<TContext, any, TEvent>,
  parent: ActorRef<any, any>,
  id: string,
  options?: Partial<InterpreterOptions>
): ActorRef<
  State<TContext, TEvent>,
  TEvent,
  Interpreter<TContext, any, TEvent>
> {
  const service = interpret(machine, {
    ...options,
    parent
  });

  // TODO: move this to ServiceActorRef
  service
    .onDone((doneEvent) => {
      parent.send(
        toSCXMLEvent(doneEvent as any, {
          origin: (service as any) as ActorRef<any, any> // TODO: fix types
        })
      );
    })
    .start();

  return new ServiceActorRef<TContext, TEvent>(service, parent, id, options);
}

class ServiceActorRef<TContext, TEvent extends EventObject>
  implements ActorRef<State<TContext, TEvent>, TEvent> {
  public current: State<TContext, TEvent>;
  private subscription?: Unsubscribable;

  constructor(
    public ref: Interpreter<TContext, any, TEvent>,
    private parent: ActorRef<any, any>,
    public id: string,
    private options?: any // TODO: fix
  ) {
    this.current = this.ref.current;
  }
  public start() {
    this.subscription = this.ref.subscribe((state) => {
      this.current = state;

      if (this.options && this.options.sync) {
        this.parent.send(
          toSCXMLEvent(
            {
              type: actionTypes.update,
              state
            },
            { origin: this }
          )
        );
      }
    });

    return this;
  }
  public send(event) {
    this.ref.send(event);
  }
  public stop() {
    this.subscription && this.subscription.unsubscribe();
  }
}

export function fromService<TContext, TEvent extends EventObject>(
  service: Interpreter<TContext, any, TEvent>,
  parent: ActorRef<any, any>,
  id: string
): ActorRef<State<TContext, TEvent>, TEvent, typeof service> {
  return new ServiceActorRef<TContext, TEvent>(service, parent, id);
}
