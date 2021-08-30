import { ReactiveController, ReactiveControllerHost } from 'lit';
import { ActorRef, Subscribable, Subscription } from 'xstate';
import { getSnapshot } from './utils';

export const defaultCompare = (a, b) => a === b;

export class SelectorController<
  TActor extends ActorRef<any, any>,
  T,
  TEmitted = TActor extends Subscribable<infer Emitted> ? Emitted : never
> implements ReactiveController {
  private host: ReactiveControllerHost;
  private subscription: Subscription;
  private _selected: T;

  constructor(
    host: ReactiveControllerHost,
    actorRef: TActor,
    selector: (emitted: TEmitted) => T,
    compare: (a: T, b: T) => boolean = defaultCompare
  ) {
    this.host = host;
    this.host.addController(this);

    this._selected = selector(getSnapshot(actorRef));

    this.subscription = actorRef.subscribe((emitted) => {
      const nextSelected = selector(emitted);
      if (!compare(this._selected, nextSelected)) {
        this._selected = nextSelected;
        this.host.requestUpdate();
      }
    });
  }

  selected() {
    return this._selected;
  }

  hostDisconnected() {
    this.subscription.unsubscribe();
  }
}

export function connectSelector<
  TActor extends ActorRef<any, any>,
  T,
  TEmitted = TActor extends Subscribable<infer Emitted> ? Emitted : never
>(
  host: ReactiveControllerHost,
  actorRef: TActor,
  selector: (emitted: TEmitted) => T,
  compare: (a: T, b: T) => boolean = defaultCompare
) {
  return new SelectorController(host, actorRef, selector, compare);
}
