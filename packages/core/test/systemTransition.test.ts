import { vi } from 'vitest';
import { z } from 'zod';
import {
  advanceSystemTime,
  createMachine,
  createLogic,
  createAsyncLogic,
  createCallbackLogic,
  initialSystemTransition,
  systemTransition
} from '../src/index.ts';

function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) freeze(child);
  }
  return value;
}

it('branches complete actor worlds without retaining live actors', () => {
  const logic = {
    root: createMachine({
      id: 'root',
      initial: 'off',
      states: { off: { on: { TOGGLE: { target: 'on' } } }, on: {} }
    })
  };
  const [initial] = initialSystemTransition(logic);
  freeze(initial);
  const [next] = systemTransition(logic, initial, 'root', { type: 'TOGGLE' });
  expect(initial.actors.root.snapshot.value).toBe('off');
  expect(next.actors.root.snapshot.value).toBe('on');
  expect(
    systemTransition(logic, initial, 'root', { type: 'TOGGLE' })[0]
  ).toEqual(next);
  expect(JSON.parse(JSON.stringify(next))).toMatchObject({
    root: 'root',
    actors: { root: { snapshot: { value: 'on' } } }
  });
  expect(next.actors.root.snapshot).not.toHaveProperty('machine');
});

it('advances through an earlier transition that cancels the selected timer', () => {
  const logic = {
    root: createMachine({
      id: 'root',
      initial: 'waiting',
      states: {
        waiting: {
          after: { 2000: { target: 'done' }, 6000: { target: 'late' } }
        },
        done: {},
        late: {}
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  const late = Object.values(world.timers).find(
    (timer) => timer.dueAt === 6000
  )!;
  const [next] = systemTransition(logic, freeze(world), 'root', {
    type: 'xstate.timer',
    id: late.id,
    occurrence: late.occurrence
  });
  expect(next.now).toBe(6000);
  expect(next.actors.root.snapshot.value).toBe('done');
  expect(next.timers).toEqual({});
});

it('starts newly created timers at their chronological firing time', () => {
  const logic = {
    root: createMachine({
      id: 'root',
      context: { trace: [] as string[] },
      initial: 'waiting',
      states: {
        waiting: {
          after: {
            2000: ({ context }, enq) => {
              enq.raise({ type: 'MID' }, { id: 'mid', delay: 1000 });
              return { context: { trace: [...context.trace, 'early'] } };
            },
            6000: ({ context }) => ({
              context: { trace: [...context.trace, 'late'] }
            })
          },
          on: {
            MID: ({ context }) => ({
              context: { trace: [...context.trace, 'middle'] }
            })
          }
        }
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  const [next] = advanceSystemTime(logic, freeze(world), { time: 6000 });
  expect(next.actors.root.snapshot.context.trace).toEqual([
    'early',
    'middle',
    'late'
  ]);
  expect(next.now).toBe(6000);
  const [atTwo] = advanceSystemTime(logic, world, { time: 2000 });
  expect(
    Object.values(atTwo.timers).find((timer) => timer.id === 'mid')?.dueAt
  ).toBe(3000);
  expect(advanceSystemTime(logic, atTwo, { time: 6000 })[0]).toEqual(next);
});

it('owns child state, immediate communication and completion notifications', () => {
  const child = createMachine({
    initial: 'waiting',
    states: {
      waiting: { on: { PING: { target: 'done' } } },
      done: { type: 'final', output: 42 }
    }
  });
  const logic = {
    root: createMachine({
      id: 'root',
      initial: 'active',
      states: {
        active: {
          invoke: { id: 'child', src: child, onDone: { target: 'success' } },
          on: {
            SEND: ({ children }, enq) =>
              enq.sendTo(children.child, { type: 'PING' })
          }
        },
        success: {}
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  expect(world.actors['root/child'].started).toBe(true);
  expect(world.actors.root.snapshot.children.child).toEqual({
    $actor: 'root/child',
    incarnation: 1
  });
  const [next] = systemTransition(logic, freeze(world), 'root', {
    type: 'SEND'
  });
  expect(next.actors.root.snapshot.value).toBe('success');
  expect(next.actors['root/child'].snapshot.status).toBe('done');
  expect(next.messages).toEqual([]);
});

it('orders timers across actors and applies a child send before a later parent timer', () => {
  const child = createMachine({
    initial: 'active',
    states: {
      active: {
        after: {
          2000: ({ parent }, enq) => enq.sendTo(parent!, { type: 'CANCEL' })
        }
      }
    }
  });
  const logic = {
    root: createMachine({
      id: 'root',
      initial: 'active',
      states: {
        active: {
          invoke: { id: 'child', src: child },
          after: { 6000: { target: 'late' } },
          on: { CANCEL: { target: 'done' } }
        },
        done: {},
        late: {}
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  const [next] = advanceSystemTime(logic, freeze(world), { time: 6000 });
  expect(next.actors.root.snapshot.value).toBe('done');
  expect(next.actors['root/child'].snapshot.status).toBe('stopped');
  expect(next.timers).toEqual({});
});

it('preserves unrelated deadlines and rejects stale occurrences after reentry', () => {
  const logic = {
    root: createMachine({
      id: 'root',
      initial: 'active',
      states: {
        active: {
          after: { 6000: { target: 'done' } },
          on: { NOOP: {}, REENTER: { target: 'active', reenter: true } }
        },
        done: {}
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  const original = Object.values(world.timers)[0];
  const [atTwo] = advanceSystemTime(logic, world, { time: 2000 });
  const [unchanged] = systemTransition(logic, atTwo, 'root', { type: 'NOOP' });
  expect(Object.values(unchanged.timers)[0]).toEqual(original);
  const [reentered] = systemTransition(logic, freeze(unchanged), 'root', {
    type: 'REENTER'
  });
  const replacement = Object.values(reentered.timers)[0];
  expect(replacement.id).toBe(original.id);
  expect(replacement.occurrence).not.toBe(original.occurrence);
  expect(replacement.dueAt).toBe(8000);
  expect(() =>
    systemTransition(logic, reentered, 'root', {
      type: 'xstate.timer',
      id: original.id,
      occurrence: original.occurrence
    })
  ).toThrow('current timer occurrence');
});

it('restarts invoked actors on parent reentry without reusing incarnations', () => {
  const child = createMachine({
    initial: 'active',
    states: { active: { after: { 3000: { target: 'done' } } }, done: {} }
  });
  const logic = {
    root: createMachine({
      id: 'root',
      initial: 'active',
      states: {
        active: {
          invoke: { id: 'child', src: child },
          on: { REENTER: { target: 'active', reenter: true } }
        }
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  const [later] = advanceSystemTime(logic, world, { time: 1000 });
  const [next] = systemTransition(logic, freeze(later), 'root', {
    type: 'REENTER'
  });
  expect(next.actors['root/child'].incarnation).not.toBe(
    world.actors['root/child'].incarnation
  );
  expect(Object.values(next.timers)).toHaveLength(1);
  expect(Object.values(next.timers)[0].dueAt).toBe(4000);
});

it('compares deadlines rather than declared delays', () => {
  const logic = {
    root: createMachine({
      id: 'root',
      context: { trace: [] as string[] },
      entry: (_, enq) => enq.raise({ type: 'A' }, { delay: 6000, id: 'a' }),
      on: {
        SCHEDULE: (_, enq) =>
          enq.raise({ type: 'B' }, { delay: 2000, id: 'b' }),
        A: ({ context }) => ({ context: { trace: [...context.trace, 'a'] } }),
        B: ({ context }) => ({ context: { trace: [...context.trace, 'b'] } })
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  const [atFive] = advanceSystemTime(logic, world, { time: 5000 });
  const [scheduled] = systemTransition(logic, atFive, 'root', {
    type: 'SCHEDULE'
  });
  const [next] = advanceSystemTime(logic, scheduled, { time: 7000 });
  expect(next.actors.root.snapshot.context.trace).toEqual(['a', 'b']);
});

it('consumes a guarded timer once and rejects raw after injection', () => {
  const logic = {
    root: createMachine({
      id: 'root',
      initial: 'active',
      states: { active: { after: { 1000: () => undefined } }, done: {} }
    })
  };
  const [world] = initialSystemTransition(logic);
  const [next] = advanceSystemTime(logic, freeze(world), { time: 1000 });
  expect(next.actors.root.snapshot.value).toBe('active');
  expect(next.actors.root.snapshot.timers).toEqual({});
  expect(next.timers).toEqual({});
  expect(() =>
    systemTransition(logic, world, 'root', {
      type: 'xstate.after',
      delay: 1000,
      stateId: 'root.active'
    })
  ).toThrow('instead of injecting');
});

it('orders equal-deadline timers before newly scheduled zero-delay timers', () => {
  const logic = {
    root: createMachine({
      id: 'root',
      context: { trace: [] as string[] },
      entry: (_, enq) => {
        enq.raise({ type: 'A' }, { delay: 1000, id: 'a' });
        enq.raise({ type: 'B' }, { delay: 1000, id: 'b' });
      },
      on: {
        A: ({ context }, enq) => {
          enq.raise({ type: 'C' }, { delay: 0, id: 'c' });
          return { context: { trace: [...context.trace, 'a'] } };
        },
        B: ({ context }) => ({ context: { trace: [...context.trace, 'b'] } }),
        C: ({ context }) => ({ context: { trace: [...context.trace, 'c'] } })
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  expect(
    advanceSystemTime(logic, freeze(world), { time: 1000 })[0].actors.root
      .snapshot.context.trace
  ).toEqual(['a', 'b', 'c']);
});

it('returns external work as data without executing it', () => {
  const action = vi.fn();
  const logic = {
    effects: { audit: action },
    root: createMachine({
      id: 'root',
      entry: (_, enq) => {
        enq(action, { message: 'hello' });
        enq.emit({ type: 'READY' });
      }
    })
  };
  const [world, effects] = initialSystemTransition(logic);
  expect(action).not.toHaveBeenCalled();
  expect(effects).toHaveLength(2);
  expect(effects[0].type).toBe('audit');
  expect(effects[0].args).toEqual([{ message: 'hello' }]);
  expect(effects[1]).toMatchObject({ kind: 'emit', event: { type: 'READY' } });
  expect(world.externalEffects[effects[0].id]).toEqual(effects[0]);
  expect(JSON.parse(JSON.stringify(effects))).toEqual(effects);
});

it('requires stable names for callable external actions', () => {
  const action = vi.fn();
  const logic = { root: createMachine({ entry: (_, enq) => enq(action) }) };
  expect(() => initialSystemTransition(logic)).toThrow('Register callable');
  expect(action).not.toHaveBeenCalled();
});

it('retains a replacement timer beyond a selected occurrence’s original deadline', () => {
  const logic = {
    root: createMachine({
      id: 'root',
      context: { count: 0 },
      entry: (_, enq) => {
        enq.raise({ type: 'RESET' }, { id: 'reset', delay: 2000 });
        enq.raise({ type: 'LATE' }, { id: 'late', delay: 6000 });
      },
      on: {
        RESET: (_, enq) => {
          enq.cancel('late');
          enq.raise({ type: 'LATE' }, { id: 'late', delay: 8000 });
        },
        LATE: ({ context }) => ({ context: { count: context.count + 1 } })
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  const selected = Object.values(world.timers).find(
    (timer) => timer.id === 'late'
  )!;
  const [next] = systemTransition(logic, freeze(world), 'root', {
    type: 'xstate.timer',
    id: selected.id,
    occurrence: selected.occurrence
  });
  expect(next.now).toBe(6000);
  expect(next.actors.root.snapshot.context.count).toBe(0);
  expect(Object.values(next.timers)).toMatchObject([
    { id: 'late', dueAt: 10000 }
  ]);
  expect(
    advanceSystemTime(logic, next, { time: 10000 })[0].actors.root.snapshot
      .context.count
  ).toBe(1);
});

it('replays named pure listeners without live subscriptions and stops them with their owner', () => {
  const ready = (event: any) => ({
    type: 'READY' as const,
    value: event.value
  });
  const child = createMachine({
    schemas: { emitted: { ready: z.object({ value: z.number() }) } },
    entry: (_, enq) => enq.emit({ type: 'ready', value: 1 }),
    on: { PING: (_, enq) => enq.emit({ type: 'ready', value: 2 }) }
  });
  const logic = {
    mappers: { ready },
    actors: { child },
    root: createMachine({
      id: 'root',
      schemas: {
        events: { READY: z.object({ value: z.number() }), PING: z.object({}) }
      },
      context: { value: 0 },
      entry: (_, enq) => {
        const actor = enq.spawn(child, { id: 'child' });
        enq.listen(actor, 'ready', ready);
      },
      on: {
        READY: ({ event }) => ({ context: { value: event.value } }),
        PING: ({ children }, enq) =>
          enq.sendTo(children.child, { type: 'PING' })
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  expect(world.actors.root.snapshot.context.value).toBe(1);
  const restored = JSON.parse(JSON.stringify(world));
  const [next] = systemTransition(logic, freeze(restored), 'root', {
    type: 'PING'
  });
  expect(next.actors.root.snapshot.context.value).toBe(2);
  const [stopped] = systemTransition(logic, next, 'root', {
    type: '@xstate.stop'
  });
  expect(
    Object.values(stopped.actors).every(
      (actor) => actor.snapshot.status === 'stopped'
    )
  ).toBe(true);
});

it('maps pure child snapshots and completion through owned subscription actors', () => {
  type Mapped =
    | { type: 'SNAPSHOT'; value: number }
    | { type: 'DONE'; value: unknown };
  const snapshot = (value: any): Mapped => ({
    type: 'SNAPSHOT' as const,
    value: value.context.count
  });
  const done = (value: unknown): Mapped => ({ type: 'DONE', value });
  const child = createMachine({
    context: { count: 0 },
    initial: 'active',
    states: {
      active: {
        on: {
          INC: ({ context }) => ({ context: { count: context.count + 1 } }),
          FINISH: { target: 'done' }
        }
      },
      done: { type: 'final', output: 42 }
    }
  });
  const logic = {
    mappers: { snapshot, done },
    actors: { child },
    root: createMachine({
      id: 'root',
      schemas: {
        events: {
          SNAPSHOT: z.object({ value: z.number() }),
          DONE: z.object({ value: z.unknown() })
        }
      },
      context: { count: -1, output: undefined as unknown },
      entry: (_, enq) => {
        const actor = enq.spawn(child, { id: 'child' });
        enq.subscribeTo(actor, { snapshot, done });
      },
      on: {
        SNAPSHOT: ({ context, event }) => ({
          context: { ...context, count: event.value }
        }),
        DONE: ({ context, event }) => ({
          context: { ...context, output: event.value }
        })
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  expect(world.actors.root.snapshot.context.count).toBe(0);
  const [next] = systemTransition(
    logic,
    JSON.parse(JSON.stringify(world)),
    'root/child',
    { type: 'INC' }
  );
  expect(next.actors.root.snapshot.context.count).toBe(1);
  const [completed] = systemTransition(logic, next, 'root/child', {
    type: 'FINISH'
  });
  expect(completed.actors.root.snapshot.context.output).toBe(42);
});

it('handles prototype-shaped root IDs and registry keys as ordinary data', () => {
  const logic = { root: createMachine({ on: { PING: {} } }) };
  const [world] = initialSystemTransition(logic, {
    id: '__proto__',
    registryKey: '__proto__'
  });
  expect(world.registry.__proto__).toEqual({
    $actor: '__proto__',
    incarnation: 0
  });
  const [next] = systemTransition(
    logic,
    JSON.parse(JSON.stringify(world)),
    '__proto__',
    { type: 'PING' }
  );
  expect(next.actors.__proto__.snapshot.status).toBe('active');
});

it('rejects live actors and unserializable context without executing external work', () => {
  const logic = { root: createMachine({ context: { value: () => 42 } }) };
  expect(() => initialSystemTransition(logic)).toThrow('data');
  const live = { address: 'other', getSnapshot: () => ({ status: 'active' }) };
  expect(() =>
    initialSystemTransition({ root: createMachine({ context: { live } }) })
  ).toThrow('Live actors');
});

it('prevents an actor send from impersonating the world scheduler', () => {
  const logic = {
    root: createMachine({
      id: 'root',
      initial: 'waiting',
      states: {
        waiting: {
          after: { 1000: { target: 'done' } },
          on: {
            INJECT: ({ self }, enq) =>
              enq.sendTo(self, { type: 'xstate.timer', id: 'anything' } as any)
          }
        },
        done: {}
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  expect(() =>
    systemTransition(logic, freeze(world), world.root, { type: 'INJECT' })
  ).toThrow('Only the world scheduler');
});

it('acknowledges retirement commands after replacement without accepting stale results', () => {
  const worker = createAsyncLogic({ run: vi.fn(async () => 42) });
  const logic = {
    root: createMachine({
      id: 'root',
      initial: 'active',
      states: {
        active: {
          invoke: { id: 'worker', src: worker },
          on: { RESTART: { target: 'active', reenter: true } }
        }
      }
    })
  };
  const [world, initialEffects] = initialSystemTransition(logic);
  const [restarted, effects] = systemTransition(logic, freeze(world), 'root', {
    type: 'RESTART'
  });
  const cancellation = effects.find(
    (effect) => effect.type === 'xstate.system.cancelEffect'
  )!;
  for (const effectId of [initialEffects[0].id, cancellation.id]) {
    expect(() =>
      systemTransition(logic, restarted, 'root/worker', {
        type: 'xstate.system.effect.result',
        effectId,
        event: { type: 'xstate.async.resolve', data: 42 }
      })
    ).toThrow('stale');
  }
  const [acknowledged] = systemTransition(logic, restarted, 'root/worker', {
    type: 'xstate.system.effect.result',
    effectId: cancellation.id
  });
  expect(acknowledged.externalEffects).not.toHaveProperty(cancellation.id);
  expect(acknowledged.actors['root/worker'].snapshot.status).toBe('active');
});

it('names logger effects without running the logger during reduction', () => {
  const logic = {
    root: createMachine({ entry: (_, enq) => enq.log('hello', 42) })
  };
  const [, effects] = initialSystemTransition(logic);
  expect(effects).toMatchObject([{ type: 'xstate.log', args: ['hello', 42] }]);
});

it('restores a serialized world with pending timers and child references', () => {
  const child = createMachine({
    initial: 'active',
    states: { active: { after: { 2000: { target: 'done' } } }, done: {} }
  });
  const logic = {
    root: createMachine({ id: 'root', invoke: { id: 'child', src: child } })
  };
  const [world] = initialSystemTransition(logic);
  const [atOne] = advanceSystemTime(logic, world, { time: 1000 });
  const restored = JSON.parse(JSON.stringify(atOne));
  expect(
    advanceSystemTime(logic, freeze(restored), { time: 2000 })[0].actors[
      'root/child'
    ].snapshot.value
  ).toBe('done');
});

it('keeps an ordinary matching event separate from its delayed delivery', () => {
  const logic = {
    root: createMachine({
      id: 'root',
      entry: (_, enq) =>
        enq.raise({ type: 'PING' }, { delay: 1000, id: 'ping' }),
      on: { PING: {} }
    })
  };
  const [world] = initialSystemTransition(logic);
  const [next] = systemTransition(logic, freeze(world), 'root', {
    type: 'PING'
  });
  expect(next.now).toBe(0);
  expect(next.timers).toEqual(world.timers);
});

it('bounds zero-delay chains atomically without modifying the input world', () => {
  const logic = {
    root: createMachine({
      id: 'root',
      initial: 'active',
      states: { active: { after: { 0: { target: 'active', reenter: true } } } }
    })
  };
  const [world] = initialSystemTransition(logic);
  const before = JSON.stringify(world);
  expect(() =>
    advanceSystemTime(logic, freeze(world), { time: 6000, maxSteps: 10 })
  ).toThrow('maxSteps');
  expect(JSON.stringify(world)).toBe(before);
  expect(() => advanceSystemTime(logic, world, { time: -1 })).toThrow(
    'backwards'
  );
  expect(() => advanceSystemTime(logic, world, { time: Infinity })).toThrow(
    'finite'
  );
});

it('processes pure non-machine actor logic without executing external effects', () => {
  const external = vi.fn();
  const logic = {
    root: createLogic({
      id: 'root',
      context: { count: 0 },
      run: ({ context, event }, enq) => {
        if (event.type === 'INC') {
          enq.effect(external);
          return { context: { count: context.count + 1 } };
        }
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  const [next, effects] = systemTransition(logic, freeze(world), 'root', {
    type: 'INC'
  });
  expect(next.actors.root.snapshot.context.count).toBe(1);
  expect(effects).toHaveLength(1);
  expect(external).not.toHaveBeenCalled();
});

it('acknowledges external work and delivers its result as a correlated input', () => {
  const run = vi.fn(async () => 42);
  const logic = { root: createAsyncLogic({ id: 'root', timeout: '2s', run }) };
  const [world, effects] = initialSystemTransition(logic);
  expect(run).not.toHaveBeenCalled();
  expect(Object.values(world.timers)[0].dueAt).toBe(2000);
  const [next] = systemTransition(logic, freeze(world), 'root', {
    type: 'xstate.system.effect.result',
    effectId: effects[0].id,
    event: { type: 'xstate.async.resolve', data: 42 }
  });
  expect(next.actors.root.snapshot.status).toBe('done');
  expect(next.actors.root.snapshot.output).toBe(42);
  expect(next.timers).toEqual({});
  expect(next.externalEffects).toEqual({});
  expect(run).not.toHaveBeenCalled();
  expect(() =>
    systemTransition(logic, next, 'root', {
      type: 'xstate.system.effect.result',
      effectId: effects[0].id
    })
  ).toThrow('stale');
});

it('owns async timeouts and rejects results arriving after cancellation', () => {
  const run = vi.fn(async () => 42);
  const logic = { root: createAsyncLogic({ id: 'root', timeout: 2000, run }) };
  const [world, effects] = initialSystemTransition(logic);
  const [next, cancellations] = advanceSystemTime(logic, freeze(world), {
    time: 6000
  });
  expect(next.actors.root.snapshot.status).toBe('error');
  expect(next.actors.root.snapshot.error).toMatchObject({
    $error: 'TimeoutError'
  });
  expect(cancellations).toContainEqual(
    expect.objectContaining({
      type: 'xstate.system.cancelEffect',
      params: { effectId: effects[0].id }
    })
  );
  expect(run).not.toHaveBeenCalled();
  expect(() =>
    systemTransition(logic, next, 'root', {
      type: 'xstate.system.effect.result',
      effectId: effects[0].id,
      event: { type: 'xstate.async.resolve', data: 42 }
    })
  ).toThrow('stale');
});

it('processes state and invoke timeouts in the same deadline order', () => {
  const child = createCallbackLogic(() => {});
  const logic = {
    root: createMachine({
      id: 'root',
      initial: 'active',
      states: {
        active: {
          timeout: 6000,
          onTimeout: { target: 'late' },
          invoke: {
            id: 'child',
            src: child,
            timeout: 2000,
            onTimeout: { target: 'done' }
          }
        },
        done: {},
        late: {}
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  const [next] = advanceSystemTime(logic, freeze(world), { time: 6000 });
  expect(next.actors.root.snapshot.value).toBe('done');
  expect(next.actors['root/child'].snapshot.status).toBe('stopped');
  expect(next.timers).toEqual({});
});

it('models delayed sends through the source timer before child completion', () => {
  const child = createMachine({
    initial: 'waiting',
    states: {
      waiting: { on: { PING: { target: 'done' } } },
      done: { type: 'final' }
    }
  });
  const logic = {
    root: createMachine({
      id: 'root',
      initial: 'active',
      states: {
        active: {
          invoke: { id: 'child', src: child, onDone: { target: 'done' } },
          on: {
            SEND: ({ children }, enq) =>
              enq.sendTo(
                children.child,
                { type: 'PING' },
                { delay: 1000, id: 'ping' }
              )
          }
        },
        done: {}
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  const [scheduled] = systemTransition(logic, world, 'root', { type: 'SEND' });
  const [next] = advanceSystemTime(logic, freeze(scheduled), { time: 1000 });
  expect(next.actors.root.snapshot.value).toBe('done');
  expect(next.timers).toEqual({});
});

it('stops a world subtree and resolves registry lookups from snapshot data', () => {
  const child = createMachine({
    on: { PING: { context: { received: true } } },
    context: { received: false }
  });
  const logic = {
    root: createMachine({
      id: 'root',
      invoke: { id: 'child', src: child, registryKey: 'worker' },
      on: {
        SEND: ({ system }, enq) =>
          enq.sendTo(system.get('worker')!, { type: 'PING' })
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  const [next] = systemTransition(logic, freeze(world), 'root', {
    type: 'SEND'
  });
  expect(next.actors['root/child'].snapshot.context.received).toBe(true);
  const [stopped] = systemTransition(logic, freeze(next), 'root', {
    type: '@xstate.stop'
  });
  expect(stopped.actors.root.snapshot.status).toBe('stopped');
  expect(stopped.actors['root/child'].snapshot.status).toBe('stopped');
  expect(stopped.registry).toEqual({});
});

it('preserves generated actor identity counters across independent branches', () => {
  const child = createMachine({});
  const logic = {
    root: createMachine({
      id: 'root',
      actors: { child },
      on: {
        SPAWN: ({ actors }, enq) => {
          enq.spawn(actors.child);
          enq.spawn(actors.child);
        }
      }
    })
  };
  const [world] = initialSystemTransition(logic);
  const [left] = systemTransition(logic, freeze(world), 'root', {
    type: 'SPAWN'
  });
  const [right] = systemTransition(logic, world, 'root', { type: 'SPAWN' });
  expect(left).toEqual(right);
  expect(Object.keys(left.actors)).toEqual([
    'root',
    'root/child:0',
    'root/child:1'
  ]);
  const [later] = systemTransition(logic, freeze(left), 'root', {
    type: 'SPAWN'
  });
  expect(Object.keys(later.actors)).toContain('root/child:3');
});

it('restores history without live state-node references', () => {
  const logic = {
    root: createMachine({
      id: 'root',
      initial: 'active',
      states: {
        active: {
          initial: 'a',
          states: {
            a: { on: { NEXT: { target: 'b' } } },
            b: {},
            hist: { type: 'history', target: 'a' }
          },
          on: { EXIT: { target: 'idle' } }
        },
        idle: { on: { BACK: { target: 'active.hist' } } }
      }
    })
  };
  let [world] = initialSystemTransition(logic);
  [world] = systemTransition(logic, world, 'root', { type: 'NEXT' });
  [world] = systemTransition(logic, world, 'root', { type: 'EXIT' });
  const [restored] = systemTransition(
    logic,
    freeze(JSON.parse(JSON.stringify(world))),
    'root',
    { type: 'BACK' }
  );
  expect(restored.actors.root.snapshot.value).toEqual({ active: 'b' });
});

it('does not consult wall time, native timers or live actor instances', () => {
  const logic = {
    root: createMachine({
      id: 'root',
      initial: 'active',
      states: { active: { after: { 1000: { target: 'done' } } }, done: {} }
    })
  };
  const now = vi.spyOn(Date, 'now').mockImplementation(() => {
    throw new Error('wall clock read');
  });
  const timers = vi.spyOn(globalThis, 'setTimeout').mockImplementation(() => {
    throw new Error('native timer scheduled');
  });
  try {
    const [world] = initialSystemTransition(logic);
    expect(
      advanceSystemTime(logic, freeze(world), { time: 1000 })[0].actors.root
        .snapshot.value
    ).toBe('done');
  } finally {
    now.mockRestore();
    timers.mockRestore();
  }
});
