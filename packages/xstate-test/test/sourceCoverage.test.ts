import { createMachine, types } from 'xstate';
import { createSourceCoverageSession } from '../src/sourceCoverage.ts';

it('collects return outcomes and static microsteps from one calculation', async () => {
  const control = {
    observer: undefined as ((id: string) => void) | undefined,
    faults: 0
  };
  const decide = vi.fn(
    ({ event }: { event: { type: string; ok?: boolean } }) => {
      if (!event.ok) {
        control.observer?.('refused');
        return;
      }
      control.observer?.('accepted');
      return { target: 'route' as const };
    }
  );
  const effect = vi.fn();
  const machine = createMachine({
    schemas: { events: { GO: types<{ ok: boolean }>() } },
    actions: { effect },
    initial: 'idle',
    states: {
      idle: { on: { GO: decide } },
      route: {
        entry: ({ actions }, enq) => {
          enq(actions.effect);
        },
        always: {
          target: 'done',
          [Symbol.for('@statelyai.sourceCoverage')]: 'eventless'
        }
      },
      done: { type: 'final' }
    }
  });
  const session = createSourceCoverageSession(machine, control, {
    runtimeId: 'xstate@test'
  });
  const refused = await session.step({ type: 'GO', ok: false });
  expect(refused.outcomeIds).toEqual(['refused']);
  expect(refused.terminal).toBe(false);
  const accepted = await session.step({ type: 'GO', ok: true });
  expect(accepted.outcomeIds).toEqual(['accepted', 'eventless']);
  expect(accepted.terminal).toBe(true);
  expect(decide).toHaveBeenCalledTimes(2);
  expect(effect).not.toHaveBeenCalled();
  expect(control.observer).toBeUndefined();
  await expect(session.step({ type: 'GO', ok: true })).rejects.toThrow(
    'terminal'
  );
});

it('restores an existing observer and validates events before executing a transition', async () => {
  const previous = vi.fn();
  const control = { observer: previous, faults: 0 };
  const called = vi.fn(() => ({ target: 'done' as const }));
  const machine = createMachine({
    initial: 'idle',
    states: { idle: { on: { GO: called } }, done: { type: 'final' } }
  });
  const session = createSourceCoverageSession(machine, control, {
    runtimeId: 'xstate@test',
    validateEvent: () => {
      throw new Error('invalid payload');
    }
  });
  await expect(session.step({ type: 'GO' })).rejects.toThrow('invalid payload');
  expect(called).not.toHaveBeenCalled();
  expect(control.observer).toBe(previous);
});

it('fails on runtime errors and failed SUT comparisons without accepting partial observations', async () => {
  const control = { observer: undefined, faults: 0 };
  const broken = createMachine({
    initial: 'idle',
    states: {
      idle: {
        on: {
          GO: () => {
            throw new Error('application failure');
          }
        }
      }
    }
  });
  const session = createSourceCoverageSession(broken, control, {
    runtimeId: 'xstate@test'
  });
  await expect(session.step({ type: 'GO' })).rejects.toThrow();
  expect(control.observer).toBeUndefined();
  const machine = createMachine({
    initial: 'idle',
    states: { idle: { on: { GO: { target: 'done' } } }, done: {} }
  });
  const checked = createSourceCoverageSession(machine, control, {
    runtimeId: 'xstate@test',
    check: (_snapshot, event) => {
      if (event) throw new Error('SUT differs');
    }
  });
  await expect(checked.step({ type: 'GO' })).rejects.toThrow('SUT differs');
});

it('collects initial eventless obligations and reports observer faults', () => {
  const control = { observer: undefined, faults: 0 };
  const machine = createMachine({
    initial: 'route',
    states: {
      route: {
        always: {
          target: 'done',
          [Symbol.for('@statelyai.sourceCoverage')]: 'initial-route'
        }
      },
      done: { type: 'final' }
    }
  });
  expect(
    createSourceCoverageSession(machine, control, {
      runtimeId: 'xstate@test'
    }).initial.outcomeIds
  ).toEqual(['initial-route']);
  const broken = createMachine({
    initial: 'idle',
    states: {
      idle: {
        entry: () => {
          control.faults++;
        }
      }
    }
  });
  expect(() =>
    createSourceCoverageSession(broken, control, {
      runtimeId: 'xstate@test'
    })
  ).toThrow('observer failed');
});

it('retains the last accepted snapshot when a SUT comparison fails', async () => {
  const previous = vi.fn();
  const control = { observer: previous, faults: 0 };
  const machine = createMachine({
    initial: 'idle',
    states: {
      idle: { on: { GO: { target: 'done' } } },
      done: { type: 'final' }
    }
  });
  let reject = true;
  const session = createSourceCoverageSession(machine, control, {
    runtimeId: 'xstate@test',
    check: (_snapshot, event) => {
      if (event && reject) throw new Error('SUT differs');
    }
  });
  await expect(session.step({ type: 'GO' })).rejects.toThrow('SUT differs');
  expect(control.observer).toBe(previous);
  reject = false;
  const retried = await session.step({ type: 'GO' });
  expect(retried.snapshot.value).toBe('done');
  expect(retried.terminal).toBe(true);
});

it.each(['initial', 'step'])(
  'rejects promise-returning checks during %s',
  async (phase) => {
    const previous = vi.fn();
    const control = { observer: previous, faults: 0 };
    const machine = createMachine({
      initial: 'idle',
      states: { idle: { on: { GO: { target: 'done' } } }, done: {} }
    });
    const createSession = () =>
      createSourceCoverageSession(machine, control, {
        runtimeId: 'xstate@test',
        check: (_snapshot, event) => {
          if ((phase === 'initial') === (event === undefined))
            return Promise.resolve();
        }
      });
    if (phase === 'initial') {
      expect(createSession).toThrow('synchronous');
    } else {
      await expect(createSession().step({ type: 'GO' })).rejects.toThrow(
        'synchronous'
      );
    }
    expect(control.observer).toBe(previous);
  }
);

it.each(['initial', 'step'])(
  'consumes rejected async checks during %s',
  async (phase) => {
    const control = { observer: undefined, faults: 0 };
    const machine = createMachine({});
    const createSession = () =>
      createSourceCoverageSession(machine, control, {
        runtimeId: 'xstate@test',
        check: (_snapshot, event) => {
          if ((phase === 'initial') === (event === undefined))
            return Promise.reject(new Error('async SUT differs'));
        }
      });
    if (phase === 'initial') {
      expect(createSession).toThrow('synchronous');
    } else {
      await expect(createSession().step({ type: 'GO' })).rejects.toThrow(
        'synchronous'
      );
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
);

it('checks thenables once and restores the observer before checking', async () => {
  const previous = vi.fn();
  const control = { observer: previous, faults: 0 };
  let reads = 0;
  const machine = createMachine({});
  expect(() =>
    createSourceCoverageSession(machine, control, {
      runtimeId: 'xstate@test',
      check: () => {
        expect(control.observer).toBe(previous);
        return {
          get then() {
            reads++;
            if (reads > 1) throw new Error('then read twice');
            return (_resolve: unknown, reject: (error: Error) => void) =>
              reject(new Error('thenable failed'));
          }
        };
      }
    })
  ).toThrow('synchronous');
  expect(reads).toBe(1);
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
});

it('rejects overlapping steps before validating against a stale snapshot', async () => {
  const control = { observer: undefined, faults: 0 };
  const machine = createMachine({
    initial: 'idle',
    states: {
      idle: { on: { GO: { target: 'done' } } },
      done: { type: 'final' }
    }
  });
  let release = () => {};
  const validateEvent = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      })
  );
  const session = createSourceCoverageSession(machine, control, {
    runtimeId: 'xstate@test',
    validateEvent
  });
  const first = session.step({ type: 'GO' });
  await expect(session.step({ type: 'GO' })).rejects.toThrow('concurrent');
  expect(validateEvent).toHaveBeenCalledTimes(1);
  release();
  expect((await first).terminal).toBe(true);
});

it('retains accepted state when serializing a candidate fails', async () => {
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  let payload: unknown = cyclic;
  const machine = createMachine({
    schemas: { context: types<{ payload: unknown }>() },
    context: { payload: null },
    initial: 'idle',
    states: {
      idle: { on: { GO: () => ({ target: 'done', context: { payload } }) } },
      done: { type: 'final' }
    }
  });
  const session = createSourceCoverageSession(
    machine,
    { observer: undefined, faults: 0 },
    {
      runtimeId: 'xstate@test'
    }
  );
  await expect(session.step({ type: 'GO' })).rejects.toThrow(/circular/i);
  payload = 'serializable';
  const retried = await session.step({ type: 'GO' });
  expect(retried.snapshot.context.payload).toBe('serializable');
  expect(retried.terminal).toBe(true);
});
