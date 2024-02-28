import { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  Actor,
  AnyStateMachine,
  ActorOptions,
  Subscription,
  EventFrom,
  SnapshotFrom
} from 'xstate';
import { useActorRef } from './useActorRef.ts';

export class UseMachine<TMachine extends AnyStateMachine>
  implements ReactiveController
{
  private host: ReactiveControllerHost;
  private machine: TMachine;
  private options?: ActorOptions<TMachine>;
  private subscriptionProperty: string;
  private shouldUpdateSubscriptionProperty: boolean;
  private actorRef = {} as Actor<TMachine>;
  private subs: Subscription = { unsubscribe: () => {} };
  private currentSnapshot: SnapshotFrom<TMachine>;

  constructor(
    host: ReactiveControllerHost,
    {
      machine,
      options,
      subscriptionProperty = ''
    }: {
      machine: TMachine;
      options?: ActorOptions<TMachine>;
      subscriptionProperty?: string;
    }
  ) {
    this.machine = machine;
    this.options = options;
    this.subscriptionProperty = subscriptionProperty;
    this.shouldUpdateSubscriptionProperty = subscriptionProperty in host;
    this.currentSnapshot = this.snapshot;
    this.onNext = this.onNext.bind(this);

    (this.host = host).addController(this);
  }

  get actor() {
    return this.actorRef;
  }

  get snapshot() {
    return this.actorRef?.getSnapshot?.();
  }

  send(ev: EventFrom<TMachine>) {
    this.actorRef?.send(ev);
  }

  unsubscribe() {
    this.subs.unsubscribe();
  }

  protected updateSubscriptionProperty(snapshot: SnapshotFrom<TMachine>) {
    if (this.shouldUpdateSubscriptionProperty) {
      (this.host as unknown as Record<string, unknown>)[
        this.subscriptionProperty
      ] = snapshot;
    }
  }

  protected onNext(snapshot: SnapshotFrom<TMachine>) {
    if (this.currentSnapshot !== snapshot) {
      this.currentSnapshot = snapshot;
      this.updateSubscriptionProperty(snapshot);
      this.host.requestUpdate();
    }
  }

  private startService() {
    this.actorRef = useActorRef(this.machine, this.options);
    this.subs = this.actorRef?.subscribe(this.onNext);
    this.actorRef?.start();
  }

  private stopService() {
    this.actorRef?.stop();
  }

  hostConnected() {
    this.startService();
  }

  hostDisconnected() {
    this.stopService();
  }
}
