import type { AnyActorSystem } from './system.ts';
import type {
  AnyActor,
  AnyEventObject,
  Snapshot,
  Subscription
} from './types.ts';

const emptySubscription: Subscription = { unsubscribe() {} };

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
 * trigger, observable interop, _processingStatus) are intentionally absent.
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
    // owns the child is the authority on completion staleness.
    sessionId: undefined as unknown as string,
    system,
    _parent: options.parent,
    // Round-trips through persistence; a remote handle cannot act on it
    // locally.
    _syncSnapshot: options.syncSnapshot ?? false,
    send(event: AnyEventObject) {
      void system.sendEvent(undefined, handle as unknown as AnyActor, event);
    },
    _send(event: AnyEventObject) {
      throw new Error(
        `Remote actor '${options.address}' has no local mailbox to receive "${event.type}". Its state lives with another runtime; install a runtime that can reach it (via \`createDurable\`'s \`systemRuntime\`, or \`system.runtime\`) before sending, or restore this snapshot with embedded children on the runtime that owns them.`
      );
    },
    getSnapshot(): Snapshot<undefined> {
      return remoteSnapshot;
    },
    getPersistedSnapshot(): undefined {
      return undefined;
    },
    start() {},
    _stop() {},
    subscribe(): Subscription {
      return emptySubscription;
    },
    on(): Subscription {
      return emptySubscription;
    },
    _isRunning() {
      return false;
    },
    toJSON() {
      return { address: options.address, src: options.src };
    }
  };
  handle.ref = handle as unknown as AnyActor;
  return handle as unknown as AnyActor;
}
