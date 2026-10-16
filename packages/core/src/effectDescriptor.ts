import { isRemoteActorRef, isSerializedActorRef } from './remoteActorRef.ts';
import { getActorIdPrefix } from './system.ts';
import type {
  AnyActor,
  ExecutableEffect,
  SerializedActorRef
} from './types.ts';

/**
 * A serializable view of an executable effect. Actor references are replaced
 * by `{ $actor: address, incarnation? }` and actor sources by their registered
 * source keys, so a durable host can journal, deduplicate, and route effects without
 * holding live actor references. Payload fields (`event`, `input`, `params`,
 * `output`, `error`) pass through by reference and are only as serializable
 * as their values.
 *
 * @experimental
 */
export type EffectDescriptor =
  | {
      kind: 'builtin';
      type: '@xstate.spawn';
      source: SerializedActorRef | undefined;
      actor: SerializedActorRef;
      id: string;
      src: string;
      input: unknown;
    }
  | {
      kind: 'builtin';
      type: '@xstate.start';
      source: SerializedActorRef | undefined;
      actor: SerializedActorRef;
      id: string;
    }
  | {
      kind: 'builtin';
      type: '@xstate.raise';
      source: SerializedActorRef;
      event: unknown;
      id: string | undefined;
      delay: number | undefined;
    }
  | {
      kind: 'builtin';
      type: '@xstate.sendTo';
      source: SerializedActorRef;
      target: SerializedActorRef | undefined;
      event: unknown;
      id: string | undefined;
      delay: number | undefined;
    }
  | {
      kind: 'builtin';
      type: '@xstate.cancel';
      source: SerializedActorRef;
      id: string;
    }
  | {
      kind: 'builtin';
      type: '@xstate.stop';
      source: SerializedActorRef;
      actor: SerializedActorRef;
      id: string;
    }
  | {
      kind: 'builtin';
      type: '@xstate.terminate';
      source: SerializedActorRef;
      actor: SerializedActorRef;
      id: string;
      status: 'done' | 'error';
      output: unknown;
      error: unknown;
    }
  | {
      kind: 'builtin';
      type: '@xstate.deadLetter';
      source: SerializedActorRef | undefined;
      target: SerializedActorRef | undefined;
      event: unknown;
      reason: string;
      issues: unknown;
      error: unknown;
    }
  | {
      kind: 'emit';
      type: string;
      source: SerializedActorRef;
      event: unknown;
    }
  | {
      kind: 'action';
      type: string;
      params: unknown;
    };

/**
 * A remote handle carries the host-supplied incarnation token; a local
 * actor's sessionId identifies one process-local incarnation and is omitted
 * so descriptors stay deterministic across replays.
 */
function toRef(actor: AnyActor | SerializedActorRef): SerializedActorRef {
  if (isSerializedActorRef(actor)) {
    return { ...actor };
  }
  const incarnation = isRemoteActorRef(actor as any)
    ? actor.sessionId
    : undefined;
  return incarnation === undefined
    ? { $actor: (actor as any).address }
    : { $actor: (actor as any).address, incarnation };
}

/**
 * Returns the serializable descriptor for an executable effect: the same
 * discriminants (`kind`, `type`) with actor references replaced by
 * `{ $actor: address, incarnation? }` and actor sources by source keys. Payload fields pass through by
 * reference.
 *
 * @experimental
 */
export function getEffectDescriptor(
  effect: ExecutableEffect
): EffectDescriptor {
  if (effect.kind === 'action') {
    return {
      kind: 'action',
      type: effect.type,
      params: effect.params
    };
  }

  if (effect.kind === 'emit') {
    return {
      kind: 'emit',
      type: effect.type,
      source: toRef(effect.source),
      event: effect.event
    };
  }

  switch (effect.type) {
    case '@xstate.spawn':
      return {
        kind: 'builtin',
        type: '@xstate.spawn',
        source: effect.source && toRef(effect.source),
        actor: toRef(effect.actor),
        id: effect.id,
        // `src` is only a unique key for registered sources; anonymous inline
        // logic collapses to its logic id or 'x'. The `actor` address is the
        // identity field.
        src: getActorIdPrefix(effect.src),
        input: effect.input
      };
    case '@xstate.start':
      return {
        kind: 'builtin',
        type: '@xstate.start',
        source: effect.source && toRef(effect.source),
        actor: toRef(effect.actor),
        id: effect.id
      };
    case '@xstate.raise':
      return {
        kind: 'builtin',
        type: '@xstate.raise',
        source: toRef(effect.source),
        event: effect.event,
        id: effect.id,
        delay: effect.delay
      };
    case '@xstate.sendTo':
      return {
        kind: 'builtin',
        type: '@xstate.sendTo',
        source: toRef(effect.source),
        target: effect.target && toRef(effect.target),
        event: effect.event,
        id: effect.id,
        delay: effect.delay
      };
    case '@xstate.cancel':
      return {
        kind: 'builtin',
        type: '@xstate.cancel',
        source: toRef(effect.source),
        id: effect.id
      };
    case '@xstate.stop':
      return {
        kind: 'builtin',
        type: '@xstate.stop',
        source: toRef(effect.source),
        actor: toRef(effect.actor),
        id: effect.id
      };
    case '@xstate.terminate':
      return {
        kind: 'builtin',
        type: '@xstate.terminate',
        source: toRef(effect.source),
        actor: toRef(effect.actor),
        id: effect.id,
        status: effect.status,
        output: effect.output,
        error: effect.error
      };
    case '@xstate.deadLetter':
      return {
        kind: 'builtin',
        type: '@xstate.deadLetter',
        source: effect.source && toRef(effect.source),
        target: effect.target && toRef(effect.target),
        event: effect.event,
        reason: effect.reason,
        issues: effect.detail?.issues,
        error: effect.detail?.error
      };
  }
}
