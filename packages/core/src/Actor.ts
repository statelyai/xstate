import {
  EventObject,
  Subscribable,
  SCXML,
  InvokeCallback,
  InterpreterOptions,
  ActorRef,
  SpawnedActorRef,
  Lazy
} from './types';
import { MachineNode } from './MachineNode';
import { State } from './State';
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
  createBehaviorFrom,
  LifecycleSignal
} from './behavior';
import { registry } from './registry';
import * as capturedState from './capturedState';
import { ObservableActorRef } from './ObservableActorRef';

const nullSubscription = {
  unsubscribe: () => void 0
};

export function isActorRef(item: any): item is ActorRef<any> {
  return !!item && typeof item === 'object' && typeof item.send === 'function';
}

export function isSpawnedActorRef(item: any): item is SpawnedActorRef<any> {
  return isActorRef(item) && 'name' in item;
}

export function fromObservable<T extends EventObject>(
  observable: Subscribable<T>,
  name: string
): ActorRef<never> {
  return new ObservableActorRef(
    createObservableBehavior(() => observable),
    name
  );
}

export function fromPromise<T>(
  promise: PromiseLike<T>,
  name: string
): ActorRef<never> {
  return new ObservableActorRef(
    createPromiseBehavior(() => promise),
    name
  );
}

export function fromCallback<TEvent extends EventObject>(
  callback: InvokeCallback,
  name: string
): ActorRef<SCXML.Event<TEvent>> {
  return new ObservableActorRef(
    createDeferredBehavior(() => callback),
    name
  );
}

export function fromMachine<TContext, TEvent extends EventObject>(
  machine: MachineNode<TContext, TEvent>,
  name: string,
  options?: Partial<InterpreterOptions>
): ActorRef<TEvent> {
  return new ObservableActorRef(createMachineBehavior(machine, options), name);
}

export function fromService<TContext, TEvent extends EventObject>(
  service: Interpreter<TContext, TEvent, any>,
  name: string = registry.bookId()
): SpawnedActorRef<TEvent> {
  return new ObservableActorRef(createServiceBehavior(service), name);
}

export function spawn<TReceived extends EventObject, TEmitted>(
  behavior: Behavior<TReceived, TEmitted>,
  // TODO: use more universal uniqueid)
  name: string = registry.bookId()
) {
  const actorRef = new ObservableActorRef(behavior, name);
  return capturedState.captureSpawn(actorRef, name);
}

export function spawnPromise<T>(
  lazyPromise: Lazy<PromiseLike<T>>,
  name?: string
) {
  return spawn(createPromiseBehavior(lazyPromise), name);
}

export function spawnObservable<T extends EventObject>(
  lazyObservable: Lazy<Subscribable<T>>,
  name?: string
) {
  return spawn(createObservableBehavior(lazyObservable), name);
}

export function spawnMachine(
  machine: MachineNode<any, any, any>,
  name?: string
) {
  return spawn(createMachineBehavior(machine), name);
}

export function spawnCallback(callback: InvokeCallback, name?: string) {
  return spawn(
    createDeferredBehavior(() => callback),
    name
  );
}

export function spawnFrom<TEvent extends EventObject, TEmitted>(
  entity: PromiseLike<TEmitted>,
  name?: string
): ObservableActorRef<TEvent, TEmitted>;
export function spawnFrom<TEvent extends EventObject, TEmitted>(
  entity: Subscribable<any>,
  name?: string
): ObservableActorRef<any, TEmitted>;
export function spawnFrom<
  TEvent extends EventObject,
  TEmitted extends State<any, any>
>(
  entity: MachineNode<TEmitted['context'], any, TEmitted['event']>,
  name?: string
): ObservableActorRef<TEvent, TEmitted>;
export function spawnFrom<TEvent extends EventObject>(
  entity: InvokeCallback,
  name?: string
): ObservableActorRef<TEvent, undefined>;
export function spawnFrom(entity: any): ObservableActorRef<any, any> {
  return spawn(createBehaviorFrom(entity));
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

export function isSpawnedActor(item: any): item is SpawnedActorRef<any> {
  return isActorRef(item) && 'id' in item;
}
