import type { AnyActorSystem } from './system.ts';
import type {
  AnyActor,
  AnyEventObject,
  SerializedActorRef,
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
 * @internal Whether a send target is an actor reference that went through
 * JSON (`actor.toJSON()`): plain data carrying an address, not an actor.
 */
export function isSerializedActorRef(
  target: unknown
): target is SerializedActorRef {
  if (
    typeof target !== 'object' ||
    target === null ||
    Array.isArray(target) ||
    typeof (target as SerializedActorRef).$actor !== 'string'
  ) {
    return false;
  }
  for (const key in target) {
    if (key !== '$actor' && key !== 'incarnation') {
      return false;
    }
  }
  const incarnation = (target as SerializedActorRef).incarnation;
  return incarnation === undefined || typeof incarnation === 'string';
}

/** @internal The actor id that the last segment of an address encodes. */
export function getAddressId(address: string): string {
  const segment = address.slice(address.lastIndexOf('/') + 1);
  return segment.includes('%')
    ? segment.replaceAll('%2F', '/').replaceAll('%25', '%')
    : segment;
}

/** @internal The error reported when no live actor has a serialized address. */
export function createMissingAddressError(target: SerializedActorRef): Error {
  return new Error(
    target.incarnation === undefined
      ? `Unable to send event to actor '${target.$actor}': no live actor has that address`
      : `Unable to send event to actor '${target.$actor}' (incarnation '${target.incarnation}'): no live actor has that address and incarnation`
  );
}

/**
 * @internal The live actor a serialized ref names: the actor at its address,
 * and, when the ref carries an `incarnation`, only that incarnation. A ref
 * without one follows whichever actor is live at the address.
 */
export function resolveSerializedActorRef(
  system: { _getByAddress?: (address: string) => AnyActor | undefined },
  target: SerializedActorRef
): AnyActor | undefined {
  const live = system._getByAddress?.(target.$actor);
  return live &&
    (target.incarnation === undefined || live.sessionId === target.incarnation)
    ? live
    : undefined;
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
 * Creates the inert ref `enq.spawn(...)` returns while a transition is only
 * evaluated (for example by `snapshot.can(...)`, or to resolve conflicting
 * transitions) and no actor is created. It carries the identity the spawn
 * would get, accepts and drops events, exposes the same lifecycle-only
 * snapshot as a remote handle, and serializes like any actor ref. Its address
 * is unknown when the evaluating scope is detached from the parent actor.
 *
 * @internal
 */
export function createInertActorRef(options: {
  id: string;
  address: string | undefined;
  src: string | undefined;
}): AnyActor {
  const { id, address } = options;
  const handle = {
    ref: undefined as unknown as AnyActor,
    id,
    address,
    src: options.src,
    sessionId: undefined,
    send() {},
    getSnapshot(): Snapshot<undefined> {
      return remoteSnapshot;
    },
    subscribe(): Subscription {
      return emptySubscription;
    },
    on(): Subscription {
      return emptySubscription;
    },
    toJSON(): SerializedActorRef {
      if (address === undefined) {
        throw new Error(
          `Cannot serialize actor ref '${id}': it was returned by a spawn during speculative transition evaluation, which creates no actor and has no parent address.`
        );
      }
      return { $actor: address };
    }
  };
  const ref = handle as unknown as AnyActor;
  handle.ref = ref;
  return ref;
}

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
    // one actor-reference shape whether a child is co-located or remote.
    toJSON(): SerializedActorRef {
      return { $actor: options.address };
    }
  };
  const ref = handle as unknown as AnyActor;
  handle.ref = ref;
  return ref;
}
