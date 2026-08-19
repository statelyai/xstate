import { getActorIdPrefix } from './system.ts';
import type {
  AnyActor,
  AnyActorLogic,
  ExecutableActionObject
} from './types.ts';

/**
 * A serializable view of an executable effect. Actor references are replaced
 * by their logical addresses and actor sources by their registered source
 * keys, so a durable host can journal, deduplicate, and route effects without
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
      source: string | undefined;
      actor: string;
      id: string;
      src: string;
      input: unknown;
    }
  | {
      kind: 'builtin';
      type: '@xstate.start';
      source: string | undefined;
      actor: string;
      id: string;
    }
  | {
      kind: 'builtin';
      type: '@xstate.raise';
      source: string;
      event: unknown;
      id: string | undefined;
      delay: number | undefined;
    }
  | {
      kind: 'builtin';
      type: '@xstate.sendTo';
      source: string;
      target: string;
      event: unknown;
      id: string | undefined;
      delay: number | undefined;
    }
  | {
      kind: 'builtin';
      type: '@xstate.cancel';
      source: string;
      id: string;
    }
  | {
      kind: 'builtin';
      type: '@xstate.stop';
      source: string;
      actor: string;
      id: string;
    }
  | {
      kind: 'builtin';
      type: '@xstate.terminate';
      source: string;
      actor: string;
      id: string;
      status: 'done' | 'error';
      output: unknown;
      error: unknown;
    }
  | {
      kind: 'emit';
      type: string;
      source: string;
      event: unknown;
    }
  | {
      kind: 'action';
      type: string;
      params: unknown;
    };

function addressOf(actor: AnyActor | undefined): string | undefined {
  return actor?.address;
}

// `src` is only a unique key for registered sources; anonymous inline logic
// collapses to its logic id or 'x'. The `actor` address is the identity field.
function srcKeyOf(src: string | AnyActorLogic): string {
  return typeof src === 'string' ? src : getActorIdPrefix(src);
}

/**
 * Returns the serializable descriptor for an executable effect: the same
 * discriminants (`kind`, `type`) with actor references replaced by logical
 * addresses and actor sources by source keys. Payload fields pass through by
 * reference.
 *
 * @experimental
 */
export function getEffectDescriptor(
  effect: ExecutableActionObject
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
      source: effect.source.address,
      event: effect.event
    };
  }

  switch (effect.type) {
    case '@xstate.spawn':
      return {
        kind: 'builtin',
        type: '@xstate.spawn',
        source: addressOf(effect.source),
        actor: effect.actor.address,
        id: effect.id,
        src: srcKeyOf(effect.src),
        input: effect.input
      };
    case '@xstate.start':
      return {
        kind: 'builtin',
        type: '@xstate.start',
        source: addressOf(effect.source),
        actor: effect.actor.address,
        id: effect.id
      };
    case '@xstate.raise':
      return {
        kind: 'builtin',
        type: '@xstate.raise',
        source: effect.source.address,
        event: effect.event,
        id: effect.id,
        delay: effect.delay
      };
    case '@xstate.sendTo':
      return {
        kind: 'builtin',
        type: '@xstate.sendTo',
        source: effect.source.address,
        target: effect.target.address,
        event: effect.event,
        id: effect.id,
        delay: effect.delay
      };
    case '@xstate.cancel':
      return {
        kind: 'builtin',
        type: '@xstate.cancel',
        source: effect.source.address,
        id: effect.id
      };
    case '@xstate.stop':
      return {
        kind: 'builtin',
        type: '@xstate.stop',
        source: effect.source.address,
        actor: effect.actor.address,
        id: effect.id
      };
    case '@xstate.terminate':
      return {
        kind: 'builtin',
        type: '@xstate.terminate',
        source: effect.source.address,
        actor: effect.actor.address,
        id: effect.id,
        status: effect.status,
        output: effect.output,
        error: effect.error
      };
  }
}
