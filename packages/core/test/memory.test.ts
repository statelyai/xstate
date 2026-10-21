import {
  ActorLogic,
  AnyActorSystem,
  createActor,
  createMachine,
  Snapshot,
  transition
} from '../src';

describe('runtime allocation lifecycle', () => {
  it('keeps idle-only storage lazy', () => {
    const actor = createActor(createMachine({})).start();
    const runtime = actor as unknown as {
      mailbox?: unknown;
      observers?: unknown;
      eventListeners?: unknown;
      _trigger?: unknown;
      _boundSend?: unknown;
    };
    const runtimeSystem = actor.system as typeof actor.system & {
      _children?: unknown;
      _inspectionObservers?: unknown;
      _timerMap?: unknown;
      _keyedActors?: unknown;
      _reverseKeyedActors?: unknown;
    };

    expect(runtime.mailbox).toBeUndefined();
    expect(runtime.observers).toBeUndefined();
    expect(runtime.eventListeners).toBeUndefined();
    expect(runtime._trigger).toBeUndefined();
    expect(runtime._boundSend).toBeUndefined();
    expect(runtimeSystem._inspectionObservers).toBeUndefined();
    expect(runtimeSystem._children).toBeUndefined();
    expect(runtimeSystem._timerMap).toBeUndefined();
    expect(runtimeSystem._keyedActors).toBeUndefined();
    expect(runtimeSystem._reverseKeyedActors).toBeUndefined();

    expect(actor.system.get('missing')).toBeUndefined();
    expect(runtimeSystem._keyedActors).toBeUndefined();

    actor.subscribe(() => {});
    actor.send({ type: 'event' });
    actor.trigger.event();
    actor.system.inspect(() => {});

    expect(runtime.mailbox).toBeDefined();
    expect(runtime.observers).toBeDefined();
    expect(runtime._trigger).toBeDefined();
    expect(runtime._boundSend).toBeDefined();
    expect(runtimeSystem._inspectionObservers).toBeDefined();
  });

  it('keeps the running root inline until registered actors are requested', () => {
    let transitionSawRoot = false;
    let actor: ReturnType<typeof createActor>;
    const machine = createMachine({
      on: {
        CHECK: ({ system }) => {
          transitionSawRoot = system.children.get(actor.sessionId) === actor;
        }
      }
    });
    actor = createActor(machine).start();
    const runtimeSystem = actor.system as typeof actor.system & {
      _children?: Map<string, unknown>;
    };

    expect(runtimeSystem._children).toBeUndefined();
    transition(machine, actor.getSnapshot(), { type: 'CHECK' });
    expect(transitionSawRoot).toBe(true);
    expect(runtimeSystem._children).toBeUndefined();
    expect(actor.system.children.get(actor.sessionId)).toBe(actor);
    expect(runtimeSystem._children?.size).toBe(1);
  });

  it('shares runtime operations between independent systems', () => {
    const first = createActor(createMachine({}));
    const second = createActor(createMachine({}));

    expect(first.system.sendEvent).toBe(second.system.sendEvent);
    expect(Object.hasOwn(first.system, 'sendEvent')).toBe(false);
  });

  it('shares enumerable default actor options but copies explicit options', () => {
    const logic = createMachine({});
    const first = createActor(logic);
    const second = createActor(logic);
    const explicit = createActor(logic, {});

    expect(first.options).toBe(second.options);
    expect(Object.keys(first.options)).toEqual(['clock', 'logger']);
    expect(explicit.options).not.toBe(first.options);
    expect(Object.keys(explicit.options)).toEqual(['clock', 'logger']);
  });

  it('keeps detachable actor-scope operations lazy', () => {
    type ScopeMethods = {
      defer: (fn: () => void) => void;
      stopChild: (child: never) => void;
      actionExecutor: (action: never) => void;
    };
    const logic = createMachine({});
    const first = createActor(logic);
    const second = createActor(logic);
    const firstScope = (first as unknown as { _actorScope: ScopeMethods })
      ._actorScope;
    const secondScope = (second as unknown as { _actorScope: ScopeMethods })
      ._actorScope;

    expect(Object.hasOwn(firstScope, 'defer')).toBe(false);
    expect(Object.hasOwn(firstScope, 'stopChild')).toBe(false);
    expect(Object.hasOwn(firstScope, 'actionExecutor')).toBe(false);

    const detachedDefer = firstScope.defer;
    detachedDefer(() => {});

    expect(firstScope.defer).toBe(detachedDefer);
    expect(Object.hasOwn(firstScope, 'defer')).toBe(true);
    expect(Object.hasOwn(secondScope, 'defer')).toBe(false);
  });

  it('keeps detached actor-scope operations callable asynchronously', async () => {
    const childLogic = createMachine({});
    const actor = createActor(
      createMachine({
        invoke: { id: 'child', src: childLogic },
        on: { FLUSH: {} }
      })
    ).start();
    const child = actor.getSnapshot().children.child!;
    const scope = (
      actor as unknown as {
        _actorScope: {
          defer: (fn: () => void) => void;
          emit: (event: { type: string }) => void;
          stopChild: (child: typeof actor) => void;
          actionExecutor: (action: unknown) => void;
        };
      }
    )._actorScope;
    const { defer, emit, stopChild, actionExecutor } = scope;
    let deferred = false;
    let emitted = false;
    let executed = false;

    actor.on('scope-event' as never, () => {
      emitted = true;
    });
    await Promise.resolve();
    defer(() => {
      deferred = true;
    });
    emit({ type: 'scope-event' });
    actionExecutor({
      type: 'scope-action',
      params: undefined,
      exec: () => {
        executed = true;
      }
    });
    actor.send({ type: 'FLUSH' });
    stopChild(child as typeof actor);

    expect(deferred).toBe(true);
    expect(emitted).toBe(true);
    expect(executed).toBe(true);
    expect(child.getSnapshot().status).toBe('stopped');
  });

  it('shares frozen empty snapshot records', () => {
    const machine = createMachine({});
    const first = createActor(machine).getSnapshot();
    const second = createActor(machine).getSnapshot();

    expect(first.children).toBe(second.children);
    expect(first.timers).toBe(second.timers);
    expect(first.historyValue).toBe(second.historyValue);
    expect(first._stateInputs).toBe(second._stateInputs);
    expect(Object.isFrozen(first.children)).toBe(true);
  });

  it('queues start-time events until logic start returns', () => {
    const order: string[] = [];
    type QueuedEvent = { type: 'queued' };
    const initialSnapshot: Snapshot<never> = {
      status: 'active',
      output: undefined,
      error: undefined
    };
    const logic: ActorLogic<
      Snapshot<never>,
      QueuedEvent,
      undefined,
      AnyActorSystem
    > = {
      initialTransition: () => [initialSnapshot, []],
      getInitialSnapshot: () => initialSnapshot,
      transition: (snapshot) => {
        order.push('transition');
        return [snapshot, []];
      },
      start: (_snapshot, scope) => {
        order.push('start:before');
        scope.system.sendEvent(scope.self, scope.self, { type: 'queued' });
        order.push('start:after');
      },
      getPersistedSnapshot: (snapshot) => snapshot
    };

    createActor(logic).start();

    expect(order).toEqual(['start:before', 'start:after', 'transition']);
  });
});
