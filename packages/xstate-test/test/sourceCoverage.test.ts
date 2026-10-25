import { createMachine, types } from 'xstate';
import { createXStateSourceCoverageSession } from '../src/sourceCoverage.ts';

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
        always: {
          target: 'done',
          [Symbol.for('@statelyai.sourceCoverage')]: 'eventless'
        }
      },
      done: { type: 'final' }
    }
  });
  const session = createXStateSourceCoverageSession(machine, control, {
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
  const session = createXStateSourceCoverageSession(machine, control, {
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
  const session = createXStateSourceCoverageSession(broken, control, {
    runtimeId: 'xstate@test'
  });
  await expect(session.step({ type: 'GO' })).rejects.toThrow();
  expect(control.observer).toBeUndefined();
  const machine = createMachine({
    initial: 'idle',
    states: { idle: { on: { GO: { target: 'done' } } }, done: {} }
  });
  const checked = createXStateSourceCoverageSession(machine, control, {
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
    createXStateSourceCoverageSession(machine, control, {
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
    createXStateSourceCoverageSession(broken, control, {
      runtimeId: 'xstate@test'
    })
  ).toThrow('observer failed');
});
