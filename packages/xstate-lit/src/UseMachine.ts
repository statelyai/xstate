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
  private callback?: (snapshot: SnapshotFrom<TMachine>) => void;
  private actorRef = {} as Actor<TMachine>;
  private subs: Subscription = { unsubscribe: () => {} };
  private currentSnapshot: SnapshotFrom<TMachine>;

  constructor(
    host: ReactiveControllerHost,
    {
      machine,
      options,
      callback
    }: {
      machine: TMachine;
      options?: ActorOptions<TMachine>;
      callback?: (snapshot: SnapshotFrom<TMachine>) => void;
    }
  ) {
    this.machine = machine;
    this.options = options;
    this.callback = callback;
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

  protected onNext(snapshot: SnapshotFrom<TMachine>) {
    if (this.currentSnapshot !== snapshot) {
      this.currentSnapshot = snapshot;
      this.callback?.(snapshot);
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
