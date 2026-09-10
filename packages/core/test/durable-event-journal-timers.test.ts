import { describe, expect, it, vi } from 'vitest';
import { createMachine, setup, type AnyActor } from '../src/index.ts';
import { createDurable } from '../src/durable/index.ts';

interface JournalEntry {
  address: string;
  event: { type: string; id?: string };
}

interface PendingTimer {
  address: string;
  id: string;
  delay: number;
  event: { type: 'xstate.timer'; id: string };
}

const timerKey = (address: string, id: string) => `${address}:${id}`;

function createEventJournalHost(
  machine: ReturnType<typeof createMachine>,
  journal: JournalEntry[]
) {
  const pending = new Map<string, PendingTimer>();
  const armTimer = vi.fn<(timer: PendingTimer) => void>((timer) => {
    pending.set(timerKey(timer.address, timer.id), timer);
  });
  const cancelTimer = vi.fn<(source: AnyActor, id: string) => void>(
    (source, id) => pending.delete(timerKey(source.address, id))
  );
  const cancelAllTimers = vi.fn<(source: AnyActor) => void>((source) => {
    for (const [key, timer] of pending) {
      if (timer.address === source.address) {
        pending.delete(key);
      }
    }
  });

  const durable = createDurable(machine, {
    executionId: 'event-journal-test',
    executeAction: () => {},
    scheduleTimer: (source, id, delay) => {
      const event = { type: 'xstate.timer' as const, id };
      const alreadyFired = journal.some(
        (entry) =>
          entry.address === source.address &&
          entry.event.type === event.type &&
          entry.event.id === id
      );
      if (!alreadyFired) {
        armTimer({ address: source.address, id, delay, event });
      }
    },
    cancelTimer,
    cancelAllTimers,
    waitForEvent: () => {
      throw new Error('The event-journal host drives transitions directly');
    }
  });

  const replay = async () => {
    let [snapshot, effects] = durable.initialTransition();
    await durable.executeEffects(effects);
    for (const entry of journal) {
      expect(entry.address).toBe(durable.rootAddress);
      [snapshot, effects] = durable.transition(snapshot, entry.event as never);
      await durable.executeEffects(effects);
    }
    return snapshot;
  };

  return {
    durable,
    pending,
    armTimer,
    cancelTimer,
    cancelAllTimers,
    replay
  };
}

describe('durable event-journal timers', () => {
  const timerMachine = createMachine({
    id: 'reminder',
    initial: 'waiting',
    states: {
      waiting: {
        after: { 5000: { target: 'done' } },
        on: { EXIT: { target: 'cancelled' } }
      },
      done: { type: 'final' },
      cancelled: { type: 'final' }
    }
  });

  it('fires a recorded timer after tearing down and replaying a fresh execution', async () => {
    const journal: JournalEntry[] = [];
    const firstProcess = createEventJournalHost(timerMachine, journal);
    const waiting = await firstProcess.replay();
    const [pendingTimer] = firstProcess.pending.values();

    expect(waiting.value).toBe('waiting');
    expect(pendingTimer).toEqual({
      address: 'reminder',
      id: expect.any(String),
      delay: 5000,
      event: { type: 'xstate.timer', id: expect.any(String) }
    });
    expect(pendingTimer.event.id).toBe(pendingTimer.id);

    // The scheduler wakes a new process. Journal-first means recording the
    // firing before replaying it through a freshly-created execution.
    journal.push({
      address: pendingTimer.address,
      event: pendingTimer.event
    });
    const secondProcess = createEventJournalHost(timerMachine, journal);
    const done = await secondProcess.replay();

    expect(done.value).toBe('done');
    expect(done.status).toBe('done');
    expect(secondProcess.pending.size).toBe(0);
  });

  it('does not re-arm a timer whose firing is already journaled', async () => {
    const firstProcess = createEventJournalHost(timerMachine, []);
    await firstProcess.replay();
    const [timer] = firstProcess.pending.values();
    const journal: JournalEntry[] = [
      { address: timer.address, event: timer.event }
    ];

    const replayProcess = createEventJournalHost(timerMachine, journal);
    await replayProcess.replay();

    expect(replayProcess.armTimer).not.toHaveBeenCalled();
    expect(replayProcess.pending.size).toBe(0);
  });

  it('cancels a pending timer when a journaled event exits its state', async () => {
    const journal: JournalEntry[] = [
      { address: 'reminder', event: { type: 'EXIT' } }
    ];
    const process = createEventJournalHost(timerMachine, journal);
    const cancelled = await process.replay();

    expect(cancelled.value).toBe('cancelled');
    expect(process.cancelTimer).toHaveBeenCalledWith(
      expect.objectContaining({ address: 'reminder' }),
      expect.any(String)
    );
    expect(process.pending.size).toBe(0);
  });

  it('routes child-owned timer cleanup through the adapter', async () => {
    const child = createMachine({
      id: 'childLogic',
      initial: 'waiting',
      states: {
        waiting: { after: { 5000: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    const parent = setup({ actors: { child } }).createMachine({
      id: 'parent',
      initial: 'running',
      states: {
        running: {
          invoke: { id: 'child', src: 'child' },
          on: { EXIT: { target: 'done' } }
        },
        done: { type: 'final' }
      }
    });
    const process = createEventJournalHost(parent, [
      { address: 'parent', event: { type: 'EXIT' } }
    ]);

    await process.replay();

    expect(process.cancelAllTimers).toHaveBeenCalledWith(
      expect.objectContaining({ address: 'parent/child' })
    );
    expect(process.pending.size).toBe(0);
  });
});
