import {
  ActorLogic,
  AnyActorSystem,
  createActor,
  createMachine,
  Snapshot
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
    const actor = createActor(createMachine({})).start();
    const runtimeSystem = actor.system as typeof actor.system & {
      _children?: Map<string, unknown>;
    };

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

  it('keeps detachable actor-scope operations lazy', () => {
    type ScopeMethods = {
      _defer?: (fn: () => void) => void;
      _stopChild?: (child: never) => void;
      _actionExecutor?: (action: never) => void;
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

    expect(firstScope._defer).toBeUndefined();
    expect(firstScope._stopChild).toBeUndefined();
    expect(firstScope._actionExecutor).toBeUndefined();

    const detachedDefer = firstScope.defer;
    detachedDefer(() => {});

    expect(firstScope._defer).toBe(detachedDefer);
    expect(secondScope._defer).toBeUndefined();
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
