import { z } from 'zod';
import { createActor, createMachine, machineVersions, types } from '../src';

describe('machineVersions', () => {
  it('adapts a whole event history through an async exact-version adapter', async () => {
    const checkoutV1 = createMachine({
      id: 'checkout',
      version: '1',
      schemas: {
        events: {
          ADD: z.object({ value: z.number() }),
          REMOVE: z.object({ value: z.number() })
        }
      },
      initial: 'active',
      states: { active: {} }
    });
    const checkoutV2 = createMachine({
      id: 'checkout',
      version: '2',
      schemas: {
        events: {
          CHANGE: z.object({ delta: z.number() })
        }
      },
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkoutV1, checkoutV2]);
    const wildcard = vi.fn();

    const events = await versions.adaptEvents(
      [
        { type: 'ADD', value: 5 },
        { type: 'REMOVE', value: 2 }
      ],
      {
        from: { id: 'checkout', version: '1' },
        to: '2',
        adapters: {
          '1': async (sourceEvents) => [
            {
              type: 'CHANGE',
              delta: sourceEvents.reduce(
                (total, event) =>
                  total + (event.type === 'ADD' ? event.value : -event.value),
                0
              )
            }
          ],
          '*': wildcard
        }
      }
    );

    expect(events).toEqual([{ type: 'CHANGE', delta: 3 }]);
    expect(wildcard).not.toHaveBeenCalled();
  });

  it('defaults an omitted source ID to the retained machine ID', async () => {
    const checkoutV1 = createMachine({
      id: 'checkout',
      version: '1',
      initial: 'active',
      states: { active: {} }
    });
    const checkoutV2 = createMachine({
      id: 'checkout',
      version: '2',
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkoutV1, checkoutV2]);

    const events = await versions.adaptEvents([{ type: 'ADD' }], {
      from: { version: '1' },
      to: '2',
      adapters: {
        '1': () => [{ type: 'CHANGE' }]
      }
    });

    expect(events).toEqual([{ type: 'CHANGE' }]);
  });

  it('adapts an unknown history through an async wildcard adapter', async () => {
    const checkoutV2 = createMachine({
      id: 'checkout',
      version: '2',
      schemas: {
        events: {
          CHANGE: z.object({ delta: z.number() })
        }
      },
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkoutV2]);
    const history = [{ kind: 'added', amount: 3 }];
    const source = { id: 'legacy-checkout', version: 'draft' };

    const events = await versions.adaptEvents(history, {
      from: source,
      to: '2',
      adapters: {
        '*': async (unknownEvents, actualSource) => {
          expect(unknownEvents).toBe(history);
          expect(actualSource).toBe(source);
          await Promise.resolve();
          return [
            {
              type: 'CHANGE',
              delta: (unknownEvents[0] as { amount: number }).amount
            }
          ];
        }
      }
    });

    expect(events).toEqual([{ type: 'CHANGE', delta: 3 }]);
  });

  it('validates and returns same-version histories without calling adapters', async () => {
    const checkout = createMachine({
      id: 'checkout',
      version: '2',
      schemas: {
        events: {
          CHANGE: z.object({ delta: z.number() })
        }
      },
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkout]);
    const wildcard = vi.fn();

    const events = await versions.adaptEvents([{ type: 'CHANGE', delta: 3 }], {
      from: { id: 'checkout', version: '2' },
      to: '2',
      adapters: { '*': wildcard }
    });

    expect(events).toEqual([{ type: 'CHANGE', delta: 3 }]);
    expect(wildcard).not.toHaveBeenCalled();
  });

  it('routes invalid retained-source histories to the wildcard adapter', async () => {
    const checkoutV1 = createMachine({
      id: 'checkout',
      version: '1',
      schemas: {
        events: { ADD: z.object({ value: z.number() }) }
      },
      initial: 'active',
      states: { active: {} }
    });
    const checkoutV2 = createMachine({
      id: 'checkout',
      version: '2',
      schemas: {
        events: { CHANGE: z.object({ delta: z.number() }) }
      },
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkoutV1, checkoutV2]);
    const history = [{ type: 'legacy-add', amount: 4 }];
    const exact = vi.fn();

    const events = await versions.adaptEvents(history, {
      from: { id: 'checkout', version: '1' },
      to: '2',
      adapters: {
        '1': exact,
        '*': (unknownEvents) => [
          {
            type: 'CHANGE',
            delta: (unknownEvents[0] as { amount: number }).amount
          }
        ]
      }
    });

    expect(events).toEqual([{ type: 'CHANGE', delta: 4 }]);
    expect(exact).not.toHaveBeenCalled();
  });

  it('rejects a retained source without an exact or wildcard adapter', async () => {
    const checkoutV1 = createMachine({
      id: 'checkout',
      version: '1',
      initial: 'active',
      states: { active: {} }
    });
    const checkoutV2 = createMachine({
      id: 'checkout',
      version: '2',
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkoutV1, checkoutV2]);

    await expect(
      versions.adaptEvents([{ type: 'ADD' }], {
        from: { id: 'checkout', version: '1' },
        to: '2',
        adapters: {}
      })
    ).rejects.toThrow(
      "No event adapter from version '1' to '2' for machine 'checkout'."
    );
  });

  it('propagates exact adapter errors without falling back to wildcard', async () => {
    const checkoutV1 = createMachine({
      id: 'checkout',
      version: '1',
      initial: 'active',
      states: { active: {} }
    });
    const checkoutV2 = createMachine({
      id: 'checkout',
      version: '2',
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkoutV1, checkoutV2]);
    const wildcard = vi.fn();

    await expect(
      versions.adaptEvents([], {
        from: { id: 'checkout', version: '1' },
        to: '2',
        adapters: {
          '1': async () => {
            throw new Error('adapter failed');
          },
          '*': wildcard
        }
      })
    ).rejects.toThrow('adapter failed');
    expect(wildcard).not.toHaveBeenCalled();
  });

  it('rejects an unknown source without a wildcard adapter', async () => {
    const checkout = createMachine({
      id: 'checkout',
      version: '2',
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkout]);

    await expect(
      versions.adaptEvents([], {
        from: { id: 'checkout', version: 'unknown' },
        to: '2',
        adapters: {}
      })
    ).rejects.toThrow(
      "Unknown event history source 'checkout' version 'unknown'."
    );
  });

  it('validates adapted output against target event schemas', async () => {
    const checkout = createMachine({
      id: 'checkout',
      version: '2',
      schemas: {
        events: { CHANGE: z.object({ delta: z.number() }) }
      },
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkout]);

    await expect(
      versions.adaptEvents([], {
        from: { version: 'legacy' },
        to: '2',
        adapters: {
          '*': () => [{ type: 'CHANGE', delta: 'invalid' }] as any
        }
      })
    ).rejects.toThrow("Invalid event 'CHANGE' at index 0");
  });

  it('rejects inherited event schema keys as unknown events', async () => {
    const checkout = createMachine({
      id: 'checkout',
      version: '2',
      schemas: {
        events: { CHANGE: z.object({ delta: z.number() }) }
      },
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkout]);

    await expect(
      versions.adaptEvents([{ type: 'constructor' }], {
        from: { id: 'checkout', version: '2' },
        to: '2',
        adapters: {}
      })
    ).rejects.toThrow(
      "Unknown event 'constructor' for machine 'checkout' version '2'."
    );
  });

  it('migrates an unknown snapshot through an async wildcard handler', async () => {
    const legacyCheckout = createMachine({
      id: 'checkout',
      context: { count: 2 },
      initial: 'active',
      states: { active: {} }
    });
    const checkoutV2 = createMachine({
      id: 'checkout',
      version: '2',
      schemas: {
        context: z.object({ total: z.number() })
      },
      context: { total: 0 },
      initial: 'active',
      states: { active: {} }
    });
    const persisted = JSON.parse(
      JSON.stringify(createActor(legacyCheckout).getPersistedSnapshot())
    );
    const versions = machineVersions([checkoutV2]);

    const compatible = await versions.migrateSnapshot(persisted, {
      to: '2',
      migrations: {
        '*': async (snapshot, source) => {
          expect(snapshot).toEqual(persisted);
          expect(source).toEqual({ id: undefined, version: undefined });
          await Promise.resolve();
          return {
            ...(snapshot as Record<string, unknown>),
            context: {
              total: (snapshot as { context: { count: number } }).context.count
            }
          } as any;
        }
      }
    });
    const actor = createActor(checkoutV2, { snapshot: compatible }).start();

    expect(actor.getSnapshot().context).toEqual({ total: 2 });
  });

  it('validates wildcard migration output against the target machine', async () => {
    const checkout = createMachine({
      id: 'checkout',
      version: '2',
      schemas: {
        context: z.object({ total: z.number() })
      },
      context: { total: 0 },
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkout]);

    await expect(
      versions.migrateSnapshot(
        {},
        {
          to: '2',
          migrations: {
            '*': () =>
              ({
                ...createActor(checkout).getPersistedSnapshot(),
                context: { total: 'invalid' }
              }) as any
          }
        }
      )
    ).rejects.toThrow("Invalid context for machine 'checkout' version '2'");
  });

  it('routes an unretained source version to the wildcard', async () => {
    const checkout = createMachine({
      id: 'checkout',
      version: '2',
      context: { total: 0 },
      initial: 'active',
      states: { active: {} }
    });
    const versions = machineVersions([checkout]);
    const persisted = {
      ...createActor(checkout).getPersistedSnapshot(),
      machine: { id: 'checkout', version: '1' },
      version: '1',
      context: { count: 3 }
    };

    const compatible = await versions.migrateSnapshot(persisted, {
      to: '2',
      migrations: {
        '*': (snapshot, source) => {
          expect(snapshot).toBe(persisted);
          expect(source).toEqual({ id: 'checkout', version: '1' });
          return {
            ...(snapshot as typeof persisted),
            context: { total: 3 }
          } as any;
        }
      }
    });

    expect(compatible.context).toEqual({ total: 3 });
  });

  it('exposes snapshot migration and event adaptation separately', () => {
    const checkout = createMachine({
      id: 'checkout',
      version: '1',
      initial: 'active',
      states: { active: {} }
    });

    expect(machineVersions([checkout])).toEqual({
      parseSnapshot: expect.any(Function),
      adaptEvents: expect.any(Function),
      migrateSnapshot: expect.any(Function)
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

  it("reserves '*' for wildcard migrations", () => {
    const checkout = createMachine({
      id: 'checkout',
      version: '*',
      initial: 'active',
      states: { active: {} }
    });

    expect(() => machineVersions([checkout])).toThrow(
      "Machine version '*' is reserved for wildcard migrations."
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

    const compatible = await versions.migrateSnapshot(persisted, {
      to: '1',
      migrations: {
        '0': (snapshot) => ({
          ...snapshot,
          context: { total: snapshot.context.count }
        })
      }
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

  it('prefers an async exact-version migration over the wildcard', async () => {
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
    const persisted = JSON.parse(
      JSON.stringify(createActor(checkoutV1).getPersistedSnapshot())
    );
    const wildcard = vi.fn();

    const compatible = await versions.migrateSnapshot(persisted, {
      to: '2',
      migrations: {
        '1': async (snapshot) => ({
          ...snapshot,
          context: { total: snapshot.context.count }
        }),
        '*': wildcard
      }
    });
    const actor = createActor(checkoutV2, { snapshot: compatible }).start();

    expect(actor.getSnapshot().context).toEqual({ total: 1 });
    expect((compatible as any).machine).toEqual({
      id: 'checkout',
      version: '2'
    });
    expect(wildcard).not.toHaveBeenCalled();
  });
});
