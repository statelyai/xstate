import { Cause, Context, Effect, Exit, Fiber } from 'effect';
import type { AnyActor, AnyActorRef } from 'xstate';

export interface EffectHost {
  readonly context: Context.Context<any>;
  readonly fibers: Map<AnyActorRef, Set<Fiber.Fiber<any, any>>>;
  readonly subscriptions: Map<AnyActorRef, { unsubscribe(): void }>;
}

const effectHosts = new WeakMap<object, EffectHost>();

export function createEffectHost(context: Context.Context<any>): EffectHost {
  return {
    context,
    fibers: new Map(),
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
  fiber: Fiber.Fiber<any, any>
): void {
  const fibers = host.fibers.get(actor);
  if (!fibers) {
    return;
  }

  fibers.delete(fiber);
  if (fibers.size === 0) {
    host.fibers.delete(actor);
    host.subscriptions.get(actor)?.unsubscribe();
    host.subscriptions.delete(actor);
  }
}

function cleanupActorEffects(actor: AnyActorRef, host: EffectHost): void {
  const fibers = host.fibers.get(actor);
  if (fibers) {
    for (const fiber of fibers) {
      fiber.interruptUnsafe();
    }
    host.fibers.delete(actor);
  }

  host.subscriptions.get(actor)?.unsubscribe();
  host.subscriptions.delete(actor);
}

function trackEffect(
  actor: AnyActorRef,
  host: EffectHost,
  fiber: Fiber.Fiber<any, any>
): void {
  let fibers = host.fibers.get(actor);
  if (!fibers) {
    fibers = new Set();
    host.fibers.set(actor, fibers);
    host.subscriptions.set(
      actor,
      actor.subscribe({
        error: () => cleanupActorEffects(actor, host),
        complete: () => cleanupActorEffects(actor, host)
      })
    );
  }
  fibers.add(fiber);
}

export function startHostedEffect<A, E>(
  actor: AnyActorRef,
  effect: Effect.Effect<A, E, any>,
  onExit: (exit: Exit.Exit<A, E>) => void
): () => void {
  const host = requireEffectHost(actor);
  const fiber = Effect.runForkWith(host.context)(effect);
  trackEffect(actor, host, fiber);

  let active = true;
  const removeObserver = fiber.addObserver((exit) => {
    if (!active) {
      return;
    }
    active = false;
    untrackEffect(actor, host, fiber);
    onExit(exit);
  });

  return () => {
    if (!active) {
      return;
    }
    active = false;
    removeObserver();
    untrackEffect(actor, host, fiber);
    fiber.interruptUnsafe();
  };
}

export function runHostedEffect<A, E>(
  actor: AnyActorRef,
  effect: Effect.Effect<A, E, any>
): PromiseLike<void> {
  const host = requireEffectHost(actor);
  const fiber = Effect.runForkWith(host.context)(effect);
  trackEffect(actor, host, fiber);
  fiber.addObserver(() => untrackEffect(actor, host, fiber));

  return Effect.runPromiseExit(Fiber.join(fiber)).then((exit) => {
    untrackEffect(actor, host, fiber);
    if (Exit.isSuccess(exit) || Cause.hasInterruptsOnly(exit.cause)) {
      return;
    }
    throw Cause.squash(exit.cause);
  });
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
