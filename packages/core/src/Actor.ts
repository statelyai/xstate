import {
  EventObject,
  Subscribable,
  SCXML,
  InvokeCallback,
  InterpreterOptions,
  Spawnable
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
import { State } from './State';

export type Sender<TEvent extends EventObject> = (event: TEvent) => void;

export interface ActorRef<TEvent extends EventObject, TEmitted = any>
  extends Subscribable<TEmitted> {
  send: Sender<TEvent>;
  ref: any;
  start: () => ActorRef<TEvent>;
  stop: () => void;
  /**
   * The initial emitted value.
   */
  initial: TEmitted;
  id: string;
}

export type ActorRefFrom<T extends Spawnable> = T extends MachineNode<
  infer TC,
  any,
  infer TE
>
  ? ActorRef<TE, State<TC, TE>>
  : ActorRef<any, any>; // TODO: expand

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
  id: string
): ActorRef<never> {
  return new ObservableActorRef(
    createObservableBehavior(observable, parent),
    id
  );
}

export function fromPromise<T>(
  promise: PromiseLike<T>,
  parent: ActorRef<any>,
  id: string
): ActorRef<never> {
  return new ObservableActorRef(createPromiseBehavior(promise, parent), id);
}

export function fromCallback<TEvent extends EventObject>(
  callback: InvokeCallback,
  parent: ActorRef<any>,
  id: string
): ActorRef<SCXML.Event<TEvent>> {
  return new ObservableActorRef(createCallbackBehavior(callback, parent), id);
}

export function fromMachine<TContext, TEvent extends EventObject>(
  machine: MachineNode<TContext, any, TEvent>,
  parent: ActorRef<any>,
  id: string,
  options?: Partial<InterpreterOptions>
): ActorRef<TEvent> {
  return new ObservableActorRef(
    createMachineBehavior(machine, parent, options),
    id
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

  constructor(public behavior: Behavior<TEvent, TEmitted>, public id: string) {
    this.context = {
      self: this,
      name: this.id
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
    return this.behavior.subscribe?.(observer);
  }
  public send(event) {
    this.behavior = this.behavior.receive(this.context, event);
  }
}
