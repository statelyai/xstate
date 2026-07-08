import { createActor, createMachine } from '../src';

describe('persisted snapshot versioning', () => {
  it('stamps the machine version on persisted snapshots', () => {
    const machine = createMachine({
      version: '1',
      initial: 'a',
      states: { a: {} }
    });

    const actor = createActor(machine).start();
    const persisted = actor.getPersistedSnapshot();

    expect((persisted as any).version).toBe('1');
    expect(JSON.parse(JSON.stringify(persisted)).version).toBe('1');
  });

  it('does not stamp a version when the machine has none', () => {
    const machine = createMachine({
      initial: 'a',
      states: { a: {} }
    });

    const actor = createActor(machine).start();
    const persisted = actor.getPersistedSnapshot();

    expect('version' in (persisted as any)).toBe(false);
  });

  it('restores a snapshot with a matching version', () => {
    const machine = createMachine({
      version: '1',
      initial: 'a',
      states: { a: { on: { NEXT: { target: 'b' } } }, b: {} }
    });

    const actor = createActor(machine).start();
    actor.send({ type: 'NEXT' });
    const persisted = actor.getPersistedSnapshot();
    actor.stop();

    const restored = createActor(machine, { snapshot: persisted }).start();
    expect(restored.getSnapshot().value).toBe('b');
  });

  it('errors when restoring a version-mismatched snapshot without a migrate function', () => {
    const machineV1 = createMachine({
      version: '1',
      initial: 'a',
      states: { a: {} }
    });
    const machineV2 = createMachine({
      version: '2',
      initial: 'a',
      states: { a: {} }
    });

    const persisted = createActor(machineV1).start().getPersistedSnapshot();

    const restored = createActor(machineV2, { snapshot: persisted });
    restored.subscribe({ error: () => {} });
    restored.start();

    const snapshot = restored.getSnapshot();
    expect(snapshot.status).toBe('error');
    expect((snapshot as any).error.message).toMatch(
      /Persisted snapshot version '1' does not match machine version '2'/
    );
  });

  it('migrates a version-mismatched snapshot with the `migrate` function', () => {
    const machineV1 = createMachine({
      version: '1',
      context: { count: 5 },
      initial: 'a',
      states: { a: {} }
    });

    const migrate = vi.fn((persisted: any, fromVersion: string | undefined) => {
      expect(fromVersion).toBe('1');
      return {
        ...persisted,
        version: '2',
        context: { total: persisted.context.count }
      };
    });

    const machineV2 = createMachine({
      version: '2',
      migrate,
      context: { total: 0 },
      initial: 'a',
      states: { a: {} }
    });

    const persisted = createActor(machineV1).start().getPersistedSnapshot();
    const restored = createActor(machineV2, { snapshot: persisted }).start();

    expect(migrate).toHaveBeenCalledTimes(1);
    expect(restored.getSnapshot().status).toBe('active');
    expect(restored.getSnapshot().context).toEqual({ total: 5 });
  });

  it('migrates an unversioned snapshot (fromVersion is undefined)', () => {
    const legacyMachine = createMachine({
      context: { count: 3 },
      initial: 'a',
      states: { a: {} }
    });

    const machineV1 = createMachine({
      version: '1',
      migrate: (persisted: any, fromVersion) => {
        expect(fromVersion).toBeUndefined();
        return persisted;
      },
      context: { count: 0 },
      initial: 'a',
      states: { a: {} }
    });

    const persisted = createActor(legacyMachine).start().getPersistedSnapshot();
    const restored = createActor(machineV1, { snapshot: persisted }).start();

    expect(restored.getSnapshot().status).toBe('active');
    expect(restored.getSnapshot().context).toEqual({ count: 3 });
  });
});
