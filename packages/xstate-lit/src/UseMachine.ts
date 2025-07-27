import { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  Actor,
  AnyStateMachine,
  ActorOptions,
  createActor,
  EventFrom,
  Subscription,
  SnapshotFrom,
} from 'xstate';

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
      callback,
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

    (this.host = host).addController(this);
  }

  /**
   * The underlying ActorRef from XState
   */
  get actor() {
    return this.actorRef;
  }

  /**
   * The latest snapshot of the actor's state
   */
  get snapshot() {
    return this.actorRef?.getSnapshot?.();
  }

  /**
   * Send an event to the actor service
   * @param {import('xstate').EventFrom<typeof this.machine>} ev
   */
  send(ev: EventFrom<TMachine>) {
    this.actorRef?.send(ev);
  }

  unsubscribe() {
    this.subs.unsubscribe();
  }

  protected onNext = (snapshot: SnapshotFrom<TMachine>) => {
    if (this.currentSnapshot !== snapshot) {
      this.currentSnapshot = snapshot;
      this.callback?.(snapshot);
      this.host.requestUpdate();
    }
  };

  private startService() {
    this.actorRef = createActor(this.machine, this.options);
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
