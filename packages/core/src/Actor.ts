import {
  EventObject,
  InvokeDefinition,
  AnyEventObject,
  Subscribable,
  SCXML,
  InvokeCallback,
  InterpreterOptions
} from './types';
import { State } from './State';
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

export type Sender<TEvent extends EventObject> = (event: TEvent) => void;

export interface ActorRef<TCurrent, TEvent extends EventObject, TRef = any> {
  send: Sender<TEvent>;
  ref: TRef;
  start: () => ActorRef<TCurrent, TEvent, TRef>;
  stop: () => void;
  id: string;
}

export function isActorRef(item: any): item is ActorRef<any, any> {
  try {
    return typeof item.send === 'function';
  } catch (e) {
    return false;
  }
}

export function fromObservable<T extends EventObject>(
  observable: Subscribable<T>,
  parent: ActorRef<any, any>,
  id: string
): ActorRef<T | undefined, never> {
  return new BehaviorActorRef(createObservableBehavior(observable, parent), id);
}

export function fromPromise<T>(
  promise: PromiseLike<T>,
  parent: ActorRef<any, any>,
  id: string
): ActorRef<T | undefined, never> {
  return new BehaviorActorRef(createPromiseBehavior(promise, parent), id);
}

export function fromCallback<
  TEmitted extends EventObject,
  TEvent extends EventObject
>(
  callback: InvokeCallback,
  parent: ActorRef<any, any>,
  id: string
): ActorRef<TEmitted | undefined, SCXML.Event<TEvent>> {
  return new BehaviorActorRef(createCallbackBehavior(callback, parent), id);
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
  return new BehaviorActorRef(
    createMachineBehavior(machine, parent, options),
    id
  );
}

export function fromService<TContext, TEvent extends EventObject>(
  service: Interpreter<TContext, any, TEvent>,
  id: string = registry.bookId()
): ActorRef<State<TContext, TEvent>, TEvent, typeof service> {
  return new BehaviorActorRef(createServiceBehavior(service), id);
}

export class BehaviorActorRef<TEvent extends EventObject>
  implements ActorRef<any, TEvent, any> {
  public ref;
  private context: ActorContext;
  constructor(public behavior: Behavior<TEvent>, public id: string) {
    this.context = {
      self: this,
      name: this.id
    };
    this.ref = behavior;
  }
  public start() {
    this.behavior = this.behavior.receiveSignal(this.context, startSignal);
    return this;
  }
  public stop() {
    this.behavior = this.behavior.receiveSignal(this.context, stopSignal);
  }
  public send(event) {
    this.behavior = this.behavior.receive(this.context, event);
  }
}
