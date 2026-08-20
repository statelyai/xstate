import { ACTOR_REF_TYPE } from './createActor.ts';
import type { AnyActorSystem } from './system.ts';
import type {
  AnyActor,
  AnyEventObject,
  Snapshot,
  Subscription
} from './types.ts';

const emptySubscription: Subscription = { unsubscribe() {} };

const restoreHint =
  'or restore this snapshot with embedded children on the runtime that owns them.';

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
  const handle = {
    _remote: true as const,
    // Self-reference so context persistence recognizes the handle as an
    // actor reference instead of recursing into it.
    ref: undefined as unknown as AnyActor,
    id: options.id,
    address: options.address,
    src: options.src,
    registryKey: options.registryKey,
    // A remote handle does not know the child's incarnation; the runtime that
    // owns the child is the authority on completion staleness — unless the
    // host supplied an incarnation token, which lets this side drop stale
    // completions and lets journaled sends name the intended incarnation.
    sessionId: undefined as unknown as string,
    _incarnation: options.incarnation,
    system,
    _parent: options.parent,
    // Round-trips through persistence verbatim (undefined stays undefined,
    // so re-persisting is byte-stable); a remote handle cannot act on it
    // locally.
    _syncSnapshot: options.syncSnapshot,
    send(event: AnyEventObject) {
      void system.sendEvent(undefined, ref, event);
    },
    _send(event: AnyEventObject) {
      throw new Error(
        `Remote actor '${options.address}' has no local mailbox to receive "${event.type}". Its state lives with another runtime; install a runtime that can reach it (via \`createDurable\`'s adapter runtime operations, or \`system.runtime\`) before sending, ${restoreHint}`
      );
    },
    getSnapshot(): Snapshot<undefined> {
      return remoteSnapshot;
    },
    getPersistedSnapshot(): never {
      throw new Error(
        `Cannot persist remote actor '${options.address}' from here: its state lives with the runtime that owns it. Persist it there, ${restoreHint}`
      );
    },
    start() {},
    _stop() {},
    stop() {
      throw new Error(
        `Cannot stop remote actor '${options.address}' directly: stopping is a co-located operation. Stop it through the system runtime that owns it (\`system.stopActor(ref)\`), ${restoreHint}`
      );
    },
    select() {
      throw new Error(
        `Cannot select from remote actor '${options.address}': its snapshot is not synchronously readable because its state lives with another runtime. Read it on the runtime that owns it, ${restoreHint}`
      );
    },
    get trigger(): never {
      throw new Error(
        `Remote actor '${options.address}' has no \`trigger\` shorthand: it requires a co-located actor. Use \`send(...)\`, which routes through the system runtime.`
      );
    },
    // Observation is a co-location capability: a remote handle never emits,
    // so subscriptions are inert rather than errors — generic observers may
    // attach to any ref.
    subscribe(): Subscription {
      return emptySubscription;
    },
    on(): Subscription {
      return emptySubscription;
    },
    _isRunning() {
      return false;
    },
    // The same shape Actor.toJSON produces, so serialized snapshots carry
    // one actor-reference marker whether a child is co-located or remote.
    toJSON() {
      return {
        xstate$type: ACTOR_REF_TYPE,
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
