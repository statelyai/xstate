import { createMachine, initialTransition, setup } from '../src/index.ts';
import { createDurable } from '../src/durable/index.ts';

describe('durable execution system ownership', () => {
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
