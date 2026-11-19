import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  createStore,
  markRaw
} from 'solid-js';
import { Actor, AnyActorRef, SnapshotFrom, StateMachine } from 'xstate';

markRaw(Actor);
markRaw(StateMachine);

const noop = () => {};

/** @public */
export function fromActorRef<TActor extends AnyActorRef | undefined>(
  actorRef: Accessor<TActor> | TActor
): Accessor<
  | SnapshotFrom<NonNullable<TActor>>
  | (undefined extends TActor ? undefined : never)
> {
  const [snapshot, actorMemo] = snapshotStore(actorRef);
  const hasActor = createMemo(() => !!actorMemo());
  return (() => (hasActor() ? snapshot : undefined)) as any;
}

/** @internal */
export function snapshotStore(
  actorRef: Accessor<AnyActorRef | undefined> | AnyActorRef | undefined
) {
  const actorMemo = createMemo(() =>
    typeof actorRef === 'function' ? actorRef() : actorRef
  );

  const [latest, setLatest] = createSignal<{
    actor: AnyActorRef | undefined;
    snapshot: unknown;
  }>(
    { actor: undefined, snapshot: undefined },
    { ownedWrite: true, equals: false }
  );

  createEffect(
    () => actorMemo(),
    (currentActor) => {
      if (!currentActor) return;
      const update = () =>
        setLatest({
          actor: currentActor,
          snapshot: currentActor.getSnapshot()
        });
      const { unsubscribe } = currentActor.subscribe({
        next: update,
        error: update,
        complete: noop
      });
      update();
      return unsubscribe;
    }
  );

  const [snapshot] = createStore<any>(
    () => {
      const currentActor = actorMemo();
      if (!currentActor) return {};
      const current = latest();
      return current.actor === currentActor
        ? current.snapshot
        : currentActor.getSnapshot();
    },
    {},
    { key: null }
  );

  return [snapshot, actorMemo] as const;
}
