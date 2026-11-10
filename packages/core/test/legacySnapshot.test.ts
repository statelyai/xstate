// TODO(v7): remove with src/legacySnapshot.ts.
import { z } from 'zod';
import {
  createActor,
  createAsyncLogic,
  createMachine,
  systemTransition
} from '../src';
import { restoreActor } from '../src/persist/index.ts';
// Written by xstate@6.0.0-beta.1 from the machines below.
import fixtures from './fixtures/beta1-snapshots.json';

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
    enq.raise({ type: 'TICK' }, { delay: 2000 });
    return {
      context: {
        spawned: enq.spawn(child, { id: 'spawned' }),
        generated: enq.spawn(child)
      }
    };
  },
  initial: 'active',
  states: {
    active: {
      invoke: { id: 'invoked', src: 'child' },
      on: {
        MORE: (_, enq) => {
          enq.raise({ type: 'TICK' }, { delay: 3000 });
        },
        PING_SPAWNED: ({ context }, enq) => {
          enq.sendTo(context.spawned, { type: 'PING' });
        }
      }
    }
  }
});

const mapSnapshot = (snapshot: any) => ({
  type: 'SNAPSHOT' as const,
  value: snapshot.value
});
const failing = createAsyncLogic({
  id: 'failing',
  timeout: 100,
  run: async () => 1
});
const system = {
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

function reservedKeys(value: unknown, path = ''): string[] {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, item]) => [
    ...(/^[$_]/.test(key) ? [`${path}.${key}`] : []),
    ...reservedKeys(item, `${path}.${key}`)
  ]);
}

function toJSON(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

it('the fixtures use the beta.1 field names', () => {
  expect(reservedKeys(fixtures.persisted)).not.toEqual([]);
  expect(reservedKeys(fixtures.system)).not.toEqual([]);
});

it('restores a persisted snapshot written by 6.0.0-beta.1', () => {
  const actor = restoreActor(parent, fixtures.persisted as any).start();
  const snapshot = actor.getSnapshot();
  expect(snapshot.context.spawned).toBe(snapshot.children.spawned);
  expect(snapshot.context.generated).toBe(snapshot.children['child:0']);

  actor.send({ type: 'PING_SPAWNED' });
  expect(snapshot.children.spawned!.getSnapshot().value).toBe('pinged');

  // The timer counter carries over, so a new delayed raise does not reuse
  // the pending timer's sequence number.
  actor.send({ type: 'MORE' });
  const persisted = toJSON(actor.getPersistedSnapshot());
  actor.stop();
  expect(persisted.timers.map((timer: any) => timer.delay).sort()).toEqual([
    2000, 3000
  ]);
  expect(new Set(persisted.timers.map((timer: any) => timer.seq)).size).toBe(2);
  expect(persisted.nextActorIds).toEqual({ child: 1 });
  expect(reservedKeys(persisted)).toEqual([]);

  const fresh = createActor(parent).start();
  expect(
    restoreActor(parent, toJSON(fresh.getPersistedSnapshot())).getSnapshot()
      .context.spawned
  ).toBeDefined();
  fresh.stop();
});

it('continues a systemTransition snapshot written by 6.0.0-beta.1', () => {
  expect(fixtures.system.actors['root/failing'].snapshot.status).toBe('error');
  const [next] = systemTransition(
    system,
    fixtures.system as any,
    'root/child',
    {
      type: 'PING'
    }
  );
  expect(next.actors['root/child'].snapshot.value).toBe('pinged');
  expect(next.actors['root/failing'].snapshot.error).toMatchObject({
    '@error': 'TimeoutError'
  });
  expect(reservedKeys(toJSON(next))).toEqual([]);
});
