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

// Plain objects and arrays already prepared, mapped to what the store reads.
// XState treats snapshots as immutable, so a prepared value stays valid.
const prepared = new WeakMap<object, object>();

/**
 * Prepares a snapshot value for the store, without changing what it reads.
 *
 * - Class instances are marked to be served as they are, as Solid 1 stores
 *   did. Solid 2 stores wrap them, and a wrapped actor ref drops its own
 *   writes (its `subscribe` stops working).
 * - XState freezes context in development, and a store serves a frozen object
 *   as one value. A frozen object or array is copied so reads stay
 *   fine-grained, and so is any container holding a copy. In production
 *   nothing is frozen, so values pass through as they are: Solid 2 stores
 *   never write to the values they are given. Empty frozen records (XState
 *   shares one for empty `children`) have nothing to track and stay as they
 *   are.
 *
 * Results are cached by source, so an unchanged part of the next snapshot is
 * neither walked nor copied again and reconciles as unchanged.
 */
function toStoreValue(value: unknown): any {
  if (value === null || typeof value !== 'object') return value;
  const done = prepared.get(value);
  if (done) return done;
  if (!isPlainContainer(value)) {
    markRaw(value);
    prepared.set(value, value);
    return value;
  }
  const keys = Object.keys(value);
  const frozen = Object.isFrozen(value) && keys.length > 0;
  let copy: any = frozen ? (Array.isArray(value) ? [] : {}) : undefined;
  // Cached before the walk so circular references resolve to the result.
  prepared.set(value, copy ?? value);
  for (let i = 0; i < keys.length; i++) {
    const child = (value as any)[keys[i]];
    const next = toStoreValue(child);
    if (!copy && next !== child) {
      // A child was copied, so this container needs a copy that holds it.
      copy = Array.isArray(value) ? [] : {};
      prepared.set(value, copy);
      for (let j = 0; j < i; j++) {
        copy[keys[j]] = toStoreValue((value as any)[keys[j]]);
      }
    }
    if (copy) copy[keys[i]] = next;
  }
  return copy ?? value;
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
