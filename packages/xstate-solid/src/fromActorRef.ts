import {
  Accessor,
  createEffect,
  createMemo,
  createSignal,
  createStore
} from 'solid-js';
import { AnyActorRef, SnapshotFrom } from 'xstate';

const noop = () => {};

const isPlainContainer = (value: object) => {
  if (Array.isArray(value)) return true;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const walked = new WeakSet<object>();

// Solid 2 stores wrap class instances, and a wrapped actor ref drops its own
// writes, so they are marked raw.
function toStoreValue(value: unknown): any {
  if (value === null || typeof value !== 'object' || walked.has(value)) {
    return value;
  }
  walked.add(value);
  if (!isPlainContainer(value)) {
    markRaw(value);
    return value;
  }
  for (const key of Object.keys(value)) toStoreValue((value as any)[key]);
  return value;
}

// solid-js has no public markRaw; a shallow store marks its values raw.
function markRaw(value: object) {
  try {
    createStore([value], { shallow: true });
  } catch {
    // already wrapped elsewhere
  }
}

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
      return toStoreValue(
        current.actor === currentActor
          ? current.snapshot
          : currentActor.getSnapshot()
      );
    },
    {},
    { key: null }
  );

  return [snapshot, actorMemo] as const;
}
