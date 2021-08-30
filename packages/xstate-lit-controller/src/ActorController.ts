import { ReactiveController, ReactiveControllerHost } from 'lit';
import { ActorRef, Subscription } from 'xstate';
import { getSnapshot } from './utils';

export class ActorController<TActor extends ActorRef<any, any>>
  implements ReactiveController {
  private host: ReactiveControllerHost;
  private actorRef: TActor;
  private subscription: Subscription;
  private _state: TActor extends ActorRef<any, infer TEmitted>
    ? TEmitted
    : never;

  constructor(host: ReactiveControllerHost, actorRef: TActor) {
    this.host = host;
    this.actorRef = actorRef;
    this.host.addController(this);

    this._state = getSnapshot(this.actorRef);

    this.subscription = this.actorRef.subscribe((emitted) => {
      this._state = emitted;
      this.host.requestUpdate();
    });
  }

  get state() {
    return this._state;
  }

  get send() {
    return this.actorRef.send;
  }

  hostDisconnected() {
    this.subscription.unsubscribe();
  }
}

export function connectActor<TActor extends ActorRef<any, any>>(
  host: ReactiveControllerHost,
  actorRef: TActor
) {
  return new ActorController(host, actorRef);
}
