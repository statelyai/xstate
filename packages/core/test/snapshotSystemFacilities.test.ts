import { createActor, createMachine, transition } from '../src/index.ts';
import { createDurable } from '../src/durable/index.ts';
import { createSnapshotSystem } from '../src/snapshotActorRef.ts';
import type { Clock } from '../src/system.ts';

function fakeClock() {
  let nextId = 0;
  const callbacks = new Map<number, () => void>();
  const cleared: number[] = [];
  const clock: Clock = {
    now: () => 0,
    setTimeout: (callback) => {
      const id = nextId++;
      callbacks.set(id, callback);
      return id;
    },
    clearTimeout: (id) => {
      cleared.push(id);
      callbacks.delete(id);
    }
  };
  return {
    clock,
    cleared,
    fire: () => {
      const pending = [...callbacks.values()];
      for (const callback of pending) callback();
      return pending.length;
    }
  };
}

function timerMachine(readSelf: boolean) {
  const go = readSelf
    ? ({ self }: { self: { id: string } }) => {
        void self.id;
        return { target: 'waiting' as const };
      }
    : { target: 'waiting' as const };
  return createMachine({
    initial: 'idle',
    states: {
      idle: { on: { GO: go } },
      waiting: {
        after: { 30: { target: 'expired' } },
        on: { LEAVE: { target: 'left' } }
      },
      expired: {},
      left: {}
    }
  });
}

describe('snapshot system execution facilities', () => {
  it.each([false, true])(
    'cancels a prior pure-transition timer (read self: %s)',
    async (readSelf) => {
      const { clock, cleared, fire } = fakeClock();
      const machine = timerMachine(readSelf);
      const actor = createActor(machine, { clock });
      let [snapshot, effects] = transition(machine, actor.getSnapshot(), {
        type: 'GO'
      });
      for (const effect of effects) await effect.exec();
      [snapshot, effects] = transition(machine, snapshot, { type: 'LEAVE' });
      for (const effect of effects) await effect.exec();
      expect(cleared).toEqual([0]);
      expect(fire()).toBe(0);
      expect(snapshot.value).toBe('left');
    }
  );

  it.each([false, true])(
    'cancels a prior durable-transition timer (read self: %s)',
    async (readSelf) => {
      const { clock, cleared, fire } = fakeClock();
      const machine = timerMachine(readSelf);
      const execution = createDurable(machine, {
        executeAction: (effect) => effect.exec(),
        waitForEvent: () => ({ type: 'GO' }),
        sendEvent: () => {}
      });
      let [snapshot, effects] = execution.initialTransition();
      await execution.executeEffects(effects);
      const system = execution.getActorRef(snapshot)!.system;
      const executionSystem: typeof system = Object.hasOwn(
        system,
        '_sendInspectionEvent'
      )
        ? Object.getPrototypeOf(system)
        : system;
      executionSystem._clock = clock;
      [snapshot, effects] = execution.transition(snapshot, { type: 'GO' });
      await execution.executeEffects(effects);
      [snapshot, effects] = execution.transition(snapshot, { type: 'LEAVE' });
      await execution.executeEffects(effects);
      expect(cleared).toEqual([0]);
      expect(fire()).toBe(0);
      expect(snapshot.value).toBe('left');
    }
  );

  it('preserves rejection listeners registered before the next view', () => {
    const root = createActor(createMachine({})).system;
    const parent = createSnapshotSystem(root, {});
    const listener = vi.fn();
    const subscription = parent.onRejectedEvent(listener);
    const child = createSnapshotSystem(parent, {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      child.deadLetter(
        undefined,
        undefined,
        { type: 'MISSING' },
        'missingTarget'
      );
      expect(listener).toHaveBeenCalledOnce();
      subscription.unsubscribe();
      child.deadLetter(
        undefined,
        undefined,
        { type: 'LATER' },
        'missingTarget'
      );
      expect(listener).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it('forwards emitted subscriptions across views and supports unsubscribe', () => {
    const actor = createActor(createMachine({}));
    const parent = createSnapshotSystem(actor.system, {});
    const child = createSnapshotSystem(parent, {});
    const listener = vi.fn();
    const subscription = parent.onEmitted(listener);
    child._notifyEmitted(actor, { type: 'READY' });
    expect(listener).toHaveBeenCalledOnce();
    subscription.unsubscribe();
    child._notifyEmitted(actor, { type: 'LATER' });
    expect(listener).toHaveBeenCalledOnce();
  });
});
