import {
  EventObject,
  ActorRef,
  Behavior,
  SCXML,
  ActorContext,
  Observer
} from './types';
import { symbolObservable, toSCXMLEvent } from './utils';
import { Mailbox } from './Mailbox';
import { LifecycleSignal, startSignal, stopSignal } from './actors';

export class ObservableActorRef<TEvent extends EventObject, TSnapshot>
  implements ActorRef<TEvent, TSnapshot> {
  private current: TSnapshot;
  public deferred = true;
  private context: ActorContext<TEvent, TSnapshot>;
  private mailbox = new Mailbox(this._process.bind(this));
  private _observers = new Set<Observer<TSnapshot>>();

  constructor(
    private behavior: Behavior<TEvent, TSnapshot>,
    public name: string
  ) {
    this.context = {
      self: this,
      name: this.name,
      observers: this._observers,
      _event: toSCXMLEvent({ type: 'xstate.init' }) as SCXML.Event<TEvent> // TODO: fix
    };
    this.current = this.behavior.initialState;
  }
  public start() {
    this.deferred = false;
    this.mailbox.enqueue(startSignal);
    this.mailbox.start();

    return this;
  }
  public stop() {
    this.mailbox.clear();
    this.mailbox.enqueue(stopSignal);
    return this;
  }
  public subscribe(observer) {
    this._observers.add(observer);

    return {
      unsubscribe: () => {
        this._observers.delete(observer);
      }
    };
  }
  public send(event) {
    this.receive(event);
  }
  public toJSON() {
    return {
      name: this.name,
      current: this.current
    };
  }
  public getSnapshot() {
    return this.current;
  }
  public [symbolObservable]() {
    return this;
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
