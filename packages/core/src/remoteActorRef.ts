import type { AnyActorSystem } from './system.ts';
import type {
  AnyActor,
  AnyEventObject,
  Snapshot,
  Subscription
} from './types.ts';

const emptySubscription: Subscription = { unsubscribe() {} };
const noop = () => {};
const subscribe = () => emptySubscription;

/** @internal */
export function isRemoteActorRef(actorRef: AnyActor): boolean {
  return (actorRef as { _remote?: boolean })._remote === true;
}

/**
 * The lifecycle-only snapshot a remote handle exposes. `active` is accurate
 * by construction: a completion removes the child from its parent's
 * `children`, so a handle only exists while the child is presumed active,
 * and the terminal result arrives as a completion event instead of a
 * snapshot. Full snapshots are a co-location capability.
 */
const remoteSnapshot: Snapshot<undefined> = Object.freeze({
  status: 'active' as const,
  output: undefined,
  error: undefined
});

/**
 * Creates a location-transparent handle to an actor whose state lives with
 * another runtime. The handle is constructed from identity alone — no lookup
 * — and every send routes through the system's runtime; its state is not
 * synchronously readable.
 *
 * The surface is deliberately minimal: it covers every member the runtime
 * reaches for a restored child (send/_send, lifecycle via start/_stop and
 * system.stopActor, persistence, subscribe/on as inert subscriptions).
 * Members that only make sense for a co-located actor (public stop(),
 * select(), trigger) throw a descriptive error rather than being absent, so
 * calling one reports what went wrong instead of a bare TypeError. Observable
 * interop and _processingStatus are omitted entirely.
 *
 * @internal
 */
export function createRemoteActorRef(
  system: AnyActorSystem,
  options: {
    id: string;
    address: string;
    src: string;
    parent: AnyActor | undefined;
    registryKey?: string;
    syncSnapshot?: boolean;
    incarnation?: string;
  }
): AnyActor {
  const fail = (): never => {
    throw new Error(
      `'${options.address}' is a remote actor; this requires a co-located actor.`
    );
  };
  const handle = {
    _remote: true as const,
    // Self-reference so context persistence recognizes the handle as an
    // actor reference instead of recursing into it.
    ref: undefined as unknown as AnyActor,
    id: options.id,
    address: options.address,
    src: options.src,
    registryKey: options.registryKey,
    // The host-supplied incarnation token, when present: the owner's
    // sessionId for this child, letting this side drop stale completions and
    // journaled sends name the intended incarnation. Without one the handle
    // does not know the child's incarnation and the owning runtime is the
    // authority on staleness.
    sessionId: options.incarnation as string,
    system,
    _parent: options.parent,
    // Round-trips through persistence verbatim (undefined stays undefined,
    // so re-persisting is byte-stable); a remote handle cannot act on it
    // locally.
    _syncSnapshot: options.syncSnapshot,
    send(event: AnyEventObject) {
      void system.sendEvent(undefined, ref, event);
    },
    _send(_event: AnyEventObject) {
      fail();
    },
    getSnapshot(): Snapshot<undefined> {
      return remoteSnapshot;
    },
    getPersistedSnapshot(): never {
      return fail();
    },
    start: noop,
    _stop: noop,
    stop() {
      fail();
    },
    select() {
      fail();
    },
    get trigger(): never {
      return fail();
    },
    // Observation is a co-location capability: a remote handle never emits,
    // so subscriptions are inert rather than errors — generic observers may
    // attach to any ref.
    subscribe,
    on: subscribe,
    _isRunning() {
      return false;
    },
    // The same shape Actor.toJSON produces, so serialized snapshots carry
    // one actor-reference marker whether a child is co-located or remote.
    toJSON() {
      return {
        xstate$type: 'actorRef',
        id: options.id,
        address: options.address,
        src: options.src
      };
    }
  };
  const ref = handle as unknown as AnyActor;
  handle.ref = ref;
  return ref;
}
