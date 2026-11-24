import { z } from 'zod';
import {
  advanceSystemTime,
  createActor,
  createAsyncLogic,
  createMachine,
  describeExecutableEffect,
  initialSystemTransition,
  initialTransition,
  systemTransition,
  transition
} from '../src';
import { restoreActor } from '../src/persist/index.ts';

// Document stores such as Convex and MongoDB reject field names that start
// with `$` (Convex also rejects `_`), so serialized output must avoid them.
function reservedKeys(value: unknown, path = ''): string[] {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(/^[$_]/.test(key) ? [`${path}.${key}`] : []),
    ...reservedKeys(child, `${path}.${key}`)
  ]);
}

function toJSON(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

const child = createMachine({
  id: 'child',
  initial: 'idle',
  states: { idle: { on: { PING: { target: 'pinged' } } }, pinged: {} }
});

const parent = createMachine({
  id: 'parent',
  actors: { child },
  context: { spawned: undefined as any, generated: undefined as any },
  entry: (_, enq) => {
    // Numbered by the snapshot's timer counter.
    enq.raise({ type: 'TICK' }, { delay: 2000 });
    return {
      context: {
        spawned: enq.spawn(child, { id: 'spawned' }),
        // Generated id, recorded in the snapshot's id counters.
        generated: enq.spawn(child)
      }
    };
  },
  initial: 'active',
  states: {
    active: {
      invoke: { id: 'invoked', src: 'child' },
      initial: 'a',
      states: {
        a: { after: { 1000: { target: 'b' } } },
        b: {},
        hist: { type: 'history', target: 'a' }
      },
      after: { 5000: { target: 'idle' } },
      on: {
        KICK: ({ children }, enq) => {
          enq.sendTo(children.invoked!, { type: 'PING' });
        },
        STOP: ({ context }, enq) => {
          enq.stop(context.spawned);
        },
        PAUSE: { target: 'idle' }
      }
    },
    idle: { on: { RESUME: { target: 'active.hist' } } }
  }
});

it('persisted snapshots use storage-safe keys', () => {
  const actor = createActor(parent).start();
  actor.send({ type: 'PAUSE' });
  actor.send({ type: 'RESUME' });
  const persisted = toJSON(actor.getPersistedSnapshot());
  actor.stop();
  expect(persisted.children.invoked).toBeDefined();
  expect(persisted.timers.length).toBeGreaterThan(0);
  expect(persisted.nextTimerId).toBeGreaterThan(0);
  expect(persisted.nextActorIds).toBeDefined();
  expect(reservedKeys(persisted)).toEqual([]);

  // Restores from the storage-safe shape.
  const restored = restoreActor(parent, persisted).start();
  const repersisted = toJSON(restored.getPersistedSnapshot());
  restored.stop();
  expect(repersisted.nextTimerId).toBe(persisted.nextTimerId);
  expect(repersisted.nextActorIds).toEqual(persisted.nextActorIds);
});

it('effect descriptors for spawn, start, sendTo and stop use storage-safe keys', () => {
  const [snapshot, initialEffects] = initialTransition(parent);
  const [kicked, kickEffects] = transition(parent, snapshot, { type: 'KICK' });
  const [, stopEffects] = transition(parent, kicked, { type: 'STOP' });
  const descriptors = [...initialEffects, ...kickEffects, ...stopEffects].map(
    (effect) => toJSON(describeExecutableEffect(effect))
  );
  const types = descriptors.map((d) => d.type);
  for (const type of ['spawn', 'start', 'sendTo', 'stop']) {
    expect(types.some((t: string) => t.includes(type))).toBe(true);
  }
  expect(reservedKeys(descriptors)).toEqual([]);
});

it('systemTransition snapshots use storage-safe keys', () => {
  const mapSnapshot = (snapshot: any) => ({
    type: 'SNAPSHOT' as const,
    value: snapshot.value
  });
  const failing = createAsyncLogic({
    id: 'failing',
    timeout: 100,
    run: async () => 1
  });
  const logic = {
    mappers: { snapshot: mapSnapshot },
    actors: { child, failing },
    root: createMachine({
      id: 'root',
      schemas: { events: { SNAPSHOT: z.object({ value: z.unknown() }) } },
      context: { last: undefined as unknown },
      entry: (_, enq) => {
        enq.subscribeTo(enq.spawn(child, { id: 'child' }), {
          snapshot: mapSnapshot
        });
        enq.spawn(failing, { id: 'failing' });
      },
      initial: 'a',
      states: { a: { after: { 1000: { target: 'b' } } }, b: {} },
      on: {
        SNAPSHOT: ({ event }) => ({ context: { last: event.value } })
      }
    })
  };
  const [snapshot] = initialSystemTransition(logic);
  const [timedOut] = advanceSystemTime(logic, toJSON(snapshot), { time: 500 });
  expect(timedOut.actors['root/failing'].snapshot.status).toBe('error');
  const [next] = systemTransition(logic, toJSON(timedOut), 'root/child', {
    type: 'PING'
  });
  expect(next.actors['root/child'].snapshot.value).toBe('pinged');
  expect(reservedKeys(toJSON(snapshot))).toEqual([]);
  expect(reservedKeys(toJSON(timedOut))).toEqual([]);
  expect(reservedKeys(toJSON(next))).toEqual([]);
});
