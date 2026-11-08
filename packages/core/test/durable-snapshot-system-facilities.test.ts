import {
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
