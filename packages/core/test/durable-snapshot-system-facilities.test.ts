import {
  createActor,
  createCallbackLogic,
  createMachine,
  deliverEvent,
  initialTransition,
  setup,
  transition
} from '../src/index.ts';
import { standardSchemaValidator } from '../src/validation/index.ts';
import { z } from 'zod';
import { createDurable } from '../src/durable/index.ts';
import type { AnyActor, ExecutableEffect } from '../src/types.ts';

describe('durable snapshot system facilities', () => {
  it('keeps identity and inspection when adopting a lazy pure snapshot', async () => {
    const machine = createMachine({
      context: { session: '' },
      on: {
        GO: ({ self }) => ({ context: { session: self.sessionId } })
      }
    });
    const [snapshot] = initialTransition(machine);
    const observed: string[] = [];
    const execution = createDurable(
      machine,
      {
        executionId: 'pinned',
        executeAction: (effect) => effect.exec(),
        waitForEvent: () => ({ type: 'GO' }),
        sendEvent: () => {}
      },
      { inspect: (event) => observed.push(event.type) }
    );
    const [next, effects] = execution.transition(snapshot, { type: 'GO' });
    await execution.executeEffects(effects);
    expect(next.context.session).toBe('pinned:0');
    expect(observed).toEqual([
      '@xstate.actor',
      '@xstate.actor',
      '@xstate.transition'
    ]);
  });

  it('routes rejected events from an adopted pure snapshot to the host', async () => {
    const machine = setup({
      validator: standardSchemaValidator(),
      schemas: {
        events: { GO: z.object({ count: z.number() }), PEEK: z.object({}) }
      }
    }).createMachine({
      context: { count: 0 },
      on: {
        PEEK: ({ context, self }) => ({
          context: { count: context.count + Number(Boolean(self.id)) }
        }),
        GO: () => {}
      }
    });
    const rejected: Array<{ event: unknown; reason: string }> = [];
    const execution = createDurable(machine, {
      executeAction: (effect) => effect.exec(),
      waitForEvent: () => ({ type: 'PEEK' }),
      deadLetter: (_source, _target, event, reason) => {
        rejected.push({ event, reason });
      }
    });
    const [, initialEffects] = execution.initialTransition();
    await execution.executeEffects(initialEffects);
    const [initial] = initialTransition(machine);
    const [snapshot] = transition(machine, initial, { type: 'PEEK' });
    const invalid = { type: 'GO' as const, count: 'invalid' };
    // @ts-expect-error Exercise runtime validation of an untrusted event.
    const [next, effects] = execution.transition(snapshot, invalid);
    await execution.executeEffects(effects);
    expect(next).toBe(snapshot);
    expect(rejected).toEqual([{ event: invalid, reason: 'invalidEvent' }]);
  });

  it('routes two executions adopting one snapshot through their own adapters', async () => {
    const child = createMachine({});
    const machine = setup({ actors: { child } }).createMachine({
      invoke: { id: 'child', src: 'child' },
      on: {
        GO: ({ self, children }, enq) => {
          void self.id;
          enq.sendTo(children.child, { type: 'PING' });
        }
      }
    });
    const log: string[] = [];
    const make = (name: string) =>
      createDurable(
        machine,
        {
          executeAction: (effect) => effect.exec(),
          waitForEvent: () => ({ type: 'GO' }),
          sendEvent: (_source, _target, event) => {
            log.push(`${name}:${event.type}`);
          }
        },
        { captureRootEvents: false }
      );
    const [snapshot] = initialTransition(machine);
    const a = make('A');
    const b = make('B');
    const [, aEffects] = a.transition(snapshot, { type: 'GO' });
    const [, bEffects] = b.transition(snapshot, { type: 'GO' });
    await a.executeEffects(aEffects);
    await b.executeEffects(bEffects);
    expect(log).toEqual(['A:PING', 'B:PING']);
  });

  it('keeps a live output routed to its execution when another adopts it', async () => {
    const child = createCallbackLogic(({ receive, sendBack }) => {
      receive(() => sendBack({ type: 'PONG' }));
    });
    const machine = setup({ actors: { child } }).createMachine({
      invoke: { id: 'child', src: 'child' },
      on: {
        GO: ({ children }, enq) => enq.sendTo(children.child, { type: 'PING' }),
        PONG: () => {}
      }
    });
    const log: string[] = [];
    const make = (name: string) =>
      createDurable(
        machine,
        {
          executeAction: (effect) => effect.exec(),
          waitForEvent: () => ({ type: 'GO' }),
          sendEvent: (source, target, event) => {
            log.push(`${name}:${event.type}`);
            return deliverEvent(source, target, event);
          }
        },
        { captureRootEvents: false }
      );
    const a = make('A');
    const b = make('B');
    let [snapshot, effects] = a.initialTransition();
    await a.executeEffects(effects);
    [snapshot, effects] = a.transition(snapshot, { type: 'GO' });
    b.transition(snapshot, { type: 'GO' });
    await a.executeEffects(effects);
    expect(log[0]).toBe('A:PING');
  });

  it('does not give a nested pure transition the outer runtime', async () => {
    const received: string[] = [];
    const target = createActor(
      createCallbackLogic(({ receive }) => {
        receive((event) => received.push(event.type));
      })
    ).start();
    const nested = createMachine({
      on: {
        GO: ({ self }, enq) => {
          void self.id;
          enq.sendTo(target, { type: 'PING' });
        }
      }
    });
    const [seed] = initialTransition(nested);
    const [view] = transition(nested, seed, { type: 'GO' });
    let nestedEffects: ExecutableEffect[] = [];
    const outer = createMachine({
      on: {
        RUN: () => {
          [, nestedEffects] = transition(nested, view, { type: 'GO' });
        }
      }
    });
    const routes: string[] = [];
    const execution = createDurable(outer, {
      executeAction: (effect) => effect.exec(),
      waitForEvent: () => ({ type: 'RUN' }),
      sendEvent: (_source, _target, event) => {
        routes.push(event.type);
      }
    });
    const [snapshot] = execution.initialTransition();
    execution.transition(snapshot, { type: 'RUN' });
    expect(nestedEffects).toHaveLength(1);
    for (const effect of nestedEffects) await effect.exec();
    expect(routes).toEqual([]);
    expect(received).toEqual(['PING']);
    target.stop();
  });

  it('does not give a nested runtime-less execution the outer runtime', () => {
    let innerRuntime: unknown = 'not observed';
    const innerMachine = createMachine({
      on: {
        TICK: ({ self }) => {
          innerRuntime = self.system.runtime;
        }
      }
    });
    const inner = createDurable(innerMachine, {
      executeAction: (effect) => effect.exec(),
      waitForEvent: () => ({ type: 'TICK' })
    });
    const [innerSnapshot] = inner.initialTransition();
    const outer = createMachine({
      on: {
        RUN: () => {
          inner.transition(innerSnapshot, { type: 'TICK' });
        }
      }
    });
    const execution = createDurable(outer, {
      executeAction: (effect) => effect.exec(),
      waitForEvent: () => ({ type: 'RUN' }),
      sendEvent: () => {}
    });
    const [snapshot] = execution.initialTransition();
    execution.transition(snapshot, { type: 'RUN' });
    expect(innerRuntime).toBeUndefined();
  });

  it('does not register an inspector twice when adopting a silent view', () => {
    const machine = createMachine({
      context: { n: 0 },
      on: {
        GO: ({ context, self }) => {
          void self.id;
          return { context: { n: context.n + 1 } };
        }
      }
    });
    const aEvents: string[] = [];
    const bEvents: string[] = [];
    const make = (events: string[]) =>
      createDurable(
        machine,
        {
          executeAction: (effect) => effect.exec(),
          waitForEvent: () => ({ type: 'GO' }),
          sendEvent: () => {}
        },
        { inspect: (event) => events.push(event.type) }
      );
    const a = make(aEvents);
    const b = make(bEvents);
    const [root] = a.initialTransition();
    const [view] = transition(machine, root, { type: 'GO' });
    a.getActorRef(view);
    b.transition(view, { type: 'UNKNOWN' });
    const before = bEvents.length;
    a.transition(root, { type: 'GO' });
    expect(bEvents.slice(before)).toEqual([
      '@xstate.actor',
      '@xstate.transition'
    ]);
  });

  it.each([
    ['silent', false],
    ['silent', true],
    ['forwarding', false],
    ['forwarding', true]
  ] as const)(
    'preserves inspection and deferred sends from a %s view (runtime: %s)',
    async (viewKind, hostRuntime) => {
      const deliveries: string[] = [];
      const target = createActor(
        createCallbackLogic(({ receive }) => {
          receive((event) => deliveries.push(event.type));
        })
      ).start();
      const machine = createMachine({
        context: { n: 0 },
        on: {
          MAKE: ({ context, self }) => {
            void self.id;
            return { context: { n: context.n + 1 } };
          },
          SEND: ({ self }, enq) => {
            void self.id;
            enq.sendTo(target, { type: 'PING' });
          }
        }
      });
      const seenA: string[] = [];
      const seenB: string[] = [];
      const routes: string[] = [];
      let source: AnyActor | undefined;
      const logic: typeof machine = Object.create(machine);
      logic.transition = (snapshot, event, scope) => {
        if (!scope) throw new Error('Expected a transition scope');
        source = scope.self;
        const [, effects] = machine.transition(snapshot, event, scope);
        return [snapshot, effects];
      };
      const a = createDurable(
        machine,
        {
          executeAction: (effect) => effect.exec(),
          waitForEvent: () => ({ type: 'MAKE' }),
          sendEvent: (sender, recipient, event) => {
            routes.push(`A:${event.type}`);
            return deliverEvent(sender, recipient, event);
          }
        },
        {
          inspect: (event) => seenA.push(event.type),
          captureRootEvents: false
        }
      );
      const b = createDurable(
        logic,
        {
          executeAction: (effect) => effect.exec(),
          waitForEvent: () => ({ type: 'SEND' }),
          ...(hostRuntime
            ? {
                sendEvent: (
                  sender: AnyActor | undefined,
                  recipient: AnyActor,
                  event: { type: string }
                ) => {
                  routes.push(`B:${event.type}`);
                  expect(sender).toBe(source);
                  expect(recipient).toBe(target);
                  expect(event).toEqual({ type: 'PING' });
                  return deliverEvent(sender, recipient, event);
                }
              }
            : {})
        },
        {
          inspect: (event) => seenB.push(event.type),
          captureRootEvents: false
        }
      );
      const [root] = a.initialTransition();
      const [view] =
        viewKind === 'silent'
          ? transition(machine, root, { type: 'MAKE' })
          : a.transition(root, { type: 'MAKE' });
      const beforeB = { a: seenA.length, b: seenB.length };
      const [same, effects] = b.transition(view, { type: 'SEND' });
      expect(same).toBe(view);
      const afterB = { a: seenA.slice(beforeB.a), b: seenB.slice(beforeB.b) };
      const beforeA = { a: seenA.length, b: seenB.length };
      a.transition(root, { type: 'MAKE' });
      const afterA = { a: seenA.slice(beforeA.a), b: seenB.slice(beforeA.b) };
      const beforeEffects = { a: seenA.length, b: seenB.length };
      if (hostRuntime) await b.executeEffects(effects);
      else
        await expect(b.executeEffects(effects)).rejects.toThrow(
          /runtime.sendEvent is not a function/
        );
      const afterEffects = {
        a: seenA.slice(beforeEffects.a),
        b: seenB.slice(beforeEffects.b)
      };
      const announcements = ['@xstate.actor', '@xstate.transition'];
      expect(afterB).toEqual({
        a: viewKind === 'silent' ? [] : announcements,
        b: []
      });
      expect(afterA).toEqual({
        a: announcements,
        b: viewKind === 'silent' ? announcements : []
      });
      expect(afterEffects).toEqual({ a: [], b: [] });
      expect(routes).toEqual(hostRuntime ? ['B:PING'] : []);
      expect(deliveries).toEqual(hostRuntime ? ['PING'] : []);
      target.stop();
    }
  );

  it('keeps timers separate when two executions adopt the same snapshot', async () => {
    let next = 0;
    const pending = new Map<number, () => void>();
    const cleared: number[] = [];
    const set = vi
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation((callback) => {
        const id = next++;
        pending.set(id, callback as () => void);
        return id as never;
      });
    const clear = vi
      .spyOn(globalThis, 'clearTimeout')
      .mockImplementation((id) => {
        cleared.push(id as number);
        pending.delete(id as number);
      });
    try {
      const machine = createMachine({
        initial: 'idle',
        states: {
          idle: { on: { GO: { target: 'waiting' } } },
          waiting: {
            after: { 30: { target: 'expired' } },
            on: { LEAVE: { target: 'done' } }
          },
          expired: {},
          done: {}
        }
      });
      const [snapshot] = initialTransition(machine);
      const make = () =>
        createDurable(machine, {
          executeAction: (effect) => effect.exec(),
          waitForEvent: () => ({ type: 'GO' }),
          sendEvent: () => {}
        });
      const a = make();
      const b = make();
      const [aState, aEffects] = a.transition(snapshot, { type: 'GO' });
      const [, bEffects] = b.transition(snapshot, { type: 'GO' });
      await a.executeEffects(aEffects);
      await b.executeEffects(bEffects);
      const [, cancel] = a.transition(aState, { type: 'LEAVE' });
      await a.executeEffects(cancel);
      expect(cleared).toEqual([0]);
      expect([...pending.keys()]).toEqual([1]);
    } finally {
      set.mockRestore();
      clear.mockRestore();
    }
  });
  it('cancels a timer scheduled before adopting the snapshot', async () => {
    vi.useFakeTimers();
    try {
      const machine = createMachine({
        initial: 'waiting',
        states: {
          waiting: {
            after: { 30: { target: 'expired' } },
            on: { LEAVE: { target: 'left' } }
          },
          expired: {},
          left: {}
        }
      });
      const [snapshot, initialEffects] = initialTransition(machine);
      for (const effect of initialEffects) await effect.exec();
      expect(vi.getTimerCount()).toBe(1);
      const execution = createDurable(machine, {
        executeAction: (effect) => effect.exec(),
        waitForEvent: () => ({ type: 'LEAVE' }),
        sendEvent: () => {}
      });
      const [next, effects] = execution.transition(snapshot, { type: 'LEAVE' });
      await execution.executeEffects(effects);
      expect(next.value).toBe('left');
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
