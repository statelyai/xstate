import { z } from 'zod';
import {
  createActor,
  createMachine,
  machineVersions,
  migrateSnapshot,
  types
} from '../src';

describe('machineVersions', () => {
  it('only exposes persisted snapshot parsing', () => {
    const checkout = createMachine({
      id: 'checkout',
      version: '1',
      initial: 'active',
      states: { active: {} }
    });

    expect(machineVersions([checkout])).toEqual({
      parseSnapshot: expect.any(Function)
    });
  });

  it('rejects machines without a version', () => {
    const unversionedMachine = createMachine({
      id: 'checkout',
      initial: 'active',
      states: { active: {} }
    });

    expect(() => machineVersions([unversionedMachine] as any)).toThrow(
      "Machine 'checkout' must define a version."
    );
  });

  it('rejects machines with different IDs', () => {
    const checkout = createMachine({
      id: 'checkout',
      version: '1',
      initial: 'active',
      states: { active: {} }
    });
    const cart = createMachine({
      id: 'cart',
      version: '2',
      initial: 'active',
      states: { active: {} }
    });

    expect(() => machineVersions([checkout, cart])).toThrow(
      "Machine 'cart' does not match machine ID 'checkout'."
    );
  });

  it('rejects an unversioned policy that references an unretained version', () => {
    const checkout = createMachine({
      id: 'checkout',
      version: '1',
      initial: 'active',
      states: { active: {} }
    });

    expect(() =>
      machineVersions([checkout], { unversioned: '0' } as any)
    ).toThrow(
      "Unversioned snapshot version '0' is not retained for machine 'checkout'."
    );
  });

  it('rejects restoring a snapshot from a different machine ID', () => {
    const checkout = createMachine({
      id: 'checkout',
      version: '1',
      initial: 'active',
      states: { active: {} }
    });
    const cart = createMachine({
      id: 'cart',
      version: '1',
      initial: 'active',
      states: { active: {} }
    });
    const persisted = createActor(checkout).getPersistedSnapshot();

    const restored = createActor(cart, { snapshot: persisted });
    restored.subscribe({ error: () => {} });
    restored.start();

    expect(restored.getSnapshot()).toMatchObject({
      status: 'error',
      error: expect.objectContaining({
        message:
          "Machine ID mismatch: persisted snapshot was created by machine 'checkout', but machine 'cart' was provided."
      })
    });
  });

  it('parses a persisted snapshot with the matching machine schema', async () => {
    const checkoutV1 = createMachine({
      id: 'checkout',
      version: '1',
      schemas: {
        context: types<{ count: number }>()
      },
      context: { count: 1 },
      initial: 'active',
      states: { active: {} }
    });
    const checkoutV2 = createMachine({
      id: 'checkout',
      version: '2',
      schemas: {
        context: types<{ total: number }>()
      },
      context: { total: 1 },
      initial: 'active',
      states: { active: {} }
    });

    const persisted = JSON.parse(
      JSON.stringify(createActor(checkoutV1).getPersistedSnapshot())
    );
    const versions = machineVersions([checkoutV1, checkoutV2]);

    const parsed = await versions.parseSnapshot(persisted);

    expect(parsed.machine).toBe(checkoutV1);
    expect(parsed.snapshot.context).toEqual({ count: 1 });
  });

  it('parses legacy snapshots that only contain a top-level version', async () => {
    const checkoutV1 = createMachine({
      id: 'checkout',
      version: '1',
      schemas: {
        context: types<{ count: number }>()
      },
      context: { count: 0 },
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkoutV1]);

    const parsed = await versions.parseSnapshot({
      version: '1',
      context: { count: 2 }
    });

    expect(parsed.machine).toBe(checkoutV1);
    expect(parsed.snapshot.machine).toEqual({
      id: 'checkout',
      version: '1'
    });
  });

  it('migrates unversioned snapshots through the configured retained version', async () => {
    const legacyCheckout = createMachine({
      id: 'checkout',
      context: { count: 2 },
      initial: 'active',
      states: { active: {} }
    });
    const checkoutV0 = createMachine({
      id: 'checkout',
      version: '0',
      schemas: {
        context: z.object({ count: z.number() })
      },
      context: { count: 0 },
      initial: 'active',
      states: { active: {} }
    });
    const checkoutV1 = createMachine({
      id: 'checkout',
      version: '1',
      schemas: {
        context: z.object({ total: z.number() })
      },
      context: { total: 0 },
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkoutV0, checkoutV1], {
      unversioned: '0'
    });

    const persisted = JSON.parse(
      JSON.stringify(createActor(legacyCheckout).getPersistedSnapshot())
    );
    const parsed = await versions.parseSnapshot(persisted);

    expect(parsed.machine).toBe(checkoutV0);
    expect(parsed.snapshot).toMatchObject({
      context: { count: 2 },
      machine: { id: 'checkout', version: '0' }
    });

    const compatible = await migrateSnapshot(parsed, checkoutV1, {
      '0': (snapshot) => ({
        ...snapshot,
        context: { total: snapshot.context.count }
      })
    });
    const actor = createActor(checkoutV1, { snapshot: compatible }).start();

    expect(actor.getSnapshot().context).toEqual({ total: 2 });
  });

  it('does not use the unversioned policy for an explicit unknown version', async () => {
    const checkoutV0 = createMachine({
      id: 'checkout',
      version: '0',
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkoutV0], {
      unversioned: '0'
    });

    await expect(
      versions.parseSnapshot({ version: 'unknown' })
    ).rejects.toThrow("Unknown machine identity 'checkout' version 'unknown'.");
  });

  it('rejects contradictory snapshot version metadata', async () => {
    const checkoutV1 = createMachine({
      id: 'checkout',
      version: '1',
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkoutV1]);

    await expect(
      versions.parseSnapshot({
        machine: { id: 'checkout', version: '1' },
        version: '2'
      })
    ).rejects.toThrow(
      "Persisted snapshot version '2' conflicts with machine version '1'."
    );
  });

  it('rejects contradictory version metadata during direct restoration', () => {
    const checkout = createMachine({
      id: 'checkout',
      version: '1',
      initial: 'active',
      states: { active: {} }
    });
    const persisted = {
      ...createActor(checkout).getPersistedSnapshot(),
      machine: { id: 'checkout', version: '2' }
    };

    const restored = createActor(checkout, { snapshot: persisted });
    restored.subscribe({ error: () => {} });
    restored.start();

    expect(restored.getSnapshot()).toMatchObject({
      status: 'error',
      error: expect.objectContaining({
        message:
          "Persisted snapshot version '1' conflicts with machine version '2'."
      })
    });
  });

  it('validates persisted snapshots with the retained machine schema', async () => {
    const checkoutV1 = createMachine({
      id: 'checkout',
      version: '1',
      schemas: {
        context: z.object({ count: z.number() })
      },
      context: { count: 0 },
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkoutV1]);

    await expect(
      versions.parseSnapshot({
        machine: { id: 'checkout', version: '1' },
        version: '1',
        context: { count: '1' }
      })
    ).rejects.toThrow("Invalid context for machine 'checkout' version '1'");
  });

  it('migrates a parsed snapshot to a target machine', async () => {
    const checkoutV1 = createMachine({
      id: 'checkout',
      version: '1',
      schemas: {
        context: types<{ count: number }>()
      },
      context: { count: 1 },
      initial: 'active',
      states: { active: {} }
    });
    const checkoutV2 = createMachine({
      id: 'checkout',
      version: '2',
      schemas: {
        context: types<{ total: number }>()
      },
      context: { total: 0 },
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkoutV1, checkoutV2]);
    const source = await versions.parseSnapshot(
      JSON.parse(JSON.stringify(createActor(checkoutV1).getPersistedSnapshot()))
    );

    const compatible = await migrateSnapshot(source, checkoutV2, {
      '1': (snapshot) => ({
        ...snapshot,
        context: { total: snapshot.context.count }
      })
    });
    const actor = createActor(checkoutV2, { snapshot: compatible }).start();

    expect(actor.getSnapshot().context).toEqual({ total: 1 });
    expect((compatible as any).machine).toEqual({
      id: 'checkout',
      version: '2'
    });
  });
});
