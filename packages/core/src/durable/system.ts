import type {
  AnyActor,
  AnyEventObject,
  AnyMachineSnapshot,
  AnyStateMachine,
  CustomExecutableActionObject,
  EventFromLogic,
  ExecutableActionObject,
  InputFrom,
  Snapshot,
  SnapshotFrom
} from '../types.ts';
import { initialTransition, transition } from '../transition.ts';

export interface DurableActorRef {
  /** Stable logical identity for this actor incarnation. */
  id: string;
  /** Human-readable ID relative to the parent actor. */
  actorId: string;
}

export interface DurableActorRecord {
  ref: DurableActorRef;
  parent?: string;
  src?: string;
}

export interface DurableSystemSnapshot {
  root: string;
  nextActorId: number;
  actors: Record<string, DurableActorRecord>;
}

export interface DurableSystemState<TLogic extends AnyStateMachine> {
  snapshot: SnapshotFrom<TLogic>;
  system: DurableSystemSnapshot;
  nextTransitionIndex: number;
}

export interface PersistedDurableSystemState {
  snapshot: Snapshot<unknown>;
  system: DurableSystemSnapshot;
  nextTransitionIndex: number;
}

export interface DurableSystemEffectMetadata {
  id: string;
  transitionIndex: number;
  effectIndex: number;
}

export type DurableSystemEffect = DurableSystemEffectMetadata &
  (
    | { type: 'action'; actionType: string; params: unknown }
    | { type: 'event.emit'; source: DurableActorRef; event: AnyEventObject }
    | {
        type: 'actor.spawn';
        source: DurableActorRef;
        actor: DurableActorRef;
        src: string;
        input: unknown;
      }
    | { type: 'actor.start'; actor: DurableActorRef }
    | { type: 'actor.stop'; source: DurableActorRef; actor: DurableActorRef }
    | {
        type: 'actor.terminate';
        actor: DurableActorRef;
        status: 'done' | 'error';
        output: unknown;
        error: unknown;
      }
    | {
        type: 'event.send';
        source: DurableActorRef;
        target: DurableActorRef;
        event: AnyEventObject;
      }
    | {
        type: 'timer.schedule';
        source: DurableActorRef;
        target: DurableActorRef;
        timerId: string;
        delay: number;
        event: AnyEventObject;
      }
    | { type: 'timer.cancel'; source: DurableActorRef; timerId: string }
  );

export interface DurableSystemTransition<TLogic extends AnyStateMachine> {
  state: DurableSystemState<TLogic>;
  effects: DurableSystemEffect[];
  /** False when an event names an actor incarnation that is no longer live. */
  accepted: boolean;
}

export interface DurableSystemEffectExecutor {
  /**
   * Commits one effect. `executeAction` is present only for local action
   * effects and lets a host wrap execution in its durable step primitive.
   */
  execute(
    effect: DurableSystemEffect,
    executeAction?: () => void | PromiseLike<void>
  ): void | PromiseLike<void>;
}

export interface DurableSystem<TLogic extends AnyStateMachine> {
  initialTransition(
    ...[input]: undefined extends InputFrom<TLogic>
      ? [input?: InputFrom<TLogic>]
      : [input: InputFrom<TLogic>]
  ): DurableSystemTransition<TLogic>;
  transition(
    state: DurableSystemState<TLogic>,
    event: EventFromLogic<TLogic>
  ): DurableSystemTransition<TLogic>;
  /** Persists only the root machine. Suitable when it has no durable children. */
  getPersistedSnapshot(state: DurableSystemState<TLogic>): Snapshot<unknown>;
  /** Persists root state plus logical actor identity and effect ordering. */
  getPersistedSystemSnapshot(
    state: DurableSystemState<TLogic>
  ): PersistedDurableSystemState;
  restoreSnapshot(
    snapshot: Snapshot<unknown>,
    options?: { transitionIndex?: number }
  ): DurableSystemState<TLogic>;
  restoreSystemSnapshot(
    persisted: PersistedDurableSystemState
  ): DurableSystemState<TLogic>;
  /** Executes the local implementation captured by an `action` effect. */
  executeAction(effect: DurableSystemEffect): void | PromiseLike<void>;
  /** Executes effects in plan order, awaiting each host operation. */
  executeEffects(
    effects: readonly DurableSystemEffect[],
    executor: DurableSystemEffectExecutor
  ): Promise<void>;
}

const rootRef: DurableActorRef = { id: 'root:0', actorId: 'root' };

function createInitialSystemSnapshot(): DurableSystemSnapshot {
  return {
    root: rootRef.id,
    nextActorId: 1,
    actors: { [rootRef.id]: { ref: rootRef } }
  };
}

function cloneSystemSnapshot(
  snapshot: DurableSystemSnapshot
): DurableSystemSnapshot {
  return {
    root: snapshot.root,
    nextActorId: snapshot.nextActorId,
    actors: Object.fromEntries(
      Object.entries(snapshot.actors).map(([id, record]) => [
        id,
        { ...record, ref: { ...record.ref } }
      ])
    )
  };
}

function getChildren(snapshot: unknown): Record<string, AnyActor | undefined> {
  return snapshot && typeof snapshot === 'object' && 'children' in snapshot
    ? ((snapshot as AnyMachineSnapshot).children as Record<
        string,
        AnyActor | undefined
      >)
    : {};
}

function bindSnapshotActors(
  snapshot: unknown,
  system: DurableSystemSnapshot,
  refs: Map<AnyActor, DurableActorRef>,
  parent: DurableActorRef
): void {
  for (const [actorId, actor] of Object.entries(getChildren(snapshot))) {
    if (!actor) {
      continue;
    }
    const record = Object.values(system.actors).find(
      (candidate) =>
        candidate.parent === parent.id && candidate.ref.actorId === actorId
    );
    if (!record) {
      continue;
    }
    refs.set(actor, record.ref);
    bindSnapshotActors(actor.getSnapshot(), system, refs, record.ref);
  }
}

function deleteActorTree(system: DurableSystemSnapshot, actorId: string): void {
  for (const [id, record] of Object.entries(system.actors)) {
    if (record.parent === actorId) {
      deleteActorTree(system, id);
    }
  }
  delete system.actors[actorId];
}

function isActorLifecycleEvent(event: AnyEventObject): boolean {
  return (
    event.type === 'xstate.done.actor' ||
    event.type === 'xstate.error.actor' ||
    event.type === 'xstate.snapshot.actor' ||
    event.type === 'xstate.timeout.actor'
  );
}

/**
 * Creates a pure durable actor-system planner.
 *
 * Unlike `ActorSystemRuntime`, this API never exposes live actors to the host.
 * Effects use serializable logical refs whose generations survive restore.
 *
 * @experimental
 */
export function createDurableSystem<TLogic extends AnyStateMachine>(
  logic: TLogic
): DurableSystem<TLogic> {
  const executableActions = new WeakMap<
    DurableSystemEffect,
    CustomExecutableActionObject
  >();

  const plan = (
    snapshot: SnapshotFrom<TLogic>,
    previousSnapshot: SnapshotFrom<TLogic> | undefined,
    previousSystem: DurableSystemSnapshot,
    transitionIndex: number,
    executableEffects: ExecutableActionObject[]
  ): DurableSystemTransition<TLogic> => {
    const system = cloneSystemSnapshot(previousSystem);
    const refs = new Map<AnyActor, DurableActorRef>();
    const root = system.actors[system.root].ref;
    if (previousSnapshot) {
      bindSnapshotActors(previousSnapshot, system, refs, root);
    }

    const refFor = (actor: AnyActor | undefined): DurableActorRef => {
      if (!actor || !actor._parent) {
        return root;
      }
      const ref = refs.get(actor);
      if (!ref) {
        throw new Error(`Actor '${actor.id}' has no durable logical identity.`);
      }
      return ref;
    };

    const normalizeValue = (value: unknown): any => {
      if (!value || typeof value !== 'object') {
        return value;
      }
      const actorRef = refs.get(value as AnyActor);
      if (actorRef) {
        return actorRef;
      }
      if ('sessionId' in value && 'send' in value && 'ref' in value) {
        return refFor(value as unknown as AnyActor);
      }
      if (Array.isArray(value)) {
        return value.map(normalizeValue);
      }
      if (Object.getPrototypeOf(value) !== Object.prototype) {
        return value;
      }
      return Object.fromEntries(
        Object.entries(value).map(([key, child]) => [
          key,
          normalizeValue(child)
        ])
      );
    };

    const effects: DurableSystemEffect[] = [];
    for (const [effectIndex, effect] of executableEffects.entries()) {
      const metadata = {
        id: `${transitionIndex}:${effectIndex}`,
        transitionIndex,
        effectIndex
      };
      let normalized: DurableSystemEffect;

      if (effect.kind === 'action') {
        normalized = {
          ...metadata,
          type: 'action',
          actionType: effect.type,
          params: normalizeValue(effect.params)
        };
        executableActions.set(normalized, effect);
        effects.push(normalized);
        continue;
      }
      if (effect.kind === 'emit') {
        effects.push({
          ...metadata,
          type: 'event.emit',
          source: refFor(effect.source),
          event: normalizeValue(effect.event)
        });
        continue;
      }

      switch (effect.type) {
        case '@xstate.spawn': {
          if (typeof effect.src !== 'string') {
            throw new Error(
              `Durable actor '${effect.id}' must use a registered string source.`
            );
          }
          const source = refFor(effect.source);
          const actor: DurableActorRef = {
            id: `${effect.id}:${system.nextActorId++}`,
            actorId: effect.id
          };
          system.actors[actor.id] = {
            ref: actor,
            parent: source.id,
            src: effect.src
          };
          refs.set(effect.actor, actor);
          normalized = {
            ...metadata,
            type: 'actor.spawn',
            source,
            actor,
            src: effect.src,
            input: normalizeValue(effect.input)
          };
          break;
        }
        case '@xstate.start':
          normalized = {
            ...metadata,
            type: 'actor.start',
            actor: refFor(effect.actor)
          };
          break;
        case '@xstate.stop': {
          const actor = refFor(effect.actor);
          normalized = {
            ...metadata,
            type: 'actor.stop',
            source: refFor(effect.source),
            actor
          };
          deleteActorTree(system, actor.id);
          break;
        }
        case '@xstate.terminate':
          normalized = {
            ...metadata,
            type: 'actor.terminate',
            actor: refFor(effect.actor),
            status: effect.status,
            output: normalizeValue(effect.output),
            error: normalizeValue(effect.error)
          };
          break;
        case '@xstate.raise':
          normalized = {
            ...metadata,
            type: 'timer.schedule',
            source: refFor(effect.source),
            target: refFor(effect.source),
            timerId: effect.id!,
            delay: effect.delay ?? 0,
            event: normalizeValue(effect.event)
          };
          break;
        case '@xstate.sendTo':
          normalized =
            effect.delay === undefined
              ? {
                  ...metadata,
                  type: 'event.send',
                  source: refFor(effect.source),
                  target: refFor(effect.target),
                  event: normalizeValue(effect.event)
                }
              : {
                  ...metadata,
                  type: 'timer.schedule',
                  source: refFor(effect.source),
                  target: refFor(effect.target),
                  timerId: effect.id!,
                  delay: effect.delay,
                  event: normalizeValue(effect.event)
                };
          break;
        case '@xstate.cancel':
          normalized = {
            ...metadata,
            type: 'timer.cancel',
            source: refFor(effect.source),
            timerId: effect.id
          };
          break;
      }
      effects.push(normalized);
    }

    return {
      state: {
        snapshot,
        system,
        nextTransitionIndex: transitionIndex + 1
      },
      effects,
      accepted: true
    };
  };

  const durable: DurableSystem<TLogic> = {
    initialTransition(...[input]) {
      const [snapshot, effects] = initialTransition(logic, input as never);
      return plan(
        snapshot,
        undefined,
        createInitialSystemSnapshot(),
        0,
        effects
      );
    },
    transition(state, event) {
      let resolvedEvent = event as AnyEventObject;
      if (
        isActorLifecycleEvent(resolvedEvent) &&
        typeof resolvedEvent.sessionId === 'string' &&
        typeof resolvedEvent.actorId === 'string'
      ) {
        const record = state.system.actors[resolvedEvent.sessionId];
        const child = getChildren(state.snapshot)[resolvedEvent.actorId];
        if (
          !record ||
          record.parent !== state.system.root ||
          record.ref.actorId !== resolvedEvent.actorId ||
          !child
        ) {
          return { state, effects: [], accepted: false };
        }
        resolvedEvent = { ...resolvedEvent, sessionId: child.sessionId };
      }
      const [snapshot, effects] = transition(
        logic,
        state.snapshot,
        resolvedEvent as EventFromLogic<TLogic>
      );
      return plan(
        snapshot,
        state.snapshot,
        state.system,
        state.nextTransitionIndex,
        effects
      );
    },
    getPersistedSnapshot(state) {
      return logic.getPersistedSnapshot(state.snapshot);
    },
    getPersistedSystemSnapshot(state) {
      return {
        snapshot: logic.getPersistedSnapshot(state.snapshot),
        system: cloneSystemSnapshot(state.system),
        nextTransitionIndex: state.nextTransitionIndex
      };
    },
    restoreSnapshot(snapshot, options) {
      const restored = logic.restoreSnapshot!(snapshot, undefined);
      if (Object.keys(getChildren(restored)).length) {
        throw new Error(
          'Machine-only durable snapshots cannot restore child actor identities; use getPersistedSystemSnapshot().'
        );
      }
      return {
        snapshot: restored,
        system: createInitialSystemSnapshot(),
        nextTransitionIndex: options?.transitionIndex ?? 0
      };
    },
    restoreSystemSnapshot(persisted) {
      return {
        snapshot: logic.restoreSnapshot!(persisted.snapshot, undefined),
        system: cloneSystemSnapshot(persisted.system),
        nextTransitionIndex: persisted.nextTransitionIndex
      };
    },
    executeAction(effect) {
      const executable = executableActions.get(effect);
      if (!executable) {
        throw new Error(
          `Durable effect '${effect.id}' is not executable here.`
        );
      }
      return executable.exec();
    },
    async executeEffects(effects, executor) {
      for (const effect of effects) {
        await executor.execute(
          effect,
          effect.type === 'action'
            ? () => durable.executeAction(effect)
            : undefined
        );
      }
    }
  };

  return durable;
}
