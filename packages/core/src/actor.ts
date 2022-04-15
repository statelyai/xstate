import {
  EventObject,
  SCXML,
  ActorRef,
  BaseActorRef,
  Behavior,
  ActorContext
} from './types';
import { LifecycleSignal, startSignal, stopSignal } from './actors';
import { symbolObservable, toSCXMLEvent } from './utils';
import { Mailbox } from './Mailbox';

const nullSubscription = {
  unsubscribe: () => void 0
};

export function isActorRef(item: any): item is ActorRef<any> {
  return !!item && typeof item === 'object' && typeof item.send === 'function';
}

export function isSpawnedActorRef(item: any): item is ActorRef<any> {
  return isActorRef(item) && 'name' in item;
}

export class Actor<TEvent extends EventObject, TEmitted> {
  public current: TEmitted;
  private context: ActorContext<TEvent, TEmitted>;
  private behavior: Behavior<TEvent, TEmitted>;
  private mailbox: Mailbox<TEvent | LifecycleSignal> = new Mailbox(
    this._process.bind(this)
  );

  public name: string;

  constructor(
    behavior: Behavior<TEvent, TEmitted>,
    name: string,
    actorContext: ActorContext<TEvent, TEmitted>
  ) {
    this.behavior = behavior;
    this.name = name;
    this.context = actorContext;
    this.current = behavior.initialState;
    this.mailbox.enqueue(startSignal);
  }
  public start() {
    this.mailbox.start();
    return this;
  }
  public stop() {
    // TODO: test this behavior
    this.mailbox.clear();
    this.mailbox.enqueue(stopSignal);
  }
  public subscribe(observer) {
    return this.behavior.subscribe?.(observer) || nullSubscription;
  }
  public receive(event: TEvent | LifecycleSignal) {
    this.mailbox.enqueue(event);
  }
  private _process(event: TEvent | LifecycleSignal) {
    this.context._event =
      typeof event.type !== 'string'
        ? (event as LifecycleSignal)
        : toSCXMLEvent(event as TEvent);

    this.current = this.behavior.transition(
      this.current,
      typeof this.context._event.type !== 'string'
        ? (this.context._event as LifecycleSignal)
        : (this.context._event as SCXML.Event<TEvent>).data,
      this.context
    );
  }
}

export function isSpawnedActor(item: any): item is ActorRef<any> {
  return isActorRef(item) && 'id' in item;
}

// TODO: refactor the return type, this could be written in a better way but it's best to avoid unneccessary breaking changes now
export function toActorRef<
  TEvent extends EventObject,
  TEmitted = any,
  TActorRefLike extends BaseActorRef<TEvent> = BaseActorRef<TEvent>
>(
  actorRefLike: TActorRefLike
): ActorRef<TEvent, TEmitted> & Omit<TActorRefLike, keyof ActorRef<any, any>> {
  return {
    subscribe: () => ({ unsubscribe: () => void 0 }),
    name: 'anonymous',
    getSnapshot: () => undefined,
    [symbolObservable]: function () {
      return this;
    },
    ...actorRefLike
  };
}
