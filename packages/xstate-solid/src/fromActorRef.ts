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

// Values already walked. XState treats snapshots as immutable, so an
// unchanged part of the next snapshot is not walked again.
const walked = new WeakSet<object>();

/**
 * Prepares a snapshot for the store without copying anything: the store
 * reads the snapshot's own objects (Solid 2 stores never write to their
 * sources, and frozen objects wrap like any other, so XState's development
 * freeze stays fine-grained).
 *
 * Class instances are marked to be served as they are, as Solid 1 stores
 * did. Solid 2 stores wrap them, and a wrapped actor ref drops its own writes
 * (its `subscribe` stops working).
 */
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

/**
 * Marks a value so no store wraps it. `solid-js` has no public `markRaw`;
 * a value that passes through a shallow store stays raw in every store.
 */
function markRaw(value: object) {
  try {
    createStore([value], { shallow: true });
  } catch {
    // Already wrapped by a deep store elsewhere; it stays wrapped.
  }
}

/** @public */
export function fromActorRef<TActor extends AnyActorRef | undefined>(
  actorRef: Accessor<TActor> | TActor
): Accessor<
  | SnapshotFrom<NonNullable<TActor>>
  | (undefined extends TActor ? undefined : never)
> {
  const actorMemo = createMemo(() =>
    typeof actorRef === 'function' ? actorRef() : actorRef
  );

  // The latest snapshot, tagged with the actor that emitted it so a switch to
  // another actor never shows the previous actor's snapshot. The actor emits
  // from wherever `send` runs, which can be inside an owned scope (a
  // component body or an effect), hence `ownedWrite`.
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
      // Catch up with anything emitted before the subscription.
      update();
      return unsubscribe;
    }
  );

  // A deep store keeps reads fine-grained: `snapshot.context.todos[0].done`
  // only notifies when that value changes. Each snapshot is reconciled in
  // positionally, and `toStoreValue` keeps actor refs, the machine and other
  // class instances as the real objects.
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

  // Only defined/undefined changes reach readers: switching from one actor to
  // another reconciles into the same store.
  const hasActor = createMemo(() => !!actorMemo());

  return (() => (hasActor() ? snapshot : undefined)) as any;
}
