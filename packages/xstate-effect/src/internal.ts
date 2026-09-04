import { Cause, Context, Effect, Exit, type Fiber, Scope } from 'effect';
import type { AnyActor, AnyActorRef } from 'xstate';

export interface EffectHost {
  /** The Effect context captured by `createEffectActor`, including the actor scope. */
  readonly context: Context.Context<never>;
  /** A scope that closes when the root actor stops. */
  readonly scope: Scope.Closeable;
  /** The fiber running the scope's finalizers once the scope has closed. */
  closing?: Fiber.Fiber<void>;
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

type DeclaringMachine = {
  sources?: { actors?: Record<string, unknown> };
  idMap?: Map<string, { invoke?: Array<{ id?: string }> }>;
};

/**
 * Rejects Effect logic that a machine spawned inline. Only declared actors
 * (`setup({ actors })`) and `invoke` sources are visible to
 * `RequirementsFrom`, so anything else would infer `R = never` and fail
 * later with a missing service.
 *
 * A spawned declared actor carries its registered key as `src`; an invoked
 * child carries the id of the `invoke` entry that created it.
 */
function assertDeclaredLogic(actor: AnyActorRef): void {
  const self = actor as AnyActor & { logic?: unknown };
  const parent = self._parent;
  const machine = parent?.logic as DeclaringMachine | undefined;
  if (!machine?.sources || !machine.idMap || typeof self.src === 'string') {
    return;
  }

  if (Object.values(machine.sources.actors ?? {}).includes(self.logic)) {
    return;
  }
  for (const stateNode of machine.idMap.values()) {
    for (const definition of stateNode.invoke ?? []) {
      if (definition.id === self.id) {
        return;
      }
    }
  }

  throw new Error(
    `Effect logic spawned by "${parent!.id}" must be declared in setup({ actors }). Spawn a declared actor instead, for example enq.spawn(args.actors.name).`
  );
}

function requireEffectHost(actor: AnyActorRef): EffectHost {
  assertDeclaredLogic(actor);
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
        passive: true,
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
 *
 * This mirrors how Effect's own `unstable/reactivity` bridges callback code:
 * `Effect.runCallbackWith` with the captured services, and a synchronous
 * interruptor kept per actor.
 */
export function startHostedEffect<A, E>(
  actor: AnyActorRef,
  effect: Effect.Effect<A, E>,
  spanName: string,
  onExit: (exit: Exit.Exit<A, E>) => void
): () => void {
  const host = requireEffectHost(actor);
  let active = true;
  const traced = Effect.withSpan(
    spanName,
    {
      attributes: {
        'xstate.actor.id': (actor as AnyActor).id,
        'xstate.actor.address': (actor as AnyActor).address
      }
    },
    { captureStackTrace: false }
  )(effect);
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
  effect: Effect.Effect<A, E>,
  spanName: string
): PromiseLike<void> {
  return new Promise<void>((resolve, reject) => {
    startHostedEffect(actor, effect, spanName, (exit) => {
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

/**
 * Closes the host scope immediately and runs its finalizers, with the host's
 * services, on a fiber that `createEffectActor`'s release can await.
 */
export function closeEffectHost(host: EffectHost): void {
  const finalizers = Scope.closeUnsafe(host.scope, Exit.void);
  if (finalizers) {
    host.closing = Effect.runForkWith(host.context)(finalizers);
  }
}

/**
 * Delivers a stream item to the parent as an event. This runs outside a
 * transition, so it uses the system relay like core's observable logic does.
 */
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
