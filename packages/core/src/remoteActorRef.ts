import type { AnyActorSystem } from './system.ts';
import type {
  AnyActor,
  AnyEventObject,
  Snapshot,
  Subscription
} from './types.ts';

const emptySubscription: Subscription = { unsubscribe() {} };

/** A placeholder snapshot for state owned by a remote actor. */
const remoteSnapshot: Snapshot<undefined> = {
  status: 'active',
  output: undefined,
  error: undefined
};

/** @internal */
export function isRemoteActorRef(actorRef: AnyActor): boolean {
  return (actorRef as { _remote?: boolean })._remote === true;
}

/**
 * Creates a location-transparent handle to an actor whose state lives with
 * another runtime. The handle is constructed from identity alone — no lookup
 * — and every send routes through the system's runtime; its state is not
 * synchronously readable.
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
  }
): AnyActor {
  const handle = {
    _remote: true as const,
    id: options.id,
    address: options.address,
    src: options.src,
    registryKey: options.registryKey,
    // A remote handle does not know the child's incarnation; the runtime that
    // owns the child is the authority on completion staleness.
    sessionId: undefined as unknown as string,
    system,
    _parent: options.parent,
    _syncSnapshot: false,
    send(event: AnyEventObject) {
      void system.sendEvent(undefined, handle as unknown as AnyActor, event);
    },
    _send(event: AnyEventObject) {
      throw new Error(
        `Remote actor '${options.address}' has no local mailbox; deliver "${event.type}" through a runtime that can reach it.`
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
  return handle as unknown as AnyActor;
}
