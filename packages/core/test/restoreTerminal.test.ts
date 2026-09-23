import { setTimeout as sleep } from 'node:timers/promises';
import { createActor, createMachine } from '../src/index.ts';

const entry = vi.fn();
const action = vi.fn();
const machine = createMachine({
  initial: 'a',
  entry: (_, enq) => enq(entry),
  states: {
    a: {
      on: {
        NEXT: (_, enq) => {
          enq(action);
          return { target: 'b' };
        }
      }
    },
    b: {}
  }
});

function persistedWith(status: 'done' | 'error' | 'stopped') {
  const persisted = createActor(machine).start().getPersistedSnapshot();
  entry.mockClear();
  return {
    ...persisted,
    status,
    ...(status === 'error' && { error: new Error('persisted failure') })
  } as typeof persisted;
}

describe('restoring terminal snapshots', () => {
  beforeEach(() => {
    entry.mockClear();
    action.mockClear();
  });

  it.each(['done', 'error', 'stopped'] as const)(
    'keeps a restored %s snapshot terminal after start() without running transitions',
    (status) => {
      const actor = createActor(machine, { snapshot: persistedWith(status) });
      actor.subscribe({ error: () => {} });
      actor.start();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      actor.send({ type: 'NEXT' });
      warn.mockRestore();

      expect(actor.getSnapshot().status).toBe(status);
      expect(actor.getSnapshot().value).toBe('a');
      expect(entry).not.toHaveBeenCalled();
      expect(action).not.toHaveBeenCalled();
    }
  );

  it('delivers a restored error to subscribers added before and after start()', () => {
    const actor = createActor(machine, { snapshot: persistedWith('error') });
    const before = vi.fn();
    actor.subscribe({ error: before });
    actor.start();
    const after = vi.fn();
    actor.subscribe({ error: after });

    expect(before).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ message: 'persisted failure' })
    );
    expect(after).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ message: 'persisted failure' })
    );
  });

  it('surfaces a restore-time failure as an error snapshot and subscriber error', async () => {
    const persisted = createActor(machine).start().getPersistedSnapshot();
    const invalid = { ...persisted, value: 'missing' } as typeof persisted;

    let actor!: ReturnType<typeof createActor<typeof machine>>;
    expect(() => {
      actor = createActor(machine, { snapshot: invalid });
    }).not.toThrow();
    const error = vi.fn();
    actor.subscribe({ error });
    expect(() => actor.start()).not.toThrow();
    await sleep(0);

    const snapshot = actor.getSnapshot();
    expect(snapshot.status).toBe('error');
    expect(snapshot.error).toBeInstanceOf(Error);
    expect((snapshot.error as Error).message).toBe(
      "Persisted snapshot references state 'missing' which does not exist on machine '(machine)'."
    );
    expect(error).toHaveBeenCalledExactlyOnceWith(snapshot.error);
  });

  it('restore failure yields a machine snapshot with matches()', () => {
    const persisted = createActor(machine).start().getPersistedSnapshot();
    const invalid = { ...persisted, value: 'missing' } as typeof persisted;
    const actor = createActor(machine, { snapshot: invalid });
    const error = vi.fn();
    actor.subscribe({ error });
    actor.start();

    const snapshot = actor.getSnapshot();
    expect(snapshot.status).toBe('error');
    expect(typeof snapshot.matches).toBe('function');
    expect(typeof snapshot.can).toBe('function');
    expect(snapshot.children).toEqual({});
    expect(snapshot.nodes).toEqual([machine.root]);
    expect(error).toHaveBeenCalledExactlyOnceWith(snapshot.error);
  });
});
