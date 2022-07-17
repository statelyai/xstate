import {
  EventObject,
  ActorRef,
  Behavior,
  SCXML,
  ActorContext,
  Observer
} from './types';
import { toObserver, toSCXMLEvent } from './utils';
import { symbolObservable } from './symbolObservable';
import { Mailbox } from './Mailbox';
import { LifecycleSignal, startSignal, stopSignal } from './actors';

export class ObservableActorRef<TEvent extends EventObject, TSnapshot>
  implements ActorRef<TEvent, TSnapshot> {
  private current: TSnapshot;
  private context: ActorContext<TEvent, TSnapshot>;
  private mailbox = new Mailbox(this._process.bind(this));
  private _observers = new Set<Observer<TSnapshot>>();

  constructor(
    private behavior: Behavior<TEvent, TSnapshot>,
    public name: string
  ) {
    // @ts-ignore
    this.context = {
      self: this,
      name: this.name,
      _event: toSCXMLEvent({ type: 'xstate.init' }) as SCXML.Event<TEvent> // TODO: fix
    };
    this.current = this.behavior.initialState;
  }
  public start() {
    this.mailbox.prepend(startSignal);
    this.mailbox.start();

    return this;
  }
  public stop() {
    this.mailbox.clear();
    this.mailbox.enqueue(stopSignal);
    return this;
  }
  public subscribe(observer) {
    const resolved = toObserver(observer);
    this._observers.add(resolved);

    return {
      unsubscribe: () => {
        this._observers.delete(resolved);
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
  private receive(event: TEvent | LifecycleSignal) {
    this.mailbox.enqueue(event);
  }
  private _process(event: TEvent | LifecycleSignal) {
    this.context._event =
      typeof event.type !== 'string'
        ? (event as LifecycleSignal)
        : toSCXMLEvent(event as TEvent);

    const previous = this.current;

    this.current = this.behavior.transition(
      this.current,
      typeof this.context._event.type !== 'string'
        ? (this.context._event as LifecycleSignal)
        : (this.context._event as SCXML.Event<TEvent>).data,
      this.context
    );

    if (previous !== this.current) {
      const current = this.current;
      this._observers.forEach((observer) => observer.next?.(current));
    }
  }
}
