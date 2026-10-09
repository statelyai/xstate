import { createMachineSnapshot, isMachineSnapshot } from './State.ts';
import { createDoneActorEvent, createErrorActorEvent } from './eventUtils.ts';
import { encodeAddressSegment, getActorIdPrefix } from './system.ts';
import { finalizeTransitionResult } from './transitionActions.ts';
import { parseDelayToMilliseconds } from './delay.ts';
import { TimeoutError } from './actors/promise.ts';
import { systemLogicMetadata } from './systemLogicMetadata.ts';
import { listenerLogic } from './actors/listener.ts';
import { subscriptionLogic } from './actors/subscription.ts';
import { matchesEventDescriptor } from './utils.ts';
import { IndexedHeap } from './IndexedHeap.ts';
import type {
  AnyActor,
  AnyActorLogic,
  AnyActorScope,
  AnyEventObject,
  ExecutableActionObject,
  InputFrom
} from './types.ts';

/** Immutable definitions for a pure actor system. @experimental */
export interface SystemLogic<TLogic extends AnyActorLogic = AnyActorLogic> {
  readonly root: TLogic;
  /** Additional definitions used by dynamically spawned actors. */
  readonly actors?: Readonly<Record<string, AnyActorLogic>>;
  /** Stable names for callable external effects; implementations are never run here. */
  readonly effects?: Readonly<Record<string, (...args: any[]) => unknown>>;
  /** Pure, named event/snapshot mappers used by listen and subscribeTo. */
  readonly mappers?: Readonly<
    Record<string, (...args: any[]) => AnyEventObject>
  >;
}

/** An actor identity, without a live actor or runtime. @experimental */
export interface SystemActorReference {
  readonly $actor: string;
  readonly incarnation: number;
}

/** Actor state and topology in a system snapshot. @experimental */
export interface SystemActorState {
  readonly id: string;
  readonly address: string;
  readonly incarnation: number;
  readonly logic: string;
  readonly logicVersion?: string;
  readonly parent?: SystemActorReference;
  readonly registryKey?: string;
  readonly syncSnapshot?: boolean;
  readonly started: boolean;
  readonly input: unknown;
  readonly snapshot: Readonly<Record<string, any>>;
}

/** An accepted message waiting for a completed actor macrostep. @experimental */
export interface SystemMessage {
  readonly source?: SystemActorReference;
  readonly target: SystemActorReference;
  readonly event: AnyEventObject;
  readonly sequence: number;
  /** Set only by the system scheduler, never by an ordinary send. */
  readonly timerOccurrence?: number;
}

/** Absolute deadlines in the system's virtual time domain. @experimental */
export interface SystemTimer {
  readonly source: SystemActorReference;
  readonly id: string;
  readonly occurrence: number;
  readonly scheduledAt: number;
  readonly dueAt: number;
  readonly sequence: number;
  readonly event?: AnyEventObject;
}

/** External work as data. Interpret it outside the pure reducer. @experimental */
export interface SystemExternalEffect {
  readonly id: string;
  readonly source: SystemActorReference;
  readonly type: string;
  readonly kind: 'action' | 'emit' | 'deadLetter';
  readonly params?: unknown;
  readonly args?: readonly unknown[];
  readonly event?: AnyEventObject;
  readonly reason?: string;
}

/** Acknowledges external work, optionally delivering its result to its owner. @experimental */
export interface SystemEffectResult {
  type: 'xstate.system.effect.result';
  effectId: string;
  event?: AnyEventObject;
}

/** Complete immutable system state; no running actors are retained. @experimental */
export interface SystemSnapshot {
  readonly executionId: string;
  readonly root: string;
  readonly now: number;
  readonly actors: Readonly<Record<string, SystemActorState>>;
  readonly registry: Readonly<Record<string, SystemActorReference>>;
  readonly messages: readonly SystemMessage[];
  readonly timers: Readonly<Record<string, SystemTimer>>;
  readonly externalEffects: Readonly<Record<string, SystemExternalEffect>>;
  readonly counters: Readonly<{
    actor: number;
    timer: number;
    sequence: number;
    effect: number;
  }>;
}

/** Options for initializing an immutable system snapshot. @experimental */
export interface InitialSystemTransitionOptions<
  TLogic extends AnyActorLogic = AnyActorLogic
> {
  input?: InputFrom<TLogic>;
  id?: string;
  registryKey?: string;
  /** Namespace external effect IDs when several executions share one host. */
  executionId?: string;
  time?: number;
  /** Bound immediate message chains. Exhaustion throws; the input is unchanged. */
  maxSteps?: number;
}

type MutableSystemSnapshot = {
  -readonly [K in keyof SystemSnapshot]: K extends 'actors'
    ? Record<string, SystemActorState>
    : K extends 'registry'
      ? Record<string, SystemActorReference>
      : K extends 'messages'
        ? SystemMessage[]
        : K extends 'timers'
          ? Record<string, SystemTimer>
          : K extends 'externalEffects'
            ? Record<string, SystemExternalEffect>
            : K extends 'counters'
              ? { -readonly [P in keyof SystemSnapshot['counters']]: number }
              : SystemSnapshot[K];
};

function timerKey(source: SystemActorReference, id: string): string {
  return JSON.stringify([source.$actor, source.incarnation, id]);
}

function isReference(value: any): value is SystemActorReference {
  return (
    !!value &&
    typeof value.$actor === 'string' &&
    Number.isSafeInteger(value.incarnation)
  );
}

function isHandle(value: any): value is AnyActor {
  return (
    !!value &&
    typeof value.address === 'string' &&
    typeof value.getSnapshot === 'function'
  );
}

const systemActorHandle = Symbol('xstate.systemActorHandle');
const systemLogger = () => {};

/** Converts runtime-shaped, reduction-local capabilities to snapshot data. */
function encode(
  value: any,
  seen = new Set<object>(),
  mappers?: ReadonlyMap<(...args: any[]) => unknown, string>
): any {
  if (typeof value === 'function' && mappers?.has(value))
    return { $systemMapper: mappers.get(value) };
  if (isHandle(value)) {
    if (!(value as any)[systemActorHandle])
      throw new Error(
        'Live actors cannot be stored in a pure system snapshot.'
      );
    return { $actor: value.address, incarnation: Number(value.sessionId) };
  }
  if (!value || typeof value !== 'object') {
    if (
      typeof value === 'function' ||
      typeof value === 'symbol' ||
      typeof value === 'bigint' ||
      (typeof value === 'number' && !Number.isFinite(value))
    )
      throw new Error(
        'System snapshots require data, not executable capabilities.'
      );
    return value;
  }
  if (seen.has(value))
    throw new Error('System snapshots cannot contain cyclic data.');
  seen.add(value);
  let result: any;
  if (
    value.machine &&
    typeof value.machine.transition === 'function' &&
    typeof value.id === 'string' &&
    Array.isArray(value.path)
  ) {
    result = { $stateNode: value.id };
  } else if (value instanceof Error) {
    result = { $error: value.name, message: value.message };
  } else if (Array.isArray(value)) {
    result = value.map((item) => encode(item, seen, mappers));
  } else {
    if (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    ) {
      throw new Error('System snapshot values must be plain data.');
    }
    result = Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        encode(item, seen, mappers)
      ])
    );
  }
  seen.delete(value);
  return result;
}

function snapshotData(
  snapshot: any,
  mappers?: ReadonlyMap<(...args: any[]) => unknown, string>
): Record<string, any> {
  if (!isMachineSnapshot(snapshot)) return encode(snapshot, new Set(), mappers);
  const {
    machine,
    nodes,
    tags,
    matches,
    can,
    hasTag,
    getMeta,
    getInputs,
    toJSON,
    ...data
  } = snapshot;
  return encode(
    { ...data, nodeIds: nodes.map((node: any) => node.id) },
    new Set(),
    mappers
  );
}

function definitions(systemLogic: SystemLogic): Map<string, AnyActorLogic> {
  const result = new Map<string, AnyActorLogic>();
  const visited = new Set<AnyActorLogic>();
  function add(key: string, logic: AnyActorLogic) {
    result.set(key, logic);
    if (visited.has(logic)) return;
    visited.add(logic);
    const machine = logic as any;
    for (const [name, child] of Object.entries(machine.sources?.actors ?? {})) {
      add(
        `${key}/actors/${encodeAddressSegment(name)}`,
        child as AnyActorLogic
      );
    }
    function visit(node: any) {
      for (const invoke of node.invoke ?? []) {
        if (typeof invoke.logic === 'object')
          add(
            `${key}/invoke/${encodeAddressSegment(node.id)}/${encodeAddressSegment(invoke.id)}`,
            invoke.logic
          );
      }
      for (const child of Object.values(node.states ?? {})) visit(child);
    }
    if (machine.root) visit(machine.root);
  }
  add('root', systemLogic.root);
  for (const [key, logic] of Object.entries(systemLogic.actors ?? {}))
    add(`actors/${encodeAddressSegment(key)}`, logic);
  add('xstate.listener', listenerLogic);
  add('xstate.subscription', subscriptionLogic);
  return result;
}

class SystemReduction {
  readonly snapshot: MutableSystemSnapshot;
  readonly effects: SystemExternalEffect[] = [];
  private readonly logic: Map<string, AnyActorLogic>;
  private readonly handles = new Map<string, AnyActor>();
  private readonly snapshots = new Map<string, any>();
  private readonly initialEffects = new Map<string, ExecutableActionObject[]>();
  private readonly stopping = new Set<string>();
  private readonly deadlines = new IndexedHeap<SystemTimer>(
    (a, b) =>
      a.dueAt < b.dueAt || (a.dueAt === b.dueAt && a.sequence < b.sequence)
  );
  private readonly effectNames = new Map<(...args: any[]) => unknown, string>([
    [systemLogger, 'xstate.log']
  ]);
  private readonly mapperNames: Map<(...args: any[]) => unknown, string>;
  private readonly mappers: NonNullable<SystemLogic['mappers']>;
  private remaining: number;

  constructor(logic: SystemLogic, snapshot: SystemSnapshot, maxSteps = 10_000) {
    if (!Number.isSafeInteger(maxSteps) || maxSteps < 1)
      throw new Error('maxSteps must be a positive integer.');
    this.logic = definitions(logic);
    this.mappers = logic.mappers ?? {};
    this.mapperNames = new Map(
      Object.entries(this.mappers).map(([key, mapper]) => [mapper, key])
    );
    for (const [key, implementation] of Object.entries(logic.effects ?? {}))
      this.effectNames.set(implementation, key);
    for (const [key, definition] of this.logic) {
      for (const [name, implementation] of Object.entries(
        ((definition as any).sources?.actions ?? {}) as Record<
          string,
          (...args: any[]) => unknown
        >
      )) {
        if (
          typeof implementation === 'function' &&
          !this.effectNames.has(implementation)
        )
          this.effectNames.set(
            implementation,
            `${key}/actions/${encodeAddressSegment(name)}`
          );
      }
    }
    this.snapshot = {
      ...snapshot,
      actors: Object.assign(Object.create(null), snapshot.actors),
      registry: Object.assign(Object.create(null), snapshot.registry),
      messages: [...snapshot.messages],
      timers: { ...snapshot.timers },
      externalEffects: { ...snapshot.externalEffects },
      counters: { ...snapshot.counters }
    };
    this.remaining = maxSteps;
    for (const timer of Object.values(snapshot.timers))
      this.deadlines.push(timer);
  }

  private step() {
    if (--this.remaining < 0)
      throw new Error(
        'System transition exceeded maxSteps; the input snapshot is unchanged.'
      );
  }

  private reference(actor: AnyActor): SystemActorReference {
    return { $actor: actor.address, incarnation: Number(actor.sessionId) };
  }

  private current(ref: SystemActorReference): SystemActorState | undefined {
    const actor = this.snapshot.actors[ref.$actor];
    return actor?.incarnation === ref.incarnation ? actor : undefined;
  }

  private decode(value: any, machine?: any): any {
    if (isReference(value)) return this.handle(value);
    if (!value || typeof value !== 'object') return value;
    if (typeof value.$systemMapper === 'string') {
      const mapper =
        Object.hasOwn(this.mappers, value.$systemMapper) &&
        this.mappers[value.$systemMapper];
      if (!mapper)
        throw new Error(`Missing pure mapper '${value.$systemMapper}'.`);
      return mapper;
    }
    if (typeof value.$stateNode === 'string')
      return machine.getStateNodeById(value.$stateNode);
    if (typeof value.$error === 'string') {
      const error = new Error(value.message);
      error.name = value.$error;
      if (error.name === 'TimeoutError')
        Object.setPrototypeOf(error, TimeoutError.prototype);
      return error;
    }
    if (Array.isArray(value))
      return value.map((item) => this.decode(item, machine));
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        this.decode(item, machine)
      ])
    );
  }

  private encode(value: any) {
    return encode(value, new Set(), this.mapperNames);
  }

  private attachedKind(actor: SystemActorState) {
    return (this.logic.get(actor.logic) as any)?.[systemLogicMetadata]?.kind;
  }

  private relayAttachments(
    source: SystemActorReference,
    emitted?: AnyEventObject
  ) {
    for (const actor of Object.values(this.snapshot.actors)) {
      const kind = this.attachedKind(actor);
      if (
        !actor.started ||
        actor.snapshot.status !== 'active' ||
        (kind !== 'xstate.listener' && kind !== 'xstate.subscription')
      )
        continue;
      const target = (actor.input as any).actor as SystemActorReference;
      if (
        !target ||
        target.$actor !== source.$actor ||
        target.incarnation !== source.incarnation ||
        !actor.parent ||
        this.current(actor.parent)?.snapshot.status !== 'active'
      )
        continue;
      const input = this.decode(actor.input);
      let event: AnyEventObject | undefined;
      if (kind === 'xstate.listener') {
        if (emitted && matchesEventDescriptor(emitted.type, input.eventType))
          event = input.mapper(this.decode(this.encode(emitted)));
      } else if (!emitted) {
        const snapshot = this.hydrate(source);
        const mapper =
          input.mappers[
            snapshot.status === 'active'
              ? 'snapshot'
              : snapshot.status === 'done'
                ? 'done'
                : snapshot.status === 'error'
                  ? 'error'
                  : ''
          ];
        if (mapper)
          event = mapper(
            snapshot.status === 'done'
              ? snapshot.output
              : snapshot.status === 'error'
                ? snapshot.error
                : snapshot
          );
      }
      if (event)
        this.enqueue(
          { $actor: actor.address, incarnation: actor.incarnation },
          actor.parent,
          event
        );
    }
  }

  private stopAttachments(parent: SystemActorReference) {
    for (const actor of Object.values(this.snapshot.actors)) {
      const kind = this.attachedKind(actor);
      if (
        (kind === 'xstate.listener' || kind === 'xstate.subscription') &&
        actor.parent?.$actor === parent.$actor &&
        actor.parent.incarnation === parent.incarnation
      )
        this.stop({ $actor: actor.address, incarnation: actor.incarnation });
    }
  }

  private hydrate(ref: SystemActorReference): any {
    const key = JSON.stringify(ref);
    if (this.snapshots.has(key)) return this.snapshots.get(key);
    const actor = this.current(ref);
    if (!actor)
      return { status: 'stopped', output: undefined, error: undefined };
    const logic = this.logic.get(actor.logic)! as any;
    if (!logic || logic.version !== actor.logicVersion)
      throw new Error(
        `Actor definition/version mismatch for '${actor.address}'.`
      );
    const data = this.decode(actor.snapshot, logic);
    const snapshot =
      typeof logic.getStateNodeById === 'function' && data.nodeIds
        ? createMachineSnapshot(
            {
              ...data,
              _nodes: data.nodeIds.map((id: string) =>
                logic.getStateNodeById(id)
              )
            },
            logic
          )
        : data;
    this.snapshots.set(key, snapshot);
    return snapshot;
  }

  private handle(ref: SystemActorReference): AnyActor {
    const key = JSON.stringify(ref);
    const existing = this.handles.get(key);
    if (existing) return existing;
    const actor = this.current(ref);
    const getState = () => this.current(ref) ?? actor;
    const getLogic = () => this.logic.get(getState()?.logic ?? '')!;
    const getParent = () => {
      const parent = getState()?.parent;
      return parent && this.handle(parent);
    };
    const getSnapshot = () => this.hydrate(ref);
    const unsupported = () => {
      throw new Error(
        'Use enqueue operations and systemTransition; live actor capabilities are unavailable in a pure snapshot.'
      );
    };
    const handle = {
      [systemActorHandle]: true,
      id: actor?.id ?? ref.$actor.split('/').at(-1),
      address: ref.$actor,
      sessionId: String(ref.incarnation),
      options: { _inert: true, input: actor?.input },
      get logic() {
        return getLogic();
      },
      get src() {
        return getState()?.logic;
      },
      get registryKey() {
        return getState()?.registryKey;
      },
      get _parent() {
        return getParent();
      },
      get _snapshot() {
        return getSnapshot();
      },
      getSnapshot,
      send: unsupported,
      start: unsupported,
      stop: unsupported,
      subscribe: unsupported,
      on: unsupported,
      system: undefined as any
    } as unknown as AnyActor;
    this.handles.set(key, handle);
    handle.system = this.system();
    return handle;
  }

  private system(): any {
    return {
      createActorRef: (logic: AnyActorLogic, options: any) =>
        this.allocate(logic, options),
      _unregister: (actor: AnyActor) => {
        this.stopping.add(JSON.stringify(this.reference(actor)));
        for (const [key, ref] of Object.entries(this.snapshot.registry)) {
          if (
            ref.$actor === actor.address &&
            String(ref.incarnation) === actor.sessionId
          )
            delete this.snapshot.registry[key];
        }
      },
      get: (key: string) =>
        this.snapshot.registry[key] && this.handle(this.snapshot.registry[key]),
      getAll: () =>
        Object.fromEntries(
          Object.entries(this.snapshot.registry).map(([key, ref]) => [
            key,
            this.handle(ref)
          ])
        ),
      _hasInspectionObservers: () => false,
      _sendInspectionEvent: () => {},
      _clock: {
        now: () => this.snapshot.now,
        setTimeout: () => {
          throw new Error('Timers must be declared as logical effects.');
        },
        clearTimeout: () => {
          throw new Error('Timers must be canceled as logical effects.');
        }
      }
    };
  }

  private scope(
    ref: SystemActorReference,
    source?: SystemActorReference
  ): AnyActorScope {
    const self = this.handle(ref) as any;
    self._lastSourceRef = source && this.handle(source);
    return {
      self,
      system: self.system,
      id: self.id,
      sessionId: self.sessionId,
      logger: systemLogger,
      defer: () => {},
      emit: () => {
        throw new Error('Emit events through enqueue operations.');
      },
      actionExecutor: () => {
        throw new Error('Execute external effects outside system transitions.');
      },
      stopChild: () => {
        throw new Error('Stop children through enqueue operations.');
      }
    } as AnyActorScope;
  }

  allocate(logic: AnyActorLogic, options: any = {}): AnyActor {
    this.step();
    const definition = [...this.logic].find(([, value]) => value === logic);
    if (!definition)
      throw new Error(
        'Register dynamically spawned logic in systemLogic.actors.'
      );
    const parent = options.parent && this.reference(options.parent);
    const id =
      options.id ??
      `${getActorIdPrefix(options.src ?? logic)}:${this.snapshot.counters.actor}`;
    const address = `${parent ? parent.$actor + '/' : ''}${encodeAddressSegment(id)}`;
    const occupied = this.snapshot.actors[address];
    if (occupied?.snapshot.status === 'active') {
      const previous = { $actor: address, incarnation: occupied.incarnation };
      if (!this.stopping.has(JSON.stringify(previous)))
        throw new Error(`Actor address '${address}' is already occupied.`);
      this.stop(previous);
    }
    const incarnation = this.snapshot.counters.actor++;
    const ref = { $actor: address, incarnation };
    const state: SystemActorState = {
      id,
      address,
      incarnation,
      logic: definition[0],
      ...((logic as any).version !== undefined && {
        logicVersion: (logic as any).version
      }),
      parent,
      registryKey: options.registryKey,
      syncSnapshot: options.syncSnapshot,
      started: false,
      input: this.encode(options.input),
      snapshot: { status: 'active', output: undefined, error: undefined }
    };
    this.snapshot.actors[address] = state;
    if (options.registryKey) {
      if (this.snapshot.registry[options.registryKey])
        throw new Error(
          `Registry key '${options.registryKey}' is already occupied.`
        );
      this.snapshot.registry[options.registryKey] = ref;
    }
    const scope = this.scope(ref);
    const result = logic.initialTransition(this.decode(state.input), scope);
    const [snapshot, effects] = finalizeTransitionResult(
      scope,
      undefined,
      result
    );
    this.store(ref, snapshot);
    this.initialEffects.set(JSON.stringify(ref), effects);
    return this.handle(ref);
  }

  private store(ref: SystemActorReference, snapshot: any) {
    const actor = this.current(ref);
    if (!actor) return;
    this.snapshots.set(JSON.stringify(ref), snapshot);
    this.snapshot.actors[ref.$actor] = {
      ...actor,
      snapshot: snapshotData(snapshot, this.mapperNames)
    };
  }

  private external(ref: SystemActorReference, effect: ExecutableActionObject) {
    const value = effect as any;
    // Enqueue callback markers have already run as part of pure calculation.
    if (value.kind === 'action' && value.action === undefined) return;
    const type =
      value.kind === 'action' && !value.type.startsWith('xstate.logic.')
        ? this.effectNames.get(value.action)
        : value.type;
    if (type === undefined)
      throw new Error(
        'Register callable external actions in systemLogic.effects or the machine action sources.'
      );
    const id = `${this.snapshot.executionId}:${this.snapshot.counters.effect++}`;
    const params =
      typeof value.params?.action === 'function'
        ? Object.fromEntries(
            Object.entries(value.params).filter(
              ([key]) => key !== 'action' && key !== 'args'
            )
          )
        : value.params;
    const result: SystemExternalEffect = {
      id,
      source: ref,
      type,
      kind:
        value.kind === 'emit'
          ? 'emit'
          : value.type === '@xstate.deadLetter'
            ? 'deadLetter'
            : 'action',
      ...(params !== undefined && { params: this.encode(params) }),
      args: this.encode(value.args ?? []),
      ...(value.event && { event: this.encode(value.event) }),
      ...(value.reason && { reason: value.reason })
    };
    this.effects.push(result);
    this.snapshot.externalEffects[id] = result;
    if (value.kind === 'emit') this.relayAttachments(ref, value.event);
  }

  private enqueue(
    source: SystemActorReference | undefined,
    target: SystemActorReference,
    event: AnyEventObject,
    timerOccurrence?: number
  ) {
    this.snapshot.messages.push({
      source,
      target,
      event: this.encode(event),
      sequence: this.snapshot.counters.sequence++,
      ...(timerOccurrence !== undefined && { timerOccurrence })
    });
  }

  private cancel(ref: SystemActorReference, id?: string) {
    for (const [key, timer] of Object.entries(this.snapshot.timers)) {
      if (
        timer.source.$actor === ref.$actor &&
        timer.source.incarnation === ref.incarnation &&
        (id === undefined || timer.id === id)
      )
        delete this.snapshot.timers[key];
    }
  }

  private effectsFor(
    ref: SystemActorReference,
    effects: ExecutableActionObject[]
  ) {
    for (const effect of effects) {
      const value = effect as any;
      if (value.kind !== 'builtin') {
        this.external(ref, effect);
        continue;
      }
      switch (value.type) {
        case '@xstate.spawn':
          break; // Allocation already updated the snapshot.
        case '@xstate.start':
          this.start(this.reference(value.actor));
          break;
        case '@xstate.stop':
          this.stop(this.reference(value.actor));
          break;
        case '@xstate.cancel':
          this.cancel(ref, value.id);
          break;
        case '@xstate.raise':
        case '@xstate.sendTo': {
          if (value.delay !== undefined) {
            if (!Number.isFinite(value.delay) || value.delay < 0)
              throw new Error(
                'System timer delays must be finite and nonnegative.'
              );
            const timer = this.current(ref)?.snapshot.timers?.[value.id];
            if (!timer) break;
            this.schedule(ref, value.id, value.delay);
          } else if (value.target)
            this.enqueue(ref, this.reference(value.target), value.event);
          break;
        }
        case '@xstate.terminate':
          this.terminate(ref);
          break;
        default:
          this.external(ref, effect);
      }
    }
  }

  private schedule(
    ref: SystemActorReference,
    id: string,
    delay: number,
    event?: AnyEventObject
  ) {
    const dueAt = this.snapshot.now + delay;
    if (!Number.isFinite(delay) || delay < 0 || !Number.isFinite(dueAt))
      throw new Error(
        'System timer deadlines must be finite and delays nonnegative.'
      );
    const timer: SystemTimer = {
      source: ref,
      id,
      occurrence: this.snapshot.counters.timer++,
      scheduledAt: this.snapshot.now,
      dueAt,
      sequence: this.snapshot.counters.sequence++,
      ...(event && { event: this.encode(event) })
    };
    this.snapshot.timers[timerKey(ref, id)] = timer;
    this.deadlines.push(timer);
  }

  private start(ref: SystemActorReference) {
    const actor = this.current(ref);
    if (!actor || actor.started || actor.snapshot.status === 'stopped') return;
    this.snapshot.actors[ref.$actor] = { ...actor, started: true };
    this.effectsFor(ref, this.initialEffects.get(JSON.stringify(ref)) ?? []);
    this.initialEffects.delete(JSON.stringify(ref));
    if (this.attachedKind(actor) === 'xstate.subscription') {
      const input = this.decode(actor.input);
      const target = this.reference(input.actor);
      const observed = this.current(target);
      // Live subscriptions immediately report already-published errors;
      // active/done snapshots are observed when their actor publishes them.
      if (
        observed?.started &&
        observed.snapshot.status === 'error' &&
        input.mappers.error &&
        actor.parent
      ) {
        this.enqueue(
          ref,
          actor.parent,
          input.mappers.error(this.hydrate(target).error)
        );
      }
    }
    if (this.current(ref)?.snapshot.status === 'active')
      this.relayAttachments(ref);
    const metadata = (this.logic.get(actor.logic) as any)[systemLogicMetadata];
    if (
      metadata?.timeout !== undefined &&
      this.current(ref)?.snapshot.status === 'active'
    ) {
      const delay = parseDelayToMilliseconds(metadata.timeout);
      if (delay === undefined)
        throw new Error('Unable to resolve async actor timeout.');
      this.schedule(ref, 'xstate.async.timeout', delay, {
        type: 'xstate.async.reject',
        data: new TimeoutError(metadata.timeout)
      });
    }
  }

  private stop(ref: SystemActorReference) {
    const actor = this.current(ref);
    if (!actor || actor.snapshot.status !== 'active') return;
    this.process({
      source: ref,
      target: ref,
      event: { type: '@xstate.stop' },
      sequence: this.snapshot.counters.sequence++
    });
    this.cancel(ref);
    this.handle(ref).system._unregister(this.handle(ref));
    this.snapshot.messages = this.snapshot.messages.filter(
      (message) =>
        message.target.$actor !== ref.$actor ||
        message.target.incarnation !== ref.incarnation
    );
    this.cancelExternal(ref);
    this.stopAttachments(ref);
  }

  private cancelExternal(ref: SystemActorReference) {
    for (const [id, effect] of Object.entries(this.snapshot.externalEffects)) {
      if (
        effect.kind !== 'action' ||
        effect.type === 'xstate.system.cancelEffect' ||
        effect.type === 'xstate.logic.cleanup' ||
        effect.source.$actor !== ref.$actor ||
        effect.source.incarnation !== ref.incarnation
      )
        continue;
      delete this.snapshot.externalEffects[id];
      const cancellation: SystemExternalEffect = {
        id: `${this.snapshot.executionId}:${this.snapshot.counters.effect++}`,
        source: ref,
        kind: 'action',
        type: 'xstate.system.cancelEffect',
        params: { effectId: id }
      };
      this.effects.push(cancellation);
      this.snapshot.externalEffects[cancellation.id] = cancellation;
    }
  }

  private terminate(ref: SystemActorReference) {
    const actor = this.current(ref);
    if (!actor) return;
    // Publish terminal observations before cleanup and the native parent event.
    this.relayAttachments(ref);
    this.cancel(ref);
    this.cancelExternal(ref);
    this.stopAttachments(ref);
    if (actor.parent) {
      const event =
        actor.snapshot.status === 'done'
          ? createDoneActorEvent(
              actor.id,
              this.decode(actor.snapshot.output),
              String(actor.incarnation)
            )
          : createErrorActorEvent(
              actor.id,
              this.decode(actor.snapshot.error),
              String(actor.incarnation)
            );
      this.enqueue(ref, actor.parent, event);
    }
  }

  private process(message: SystemMessage) {
    this.step();
    const actor = this.current(message.target);
    if (!actor || actor.snapshot.status !== 'active') return;
    if (
      message.event.type === 'xstate.timer' &&
      message.timerOccurrence === undefined
    ) {
      throw new Error(
        'Only the system scheduler may deliver a timer occurrence.'
      );
    }
    const logic = this.logic.get(actor.logic);
    if (!logic) throw new Error(`Missing actor definition '${actor.logic}'.`);
    if (
      (logic as any).isInternalEventType?.(message.event.type) &&
      (!message.source ||
        message.source.$actor !== actor.address ||
        message.source.incarnation !== actor.incarnation)
    ) {
      throw new Error(
        `Internal event '${message.event.type}' cannot be injected into a pure system.`
      );
    }
    if (
      !message.source &&
      /^(xstate\.after(?:\.|$)|xstate\.timeout(?:\.|$))/.test(
        message.event.type
      )
    )
      throw new Error(
        'Select a pending timer instead of injecting its internal event.'
      );
    const scope = this.scope(message.target, message.source);
    const previous = this.hydrate(message.target);
    const [snapshot, effects] = finalizeTransitionResult(
      scope,
      previous,
      logic.transition(previous, this.decode(message.event), scope)
    );
    this.store(message.target, snapshot);
    this.effectsFor(message.target, effects);
    if (snapshot.status === 'active') this.relayAttachments(message.target);
    if (actor.syncSnapshot && actor.parent && snapshot.status === 'active') {
      this.enqueue(message.target, actor.parent, {
        type: 'xstate.snapshot.actor',
        actorId: actor.id,
        sessionId: String(actor.incarnation),
        snapshot: snapshotData(snapshot, this.mapperNames)
      });
    }
  }

  settle() {
    while (this.snapshot.messages.length) {
      const message = this.snapshot.messages.shift()!;
      this.process(message);
    }
  }

  advance(time: number) {
    if (!Number.isFinite(time) || time < this.snapshot.now)
      throw new Error('System time must be finite and cannot move backwards.');
    this.settle();
    while (true) {
      const timer = this.deadlines.peek();
      if (
        timer &&
        this.snapshot.timers[timerKey(timer.source, timer.id)] !== timer
      ) {
        this.deadlines.pop();
        continue;
      }
      if (!timer || timer.dueAt > time) break;
      this.step();
      this.deadlines.pop();
      delete this.snapshot.timers[timerKey(timer.source, timer.id)];
      this.snapshot.now = Math.max(this.snapshot.now, timer.dueAt);
      const actor = this.current(timer.source);
      if (
        !actor ||
        actor.snapshot.status !== 'active' ||
        (!timer.event && !actor.snapshot.timers?.[timer.id])
      )
        continue;
      this.enqueue(
        timer.source,
        timer.source,
        timer.event ?? { type: 'xstate.timer', id: timer.id },
        timer.occurrence
      );
      this.settle();
    }
    this.snapshot.now = time;
  }

  send(path: string, event: AnyEventObject) {
    if (event.type === 'xstate.timer') {
      const actor = this.snapshot.actors[path];
      if (!actor) throw new Error(`Unknown actor address '${path}'.`);
      const timer =
        this.snapshot.timers[
          timerKey({ $actor: path, incarnation: actor.incarnation }, event.id)
        ];
      if (!timer || event.occurrence !== timer.occurrence)
        throw new Error('Select a current timer occurrence.');
      this.advance(timer.dueAt);
      return;
    }
    this.advance(this.snapshot.now);
    const actor = this.snapshot.actors[path];
    if (!actor) throw new Error(`Unknown actor address '${path}'.`);
    const ref = { $actor: path, incarnation: actor.incarnation };
    if (event.type === 'xstate.system.effect.result') {
      const effect = this.snapshot.externalEffects[event.effectId];
      if (
        !effect ||
        effect.source.$actor !== path ||
        (event.event &&
          (effect.source.incarnation !== actor.incarnation ||
            actor.snapshot.status !== 'active' ||
            effect.type === 'xstate.system.cancelEffect' ||
            effect.type === 'xstate.logic.cleanup'))
      )
        throw new Error(
          'External effect result does not match its owner or is stale.'
        );
      delete this.snapshot.externalEffects[event.effectId];
      if (event.event) {
        this.enqueue(ref, ref, event.event);
        this.settle();
      }
      return;
    }
    if (event.type === '@xstate.stop') {
      this.stop(ref);
      this.settle();
      return;
    }
    if (
      event.type.startsWith('xstate.async.') ||
      event.type.startsWith('xstate.logic.effect.')
    )
      throw new Error(
        'Deliver external work results with xstate.system.effect.result.'
      );
    this.enqueue(undefined, ref, event);
    this.settle();
  }

  initialize(input: unknown, id: string, registryKey?: string) {
    const root = this.allocate(this.logic.get('root')!, {
      id,
      input,
      registryKey
    });
    this.snapshot.root = root.address;
    this.start(this.reference(root));
    this.settle();
  }
}

/** Initialize all actors and return external work without executing it. @experimental */
export function initialSystemTransition<TLogic extends AnyActorLogic>(
  systemLogic: SystemLogic<TLogic>,
  options: InitialSystemTransitionOptions<TLogic> = {}
): [SystemSnapshot, SystemExternalEffect[]] {
  const now = options.time ?? 0;
  if (!Number.isFinite(now) || now < 0)
    throw new Error('Initial system time must be finite and nonnegative.');
  const reduction = new SystemReduction(
    systemLogic,
    {
      root: '',
      executionId: options.executionId ?? 'system',
      now,
      actors: {},
      registry: {},
      messages: [],
      timers: {},
      externalEffects: {},
      counters: { actor: 0, timer: 0, sequence: 0, effect: 0 }
    },
    options.maxSteps
  );
  reduction.initialize(
    options.input,
    options.id ?? (systemLogic.root as any).id ?? 'root',
    options.registryKey
  );
  return [reduction.snapshot, reduction.effects];
}

/** Complete actor macrosteps and immediate communication in an immutable snapshot. @experimental */
export function systemTransition(
  systemLogic: SystemLogic,
  snapshot: SystemSnapshot,
  actorPath: string,
  event: AnyEventObject
): [SystemSnapshot, SystemExternalEffect[]] {
  const reduction = new SystemReduction(systemLogic, snapshot);
  reduction.send(actorPath, event);
  return [reduction.snapshot, reduction.effects];
}

/** Process every due timer chronologically across the entire system snapshot. @experimental */
export function advanceSystemTime(
  systemLogic: SystemLogic,
  snapshot: SystemSnapshot,
  options: { time: number; maxSteps?: number }
): [SystemSnapshot, SystemExternalEffect[]] {
  const reduction = new SystemReduction(
    systemLogic,
    snapshot,
    options.maxSteps
  );
  reduction.advance(options.time);
  return [reduction.snapshot, reduction.effects];
}
