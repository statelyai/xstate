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
  createDeferredBehavior,
  createPromiseBehavior,
  createObservableBehavior,
  LifecycleSignal
} from './behavior';
import { registry } from './registry';
import { ObservableActorRef } from './ObservableActorRef';

const nullSubscription = {
  unsubscribe: () => void 0
};

export function isActorRef(item: any): item is ActorRef<any> {
  return !!item && typeof item === 'object' && typeof item.send === 'function';
}

export function fromObservable<T extends EventObject>(
  observable: Subscribable<T>,
  parent: ActorRef<any>,
  name: string
): ActorRef<never> {
  return new ObservableActorRef(
    createObservableBehavior(() => observable, parent),
    name
  );
}

export function fromPromise<T>(
  promise: PromiseLike<T>,
  parent: ActorRef<any>,
  name: string
): ActorRef<never> {
  return new ObservableActorRef(
    createPromiseBehavior(() => promise, parent),
    name
  );
}

export function fromCallback<TEvent extends EventObject>(
  callback: InvokeCallback,
  parent: ActorRef<any>,
  name: string
): ActorRef<SCXML.Event<TEvent>> {
  return new ObservableActorRef(
    createDeferredBehavior(() => callback, parent),
    name
  );
}

export function fromMachine<TContext, TEvent extends EventObject>(
  machine: MachineNode<TContext, TEvent>,
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
  service: Interpreter<TContext, TEvent>,
  name: string = registry.bookId()
): ActorRef<TEvent> {
  return new ObservableActorRef(createServiceBehavior(service), name);
}

enum ProcessingStatus {
  NotProcessing,
  Processing
}

export class Actor<TEvent extends EventObject, TEmitted> {
  public current: TEmitted;
  private context: ActorContext;
  private behavior: Behavior<TEvent, TEmitted>;
  private mailbox: TEvent[] = [];
  private processingStatus: ProcessingStatus = ProcessingStatus.NotProcessing;
  public name: string;

  constructor(
    behavior: Behavior<TEvent, TEmitted>,
    name: string,
    actorContext: ActorContext
  ) {
    this.behavior = behavior;
    this.name = name;
    this.context = actorContext;
    this.current = behavior.initial;
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
  public receive(event) {
    this.mailbox.push(event);
    if (this.processingStatus === ProcessingStatus.NotProcessing) {
      this.flush();
    }
  }
  public receiveSignal(signal: LifecycleSignal) {
    this.behavior = this.behavior.receiveSignal(this.context, signal);
    return this;
  }
  private flush() {
    this.processingStatus = ProcessingStatus.Processing;
    while (this.mailbox.length) {
      const event = this.mailbox.shift()!;

      this.behavior = this.behavior.receive(this.context, event);
    }
    this.processingStatus = ProcessingStatus.NotProcessing;
  }
}
