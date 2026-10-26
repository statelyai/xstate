import {
  createActor,
  createAsyncLogic,
  createMachine,
  InvalidSnapshotError,
  machineVersions
} from '../src/index.ts';

const work = createAsyncLogic({
  run: (): Promise<number> => new Promise(() => {})
});

function fixture() {
  const machine = createMachine({
    id: 'ord',
    version: '2',
    actors: { work },
    initial: 'loading',
    states: {
      loading: {
        invoke: { src: 'work' },
        after: { 1000: { target: 'ready' } }
      },
      ready: {}
    }
  });
  const actor = createActor(machine).start();
  const good = JSON.parse(JSON.stringify(actor.getPersistedSnapshot()));
  actor.stop();
  return { machine, good };
}

const malformed = [
  [
    'old timer record',
    () => ({ timers: { 'xstate.after.1000.ord.loading': { delay: 1000 } } })
  ],
  ['null timer', () => ({ timers: [null] })],
  [
    'invalid timer event',
    () => ({
      timers: [
        { delay: 1000, type: '@xstate.raise', event: null, target: 'self' }
      ]
    })
  ],
  [
    'invalid timer target',
    () => ({
      timers: [
        {
          delay: 1000,
          type: '@xstate.raise',
          event: { type: 'TICK' },
          target: {}
        }
      ]
    })
  ],
  ['string child', () => ({ children: { x: 'garbage' } })],
  ['null child', () => ({ children: { x: null } })],
  ['array child', () => ({ children: { x: [] } })],
  [
    'null child snapshot',
    () => ({ children: { x: { src: 'work', snapshot: null } } })
  ],
  [
    'child with unknown source',
    () => ({
      children: { x: { src: 'missing', snapshot: { status: 'active' } } }
    })
  ],
  [
    'old child key and synthetic source',
    (good: any) => ({
      children: {
        '0.ord.loading': {
          ...(Object.values(good.children)[0] as object),
          src: 'xstate.invoke.0.ord.loading'
        }
      }
    })
  ],
  ['numeric state value', () => ({ value: 5 })],
  ['invalid nested state value', () => ({ value: { loading: 5 } })]
] as const;

it.each(malformed)(
  'rejects %s before restore and during schema parsing',
  async (_, overrides) => {
    const { machine, good } = fixture();
    const snapshot = { ...good, ...overrides(good) };
    const result = await machine.snapshotSchema['~standard'].validate(snapshot);
    expect(result.issues).toBeDefined();
    await expect(
      machineVersions([machine]).parseSnapshot(snapshot)
    ).rejects.toThrow();
    const restored = createActor(machine, { snapshot });
    restored.subscribe({ error: () => {} });
    restored.start();
    expect(restored.getSnapshot()).toMatchObject({
      status: 'error',
      error: expect.any(InvalidSnapshotError)
    });
  }
);

it('accepts registered spawned children with arbitrary ids and unknown extra fields', async () => {
  const { machine, good } = fixture();
  const snapshot = {
    ...good,
    extra: true,
    children: {
      ...good.children,
      '0.ord.legacy-name': {
        ...(Object.values(good.children)[0] as object),
        src: 'work',
        extra: true
      }
    }
  };
  const parsed = await machineVersions([machine]).parseSnapshot(snapshot);
  expect(parsed.snapshot).toMatchObject({ extra: true });
  const restored = createActor(machine, { snapshot });
  restored.subscribe({ error: () => {} });
  restored.start();
  expect(restored.getSnapshot().status).toBe('active');
  restored.stop();
});

it('accepts remote children whose source is hosted on another runtime', async () => {
  const { machine, good } = fixture();
  const snapshot = {
    ...good,
    children: {
      hosted: { remote: true, address: '/host/hosted', src: 'hosted-work' }
    }
  };
  const result = await machine.snapshotSchema['~standard'].validate(snapshot);
  expect(result.issues).toBeUndefined();
  const restored = createActor(machine, { snapshot });
  restored.subscribe({ error: () => {} });
  restored.start();
  expect(restored.getSnapshot().status).toBe('active');
  restored.stop();
});

it.each([false, true])(
  'restores inline invoked logic with explicit source %s',
  async (explicitSource) => {
    const machine = createMachine({
      id: 'inline',
      version: '1',
      invoke: { id: 'work', src: work }
    });
    const actor = createActor(machine).start();
    const snapshot = actor.getPersistedSnapshot();
    actor.stop();
    const restorable = {
      ...snapshot,
      children: {
        work: {
          ...snapshot.children.work,
          ...(explicitSource ? { src: work } : {})
        }
      }
    };
    const result =
      await machine.snapshotSchema['~standard'].validate(restorable);
    expect(result.issues).toBeUndefined();
    const restored = createActor(machine, { snapshot: restorable });
    restored.subscribe({ error: () => {} });
    restored.start();
    expect(restored.getSnapshot().status).toBe('active');
    restored.stop();
  }
);

it('accepts local children with omitted persisted snapshots', async () => {
  const { machine, good: snapshot } = fixture();
  for (const id of Object.keys(snapshot.children)) {
    snapshot.children[id].src = 'work';
    delete snapshot.children[id].snapshot;
  }
  const result = await machine.snapshotSchema['~standard'].validate(snapshot);
  expect(result.issues).toBeUndefined();
  const restored = createActor(machine, { snapshot });
  restored.subscribe({ error: () => {} });
  restored.start();
  expect(restored.getSnapshot().status).toBe('active');
  restored.stop();
});
