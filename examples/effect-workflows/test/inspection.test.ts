import {
  createInspector,
  type AdoptedActor,
  type InspectedSnapshot
} from '@statelyai/sdk';
import { Effect } from 'effect';

const recorded = vi.hoisted(() => ({
  actors: [] as AdoptedActor[],
  snapshots: [] as InspectedSnapshot[],
  messages: [] as unknown[],
  destroy: vi.fn(),
  failConnection: false
}));

// Exercise the real SDK's actor discovery and serialization without a browser or relay.
vi.mock('@statelyai/sdk', async (importOriginal) => {
  const sdk = await importOriginal<typeof import('@statelyai/sdk')>();
  return {
    ...sdk,
    createInspector: vi.fn(() => {
      const inspector = sdk.createInspector({
        autoOpen: false,
        transport: {
          ready: true,
          send: (message) =>
            recorded.messages.push(JSON.parse(JSON.stringify(message))),
          onMessage: () => () => {},
          onReady: (handler) => {
            handler();
            return () => {};
          },
          destroy: () => {}
        }
      });
      inspector.on('actor', (actor) => recorded.actors.push({ ...actor }));
      inspector.on('snapshot', (snapshot) => recorded.snapshots.push(snapshot));
      const destroy = inspector.destroy.bind(inspector);
      inspector.destroy = () => {
        recorded.destroy();
        destroy();
      };
      return recorded.failConnection
        ? {
            ...inspector,
            ready: Promise.reject(new Error('Relay unavailable'))
          }
        : inspector;
    })
  };
});

beforeEach(() => {
  recorded.actors.length = 0;
  recorded.snapshots.length = 0;
  recorded.messages.length = 0;
  recorded.destroy.mockClear();
  vi.mocked(createInspector).mockClear();
  recorded.failConnection = false;
});

afterEach(() => vi.unstubAllEnvs());

it('runs offline by default', async () => {
  vi.stubEnv('INSPECT', '');
  const { result } = await import('../src/inspection.ts');
  expect(result).toBe('Release published');
  expect(createInspector).not.toHaveBeenCalled();
  expect(recorded.actors).toEqual([]);
  expect(recorded.destroy).not.toHaveBeenCalled();
});

it('inspects the workflow and invoked child, then destroys the inspector', async () => {
  vi.stubEnv('INSPECT', '1');
  const { program } = await import('../src/inspection.ts');
  expect(await Effect.runPromise(Effect.scoped(program))).toBe(
    'Release published'
  );
  const root = recorded.actors.find((actor) => actor.parentSessionId === null)!;
  expect(root.machineConfig).toMatchObject({ id: 'releaseReview' });
  expect(
    recorded.actors.some((actor) => actor.parentSessionId === root.sessionId)
  ).toBe(true);
  const snapshots = recorded.snapshots.filter(
    (snapshot) => snapshot.sessionId === root.sessionId
  );
  expect(
    snapshots.map((event) => (event.snapshot as { value: string }).value)
  ).toEqual(['publishing', 'published']);
  expect(recorded.messages).toContainEqual(
    expect.objectContaining({
      type: '@statelyai.system.actorSnapshot',
      snapshot: { value: 'published', status: 'done' }
    })
  );
  expect(recorded.destroy).toHaveBeenCalledOnce();
});

it('destroys the inspector if connection fails', async () => {
  vi.stubEnv('INSPECT', '1');
  recorded.failConnection = true;
  const { program } = await import('../src/inspection.ts');
  await expect(Effect.runPromise(Effect.scoped(program))).rejects.toThrow(
    'Relay unavailable'
  );
  expect(recorded.destroy).toHaveBeenCalledOnce();
});
