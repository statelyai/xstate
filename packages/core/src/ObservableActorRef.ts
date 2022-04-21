import { EventObject, ActorRef, Behavior, SCXML, ActorContext } from './types';
import { symbolObservable, toSCXMLEvent } from './utils';
import { Mailbox } from './Mailbox';
import { LifecycleSignal, startSignal, stopSignal } from './actors';

const nullSubscription = {
  unsubscribe: () => void 0
};

export class ObservableActorRef<TEvent extends EventObject, TEmitted>
  implements ActorRef<TEvent, TEmitted> {
  private current: TEmitted;
  public deferred = true;
  private context: ActorContext<TEvent, TEmitted>;
  private mailbox = new Mailbox(this._process.bind(this));

  constructor(
    private behavior: Behavior<TEvent, TEmitted>,
    public name: string
  ) {
    this.context = {
      self: this,
      name: this.name,
      observers: new Set(),
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
    return this.behavior.subscribe?.(observer) ?? nullSubscription;
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
