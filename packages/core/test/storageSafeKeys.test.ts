import {
  createActor,
  createMachine,
  describeExecutableEffect,
  initialSystemTransition,
  initialTransition,
  transition
} from '../src';

// Document stores such as Convex and MongoDB reject field names that start
// with `$`, so serialized output must avoid them.
function reservedKeys(value: unknown, path = ''): string[] {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(/^\$/.test(key) ? [`${path}.${key}`] : []),
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
  context: { spawned: undefined as any },
  initial: 'active',
  states: {
    active: {
      invoke: { id: 'invoked', src: 'child' },
      entry: (_, enq) => ({
        context: { spawned: enq.spawn(child, { id: 'spawned' }) }
      }),
      on: {
        KICK: ({ children }, enq) => {
          enq.sendTo(children.invoked!, { type: 'PING' });
        },
        STOP: ({ context }, enq) => {
          enq.stop(context.spawned);
        }
      }
    }
  }
});

it('persisted snapshots of a machine with an invoked child use storage-safe keys', () => {
  const actor = createActor(parent).start();
  const persisted = toJSON(actor.getPersistedSnapshot());
  actor.stop();
  expect(persisted.children.invoked).toBeDefined();
  expect(reservedKeys(persisted)).toEqual([]);
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
  const [snapshot] = initialSystemTransition({ root: parent });
  expect(reservedKeys(toJSON(snapshot))).toEqual([]);
});
