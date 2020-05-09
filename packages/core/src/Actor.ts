import {
  EventObject,
  Subscribable,
  SCXML,
  InvokeCallback,
  InterpreterOptions,
  ActorRef
} from './types';
import { MachineNode } from './MachineNode';
import { Interpreter } from './interpreter';
import {
  Behavior,
  startSignal,
  ActorContext,
  stopSignal,
  createServiceBehavior,
  createMachineBehavior,
  createCallbackBehavior,
  createPromiseBehavior,
  createObservableBehavior
} from './behavior';
import { registry } from './registry';

const nullSubscription = {
  unsubscribe: () => void 0
};

export function isActorRef(item: any): item is ActorRef<any> {
  try {
    return typeof item.send === 'function';
  } catch (e) {
    return false;
  }
}

export function fromObservable<T extends EventObject>(
  observable: Subscribable<T>,
  parent: ActorRef<any>,
  name: string
): ActorRef<never> {
  return new ObservableActorRef(
    createObservableBehavior(observable, parent),
    name
  );
}

export function fromPromise<T>(
  promise: PromiseLike<T>,
  parent: ActorRef<any>,
  name: string
): ActorRef<never> {
  return new ObservableActorRef(createPromiseBehavior(promise, parent), name);
}

export function fromCallback<TEvent extends EventObject>(
  callback: InvokeCallback,
  parent: ActorRef<any>,
  name: string
): ActorRef<SCXML.Event<TEvent>> {
  return new ObservableActorRef(createCallbackBehavior(callback, parent), name);
}

export function fromMachine<TContext, TEvent extends EventObject>(
  machine: MachineNode<TContext, any, TEvent>,
  parent: ActorRef<any>,
  name: string,
  options?: Partial<InterpreterOptions>
): ActorRef<TEvent> {
  return new ObservableActorRef(
    createMachineBehavior(machine, parent, options),
    name
  );
}

export function fromService<TContext, TEvent extends EventObject>(
  service: Interpreter<TContext, any, TEvent>,
  id: string = registry.bookId()
): ActorRef<TEvent> {
  return new ObservableActorRef(createServiceBehavior(service), id);
}

export class ObservableActorRef<TEvent extends EventObject, TEmitted>
  implements ActorRef<TEvent, TEmitted> {
  public ref;
  public initial: TEmitted;
  private context: ActorContext;
  private behavior: Behavior<TEvent, TEmitted>;
  public name: string;

  constructor(behavior: Behavior<TEvent, TEmitted>, name: string) {
    this.behavior = behavior;
    this.name = name;
    this.context = {
      self: this,
      name: this.name
    };
    this.ref = behavior;
    this.initial = behavior.initial;
  }
  public start() {
    this.behavior = this.behavior.receiveSignal(this.context, startSignal);
    return this;
  }
  public stop() {
    this.behavior = this.behavior.receiveSignal(this.context, stopSignal);
  }
  public subscribe(observer) {
    return this.behavior.subscribe?.(observer) || nullSubscription;
  }
  public send(event) {
    this.behavior = this.behavior.receive(this.context, event);
  }
}
