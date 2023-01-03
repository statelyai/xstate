import {
  AnyBehavior,
  ActorRef,
  InternalStateFrom,
  ActorContext,
  EventFrom,
  SnapshotFrom
} from '../types';

export class Actor<TBehavior extends AnyBehavior>
  implements ActorRef<TBehavior> {
  private state: InternalStateFrom<TBehavior>;
  private behavior: TBehavior;
  private observers: Set<any> = new Set();
  private actorContext: ActorContext<TBehavior> = {
    self: this
  };

  constructor(behavior: TBehavior) {
    this.behavior = behavior;
    this.state = behavior.initialState;
  }

  public start(restoredState?: InternalStateFrom<TBehavior>) {
    const preInitialState = restoredState ?? this.state;
    const initialState = this.behavior.start
      ? this.behavior.start(preInitialState, this.actorContext)
      : preInitialState;
  }

  public send(event: EventFrom<TBehavior>): void {
    const nextState = this.behavior.transition(
      this.state,
      event,
      this.actorContext
    );
    this.update(nextState);
  }

  private update(state: InternalStateFrom<TBehavior>) {
    this.state = state;
    this.observers.forEach((observer) => observer.next(state));
  }

  public stop() {
    this.observers.forEach((observer) => observer.complete());
    this.observers.clear();
  }

  public subscribe(observerOrFn: any) {
    const observer =
      typeof observerOrFn === 'function'
        ? { next: observerOrFn }
        : observerOrFn;
    this.observers.add(observer);
    return {
      unsubscribe: () => {
        this.observers.delete(observer);
      }
    };
  }

  public getSnapshot(): SnapshotFrom<TBehavior> {
    return this.behavior.getSnapshot(this.state);
  }
}
