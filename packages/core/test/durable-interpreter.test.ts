import { describe, expect, it } from 'vitest';
import {
  type AnyActor,
  type AnyMachineSnapshot,
  type ExecutableActionObject,
  type Snapshot,
  createMachine
} from '../src/index.ts';

type DurableCommand = {
  effectId: string;
  type:
    | 'spawn'
    | 'start'
    | 'stop'
    | 'terminate'
    | 'schedule'
    | 'cancel'
    | 'send'
    | 'emit';
  sourceKey?: string;
  actorKey?: string;
  targetKey?: string;
  event?: { type: string };
  timerId?: string;
  dueAt?: number;
  src?: string;
  input?: unknown;
  status?: 'done' | 'error';
  output?: unknown;
  error?: unknown;
};

type DurableRecord = {
  snapshot: unknown;
  bindings: Record<string, string>;
  outbox: DurableCommand[];
};

function commitTransition(
  machine: ReturnType<typeof createMachine>,
  snapshot: AnyMachineSnapshot,
  effects: ExecutableActionObject[],
  transitionId: string,
  now: number,
  bindings: Record<string, string> = {}
): DurableRecord {
  const nextBindings = { ...bindings };
  const actorKeys = new Map<AnyActor, string>();

  const seedActorKeys = (
    currentSnapshot: AnyMachineSnapshot,
    parentKey: string
  ) => {
    for (const [id, actor] of Object.entries(currentSnapshot.children) as Array<
      [string, AnyActor | undefined]
    >) {
      if (!actor) {
        continue;
      }
      const slot = `${parentKey}/${id}`;
      const actorKey = nextBindings[slot];
      if (!actorKey) {
        continue;
      }
      actorKeys.set(actor, actorKey);
      const childSnapshot = actor.getSnapshot();
      if (childSnapshot && 'children' in childSnapshot) {
        seedActorKeys(childSnapshot as AnyMachineSnapshot, actorKey);
      }
    }
  };

  seedActorKeys(snapshot, 'root');

  const getActorKey = (actor: AnyActor | undefined) =>
    actor ? (actorKeys.get(actor) ?? 'root') : undefined;
  const outbox: DurableCommand[] = [];

  for (const [index, effect] of effects.entries()) {
    const effectId = `${transitionId}:${index}`;

    if (effect.kind === 'action') {
      if (effect.action) {
        throw new Error(
          `Durable execution requires a registered action, received "${effect.type}"`
        );
      }
      continue;
    }

    if (effect.kind === 'emit') {
      outbox.push({
        effectId,
        type: 'emit',
        sourceKey: getActorKey(effect.source),
        event: effect.event
      });
      continue;
    }

    switch (effect.type) {
      case '@xstate.spawn': {
        if (typeof effect.src !== 'string') {
          throw new Error(
            'Durable execution requires a registered actor source'
          );
        }
        const sourceKey = getActorKey(effect.source) ?? 'root';
        const actorKey = effectId;
        nextBindings[`${sourceKey}/${effect.id}`] = actorKey;
        actorKeys.set(effect.actor, actorKey);
        outbox.push({
          effectId,
          type: 'spawn',
          sourceKey,
          actorKey,
          src: effect.src,
          input: effect.input
        });
        break;
      }
      case '@xstate.start':
        outbox.push({
          effectId,
          type: 'start',
          actorKey: getActorKey(effect.actor)
        });
        break;
      case '@xstate.stop': {
        const sourceKey = getActorKey(effect.source) ?? 'root';
        const slot = `${sourceKey}/${effect.id}`;
        outbox.push({
          effectId,
          type: 'stop',
          sourceKey,
          actorKey: nextBindings[slot]
        });
        delete nextBindings[slot];
        break;
      }
      case '@xstate.terminate':
        outbox.push({
          effectId,
          type: 'terminate',
          actorKey: getActorKey(effect.actor),
          status: effect.status,
          output: effect.output,
          error: effect.error
        });
        break;
      case '@xstate.raise':
        outbox.push({
          effectId,
          type: 'schedule',
          sourceKey: getActorKey(effect.source),
          timerId: effect.id!,
          dueAt: now + (effect.delay ?? 0)
        });
        break;
      case '@xstate.sendTo':
        outbox.push({
          effectId,
          type: effect.delay === undefined ? 'send' : 'schedule',
          sourceKey: getActorKey(effect.source),
          timerId: effect.id,
          ...(effect.delay === undefined
            ? {
                targetKey: getActorKey(effect.target),
                event: effect.event
              }
            : { dueAt: now + effect.delay })
        });
        break;
      case '@xstate.cancel':
        outbox.push({
          effectId,
          type: 'cancel',
          sourceKey: getActorKey(effect.source),
          timerId: effect.id
        });
        break;
    }
  }

  return {
    snapshot: machine.getPersistedSnapshot(snapshot),
    bindings: nextBindings,
    outbox
  };
}

function roundTrip<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

class IdempotentRuntime {
  private readonly applied: Set<string>;
  readonly operations: DurableCommand[];

  constructor(
    persisted: { applied: string[]; operations: DurableCommand[] } = {
      applied: [],
      operations: []
    }
  ) {
    this.applied = new Set(persisted.applied);
    this.operations = persisted.operations;
  }

  execute(commands: DurableCommand[]): void {
    for (const command of commands) {
      if (this.applied.has(command.effectId)) {
        continue;
      }
      this.applied.add(command.effectId);
      this.operations.push(command);
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
  it('commits terminal actor lifecycle to the durable outbox', () => {
    const machine = createMachine({
      initial: 'active',
      states: {
        active: { on: { FINISH: { target: 'done' } } },
        done: { type: 'final' }
      }
    });
    const [active] = machine.initialTransition(undefined);
    const [done, effects] = machine.transition(active, { type: 'FINISH' });

    const record = commitTransition(machine, done, effects, 'finish', 0);

    expect(record.outbox.at(-1)).toMatchObject({
      type: 'terminate',
      actorKey: 'root',
      status: 'done'
    });
    expect(() => JSON.stringify(record)).not.toThrow();
  });

  it('can recover an outbox without duplicate effects or resetting timers', () => {
    const fiveMinutes = 5 * 60 * 1000;
    const startedAt = 1_000_000;
    const worker = createMachine({ on: { PING: {} } });
    const machine = createMachine({
      id: 'workflow',
      actorSources: { worker },
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

    const [initialSnapshot, initialEffects] =
      machine.initialTransition(undefined);
    const initialRecord = commitTransition(
      machine,
      initialSnapshot,
      initialEffects,
      'transition-0',
      startedAt
    );
    const spawn = initialRecord.outbox.find(
      (command) => command.type === 'spawn'
    )!;
    const timer = initialRecord.outbox.find(
      (command) => command.type === 'schedule'
    )!;

    expect(timer.dueAt).toBe(startedAt + fiveMinutes);
    expect(timer).not.toHaveProperty('event');
    expect(timer).not.toHaveProperty('targetKey');
    expect(
      (initialRecord.snapshot as any).timers[timer.timerId!]
    ).toMatchObject({
      delay: fiveMinutes,
      type: '@xstate.raise',
      target: 'self',
      event: { type: expect.stringMatching(/^xstate\.after/) }
    });
    expect(() => JSON.stringify(initialRecord)).not.toThrow();

    // Crash after the external runtime applied two effects but before the
    // workflow acknowledged either outbox item.
    const firstRuntime = new IdempotentRuntime();
    firstRuntime.execute(initialRecord.outbox.slice(0, 2));

    const persistedRecord = roundTrip(initialRecord);
    const resumedRuntime = new IdempotentRuntime(firstRuntime.persist());
    resumedRuntime.execute(persistedRecord.outbox);

    expect(resumedRuntime.operations.map(({ type }) => type)).toEqual([
      'spawn',
      'schedule',
      'start'
    ]);
    expect(
      resumedRuntime.operations.find(({ type }) => type === 'schedule')?.dueAt
    ).toBe(startedAt + fiveMinutes);

    const restoredSnapshot = machine.restoreSnapshot(
      persistedRecord.snapshot as Snapshot<unknown>
    );
    const [timedOutSnapshot, timerEffects] = machine.transition(
      restoredSnapshot,
      {
        type: 'xstate.timer',
        id: timer.timerId!
      } as any
    );
    const timerRecord = commitTransition(
      machine,
      timedOutSnapshot,
      timerEffects,
      'transition-timer',
      timer.dueAt!,
      persistedRecord.bindings
    );

    expect(timedOutSnapshot.value).toBe('timedOut');
    expect(timedOutSnapshot.timers).toEqual({});
    expect(timerRecord.outbox.map(({ type }) => type)).toEqual([
      'cancel',
      'stop'
    ]);

    const [nextSnapshot, nextEffects] = machine.transition(restoredSnapshot, {
      type: 'PING'
    });
    const nextRecord = commitTransition(
      machine,
      nextSnapshot,
      nextEffects,
      'transition-1',
      startedAt + 1000,
      persistedRecord.bindings
    );
    const send = nextRecord.outbox.find((command) => command.type === 'send')!;

    expect(send.targetKey).toBe(spawn.actorKey);

    resumedRuntime.execute(nextRecord.outbox);
    resumedRuntime.execute(roundTrip(nextRecord.outbox));
    expect(
      resumedRuntime.operations.filter(({ type }) => type === 'send')
    ).toHaveLength(1);

    const [reenteredSnapshot, reentryEffects] = machine.transition(
      nextSnapshot,
      { type: 'REENTER' }
    );
    const reentryRecord = commitTransition(
      machine,
      reenteredSnapshot,
      reentryEffects,
      'transition-2',
      startedAt + 2000,
      nextRecord.bindings
    );
    const nextSpawn = reentryRecord.outbox.find(
      (command) => command.type === 'spawn'
    )!;

    expect(reentryRecord.outbox.map(({ type }) => type)).toEqual([
      'cancel',
      'stop',
      'spawn',
      'schedule',
      'start'
    ]);
    expect(
      reentryRecord.outbox.find(({ type }) => type === 'stop')?.actorKey
    ).toBe(spawn.actorKey);
    expect(nextSpawn.actorKey).not.toBe(spawn.actorKey);
  });
});
