import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  Snapshot,
  SnapshotFrom
} from 'xstate';
import {
  Injectable,
  Signal,
  signal,
  Type,
  WritableSignal
} from '@angular/core';
import { useSelector } from './useSelector.ts';
import { useActorRef } from './useActorRef.ts';

export function useActor<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  _options?: ActorOptions<TLogic> & { providedIn: 'root' }
): Type<ActorStoreProps<TLogic>> {
  const { providedIn, ...options } = _options ?? {};

  @Injectable({ providedIn: providedIn ?? null })
  class ActorStore implements ActorStoreProps<TLogic> {
    public actorRef: Actor<TLogic>;
    private _snapshot: WritableSignal<SnapshotFrom<TLogic>>;
    public send: Actor<TLogic>['send'];

    public get snapshot() {
      return this._snapshot.asReadonly();
    }

    constructor() {
      const listener = (nextSnapshot: Snapshot<unknown>) => {
        this._snapshot?.set(nextSnapshot as any);
      };

      this.actorRef = useActorRef(actorLogic, options, listener);
      this._snapshot = signal(useSelector(this.actorRef as any, (s) => s)());
      this.send = this.actorRef.send;
    }
  }
  return ActorStore;
}

export interface ActorStoreProps<TLogic extends AnyActorLogic> {
  actorRef: Actor<TLogic>;
  snapshot: Signal<SnapshotFrom<TLogic>>;
  send: Actor<TLogic>['send'];
}
