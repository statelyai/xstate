import { describe, expect, it } from 'vitest';
import { createMachine } from '../src/index.ts';
import {
  createDurableSystem,
  type DurableSystemEffect
} from '../src/durable/index.ts';

type CommittedEffect = DurableSystemEffect & { dueAt?: number };

const roundTrip = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function commit(
  effects: readonly DurableSystemEffect[],
  now: number
): CommittedEffect[] {
  return effects.map((effect) =>
    effect.type === 'timer.schedule'
      ? { ...effect, dueAt: now + effect.delay }
      : effect
  );
}

class IdempotentRuntime {
  private readonly applied: Set<string>;
  readonly operations: CommittedEffect[];

  constructor(
    persisted: { applied: string[]; operations: CommittedEffect[] } = {
      applied: [],
      operations: []
    }
  ) {
    this.applied = new Set(persisted.applied);
    this.operations = persisted.operations;
  }

  execute(effects: readonly CommittedEffect[]): void {
    for (const effect of effects) {
      if (this.applied.has(effect.id)) {
        continue;
      }
      this.applied.add(effect.id);
      this.operations.push(effect);
    }
  }

  persist() {
    return roundTrip({
      applied: [...this.applied],
      operations: this.operations
    });
  }
}

describe('durable interpreter adapter', () => {
  it('commits terminal actor lifecycle without discovering a root actor', () => {
    const machine = createMachine({
      initial: 'active',
      states: {
        active: { on: { FINISH: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    const durable = createDurableSystem(machine);
    const initial = durable.initialTransition(undefined);
    const done = durable.transition(initial.state, { type: 'FINISH' });

    expect(done.effects.at(-1)).toMatchObject({
      type: 'actor.terminate',
      actor: { id: 'root:0', actorId: 'root' },
      status: 'done'
    });
    expect(() => JSON.stringify(done.effects)).not.toThrow();
  });

  it('recovers an outbox without duplicate effects or resetting actor generations', () => {
    const fiveMinutes = 5 * 60 * 1000;
    const startedAt = 1_000_000;
    const worker = createMachine({ on: { PING: {} } });
    const machine = createMachine({
      id: 'workflow',
      actors: { worker },
      initial: 'running',
      states: {
        running: {
          invoke: { id: 'worker', src: 'worker' },
          after: { [fiveMinutes]: { target: 'timedOut' } },
          on: {
            PING: ({ children }, enq) =>
              enq.sendTo(children.worker, { type: 'PING' }),
            REENTER: { target: 'running', reenter: true }
          }
        },
        timedOut: {}
      }
    });
    const durable = createDurableSystem(machine);
    const initial = durable.initialTransition(undefined);
    const initialOutbox = commit(initial.effects, startedAt);
    const spawn = initialOutbox.find(
      (effect) => effect.type === 'actor.spawn'
    )!;
    const timer = initialOutbox.find(
      (effect) => effect.type === 'timer.schedule'
    )!;

    expect(spawn.actor.id).toBe('worker:1');
    expect(timer.dueAt).toBe(startedAt + fiveMinutes);
    expect(timer.event.type).toMatch(/^xstate\.after/);
    expect(timer.target).toEqual({ id: 'root:0', actorId: 'root' });
    expect(() => JSON.stringify(initialOutbox)).not.toThrow();

    // Crash after two effects were applied, then replay the complete outbox.
    const firstRuntime = new IdempotentRuntime();
    firstRuntime.execute(initialOutbox.slice(0, 2));
    const resumedRuntime = new IdempotentRuntime(firstRuntime.persist());
    resumedRuntime.execute(roundTrip(initialOutbox));

    expect(resumedRuntime.operations.map(({ type }) => type)).toEqual([
      'actor.spawn',
      'timer.schedule',
      'actor.start'
    ]);

    const persisted = roundTrip(
      durable.getPersistedSystemSnapshot(initial.state)
    );
    const restored = durable.restoreSystemSnapshot(persisted);
    const timedOut = durable.transition(restored, timer.event as never);

    expect(timedOut.state.snapshot.value).toBe('timedOut');
    expect(timedOut.effects.map(({ type }) => type)).toEqual([
      'timer.cancel',
      'actor.stop'
    ]);

    const pinged = durable.transition(restored, { type: 'PING' });
    const send = pinged.effects.find((effect) => effect.type === 'event.send')!;
    expect(send.target.id).toBe(spawn.actor.id);

    const reentered = durable.transition(pinged.state, { type: 'REENTER' });
    const stopped = reentered.effects.find(
      (effect) => effect.type === 'actor.stop'
    )!;
    const nextSpawn = reentered.effects.find(
      (effect) => effect.type === 'actor.spawn'
    )!;

    expect(stopped.actor.id).toBe(spawn.actor.id);
    expect(nextSpawn.actor.id).toBe('worker:2');
  });
});
