import { Cause, Context, Effect, Exit, Scope } from 'effect';
import type { AnyActor, AnyActorRef } from 'xstate';

export interface EffectHost {
  /** The Effect context captured by `createEffectActor`, including the actor scope. */
  readonly context: Context.Context<never>;
  /** A scope that closes when the root actor stops. */
  readonly scope: Scope.Closeable;
  readonly interruptors: Map<AnyActorRef, Set<() => void>>;
  readonly subscriptions: Map<AnyActorRef, { unsubscribe(): void }>;
}

const effectHosts = new WeakMap<object, EffectHost>();

export function createEffectHost(
  context: Context.Context<never>,
  scope: Scope.Closeable
): EffectHost {
  return {
    context,
    scope,
    interruptors: new Map(),
    subscriptions: new Map()
  };
}

export function bindEffectHost(actor: AnyActorRef, host: EffectHost): void {
  effectHosts.set(actor, host);
}

function findEffectHost(actor: AnyActorRef): EffectHost | undefined {
  let current: (AnyActorRef & { _parent?: AnyActorRef }) | undefined =
    actor as AnyActorRef & {
      _parent?: AnyActorRef;
    };

  while (current) {
    const host = effectHosts.get(current);
    if (host) {
      return host;
    }
    current = current._parent as
      | (AnyActorRef & { _parent?: AnyActorRef })
      | undefined;
  }

  return undefined;
}

function requireEffectHost(actor: AnyActorRef): EffectHost {
  const host = findEffectHost(actor);
  if (!host) {
    throw new Error(
      'Effect-backed actor logic must be created with createEffectActor().'
    );
  }
  return host;
}

function untrackEffect(
  actor: AnyActorRef,
  host: EffectHost,
  interrupt: () => void
): void {
  const interruptors = host.interruptors.get(actor);
  if (!interruptors) {
    return;
  }

  interruptors.delete(interrupt);
  if (interruptors.size === 0) {
    host.interruptors.delete(actor);
    host.subscriptions.get(actor)?.unsubscribe();
    host.subscriptions.delete(actor);
  }
}

function cleanupActorEffects(actor: AnyActorRef, host: EffectHost): void {
  const interruptors = host.interruptors.get(actor);
  if (interruptors) {
    host.interruptors.delete(actor);
    for (const interrupt of interruptors) {
      interrupt();
    }
  }

  host.subscriptions.get(actor)?.unsubscribe();
  host.subscriptions.delete(actor);
}

function trackEffect(
  actor: AnyActorRef,
  host: EffectHost,
  interrupt: () => void
): void {
  let interruptors = host.interruptors.get(actor);
  if (!interruptors) {
    interruptors = new Set();
    host.interruptors.set(actor, interruptors);
    host.subscriptions.set(
      actor,
      actor.subscribe({
        error: () => cleanupActorEffects(actor, host),
        complete: () => cleanupActorEffects(actor, host)
      })
    );
  }
  interruptors.add(interrupt);
}

/**
 * Runs an Effect in the actor's host context. The Effect is interrupted when
 * the actor stops or when the returned function is called; `onExit` is not
 * called after that.
 */
export function startHostedEffect<A, E>(
  actor: AnyActorRef,
  effect: Effect.Effect<A, E, any>,
  onExit: (exit: Exit.Exit<A, E>) => void
): () => void {
  const host = requireEffectHost(actor);
  let active = true;
  const traced = Effect.withSpan(effect, 'xstate.effect', {
    attributes: {
      'xstate.actor.id': (actor as AnyActor).id,
      'xstate.actor.address': (actor as AnyActor).address
    }
  }) as Effect.Effect<A, E, never>;
  const cancel = () => {
    if (!active) {
      return;
    }
    active = false;
    untrackEffect(actor, host, cancel);
    interrupt();
  };
  const interrupt = Effect.runCallbackWith(host.context)(traced, {
    onExit: (exit) => {
      if (!active) {
        return;
      }
      active = false;
      untrackEffect(actor, host, cancel);
      onExit(exit);
    }
  });
  if (active) {
    trackEffect(actor, host, cancel);
  }

  return cancel;
}

/**
 * Runs an Effect in the actor's host context and settles when it exits.
 * Interruption settles without error; failures and defects reject with the
 * squashed cause so the actor's error handling can observe them.
 */
export function runHostedEffect<A, E>(
  actor: AnyActorRef,
  effect: Effect.Effect<A, E, any>
): PromiseLike<void> {
  return new Promise<void>((resolve, reject) => {
    startHostedEffect(actor, effect, (exit) => {
      if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) {
        resolve();
      } else {
        // Effect failures are arbitrary values, not necessarily Errors.
        // oxlint-disable-next-line typescript/prefer-promise-reject-errors
        reject(Cause.squash(exit.cause));
      }
    });
  });
}

export function closeEffectHost(host: EffectHost): void {
  Effect.runFork(Scope.close(host.scope, Exit.void));
}

export function relayToParent(
  actor: AnyActorRef,
  event: { type: string; [key: string]: unknown }
): void {
  const actorWithParent = actor as AnyActor & { _parent?: AnyActor };
  if (actorWithParent._parent) {
    (actor as AnyActor).system._relay(
      actorWithParent,
      actorWithParent._parent,
      event
    );
  }
}
