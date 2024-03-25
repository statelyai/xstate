import {
  Actor,
  ActorOptions,
  AnyActorLogic,
  Snapshot,
  SnapshotFrom,
  isActorLogic
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

export interface UseActorConfig {
  providedIn: 'root';
}

export function useActor<TLogic extends AnyActorLogic>(
  provided: UseActorConfig,
  actorLogic: TLogic,
  options?: ActorOptions<TLogic>
): Type<ActorStoreProps<TLogic>>;
export function useActor<TLogic extends AnyActorLogic>(
  actorLogic: TLogic,
  options?: ActorOptions<TLogic>
): Type<ActorStoreProps<TLogic>>;
export function useActor<TLogic extends AnyActorLogic>(
  providedInOrActor: UseActorConfig | TLogic,
  actorLogicOrOptions?: TLogic | ActorOptions<TLogic>,
  _options?: ActorOptions<TLogic>
): Type<ActorStoreProps<TLogic>> {
  const providedIn =
    'providedIn' in providedInOrActor ? providedInOrActor.providedIn : null;

  const [actorLogic, options] = (
    isActorLogic(providedInOrActor)
      ? [providedInOrActor, actorLogicOrOptions]
      : [actorLogicOrOptions, _options]
  ) as [TLogic, ActorOptions<TLogic>];

  @Injectable({ providedIn })
  class ActorStore implements ActorStoreProps<TLogic> {
    public actorRef: Actor<TLogic>;
    private _snapshot: WritableSignal<SnapshotFrom<TLogic>>;
    public send: Actor<TLogic>['send'];

    public get snapshot() {
      return this._snapshot.asReadonly();
    }
    //
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
