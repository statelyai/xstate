import {
  createActor,
  createMachine,
  type MachineVersionDescriptor,
  machineVersions,
  setup,
  types
} from '../src';

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
const checkoutV0 = {
  id: 'checkout',
  version: '0',
  snapshotSchema: types<{
    status: 'active';
    output?: undefined;
    error?: undefined;
    value: 'legacy';
    context: { quantity: number };
    children: Record<string, unknown>;
    historyValue: Record<string, unknown>;
    timers: Record<string, unknown>;
    _nextActorId: number;
    _nextTimerId: number;
    machine: { id: 'checkout'; version: '0' };
    version: '0';
  }>()
} as const;

const version: '1' = checkoutV1.version;
const setupVersion: '1' = setup({}).createMachine({
  id: 'checkout',
  version: '1',
  initial: 'active',
  states: { active: {} }
}).version;
const versions = machineVersions([checkoutV1, checkoutV2]);
const schemaVersions = machineVersions([checkoutV0, checkoutV2]);
const versionsWithUnversioned = machineVersions([checkoutV1, checkoutV2], {
  unversioned: '1'
});
const unversioned = createMachine({
  id: 'checkout',
  initial: 'active',
  states: { active: {} }
});
const eventMachineV1 = createMachine({
  id: 'events',
  version: '1',
  schemas: {
    events: {
      ADD: types<{ value: number }>(),
      REMOVE: types<{ value: number }>()
    }
  },
  initial: 'active',
  states: { active: {} }
});
const eventMachineV2 = createMachine({
  id: 'events',
  version: '2',
  schemas: {
    events: {
      CHANGE: types<{ delta: number }>()
    }
  },
  initial: 'active',
  states: { active: {} }
});
const eventVersionV0 = {
  id: 'events',
  version: '0',
  eventSchema: types<
    | { type: 'INCREMENT'; amount: number }
    | { type: 'DECREMENT'; amount: number }
  >()
} as const;
const eventVersions = machineVersions([eventMachineV1, eventMachineV2]);
const eventDescriptorVersions = machineVersions([
  eventVersionV0,
  eventMachineV2
]);
const machineVersionDescriptor: MachineVersionDescriptor = eventMachineV1;
void machineVersionDescriptor;

if (false) {
  // @ts-expect-error version parsers require versioned machines
  machineVersions([unversioned]);
  // @ts-expect-error unversioned must reference a retained version
  machineVersions([checkoutV1, checkoutV2], { unversioned: '3' });
  // @ts-expect-error event-only descriptors cannot parse unversioned snapshots
  machineVersions([eventVersionV0, eventMachineV2], { unversioned: '0' });
}

async function checkSnapshotMigrationTypes() {
  await schemaVersions.migrateSnapshot({} as unknown, {
    to: '2',
    migrations: {
      '0': (snapshot) => {
        const quantity: number = snapshot.context.quantity;
        const value: 'legacy' = snapshot.value;
        // @ts-expect-error descriptor schema output has no v2 context field
        snapshot.context.total;
        void value;
        return {
          ...snapshot,
          context: { total: quantity }
        };
      }
    }
  });

  await schemaVersions.migrateSnapshot(
    {},
    {
      // @ts-expect-error snapshot-only versions cannot be migration targets
      to: '0',
      migrations: {}
    }
  );

  const compatible = await versions.migrateSnapshot({} as unknown, {
    to: '2',
    migrations: {
      '1': async (snapshot) => {
        const count: number = snapshot.context.count;
        // @ts-expect-error v1 context does not contain the v2 field
        snapshot.context.total;
        return {
          ...snapshot,
          context: { total: count }
        };
      },
      '*': async (snapshot, source) => {
        // @ts-expect-error wildcard snapshots are unknown
        snapshot.context;
        const id: string | undefined = source.id;
        const version: string | undefined = source.version;
        void id;
        void version;
        return {
          ...createActor(checkoutV2).getPersistedSnapshot(),
          context: { total: 0 }
        };
      }
    }
  });

  createActor(checkoutV2, { snapshot: compatible });
  // a snapshot from another version of the same machine is accepted (migration path)
  createActor(checkoutV1, { snapshot: compatible });

  await versions.migrateSnapshot(
    {},
    {
      // @ts-expect-error target version must be retained
      to: '3',
      migrations: {}
    }
  );

  await versions.migrateSnapshot(
    {},
    {
      to: '2',
      migrations: {
        // @ts-expect-error the target version is validated without migration
        '2': (snapshot) => snapshot
      }
    }
  );
}

async function checkEventAdaptationTypes() {
  await eventDescriptorVersions.adaptEvents([], {
    from: { id: 'events', version: '0' },
    to: '2',
    adapters: {
      '0': (events) => {
        const event = events[0];
        if (event?.type === 'INCREMENT') {
          const amount: number = event.amount;
          // @ts-expect-error historical event schema has no delta
          event.delta;
          void amount;
        }
        return [{ type: 'CHANGE', delta: events.length }];
      }
    }
  });

  await eventDescriptorVersions.adaptEvents([], {
    from: { id: 'events', version: '2' },
    // @ts-expect-error schema-only versions cannot be event targets
    to: '0',
    adapters: {}
  });

  await machineVersions([checkoutV0, eventMachineV2]).adaptEvents([], {
    from: { id: 'checkout', version: '0' },
    to: '2',
    adapters: {
      // @ts-expect-error snapshot-only versions do not provide event typing
      '0': () => [{ type: 'CHANGE', delta: 0 }]
    }
  });

  const adapted = await eventVersions.adaptEvents([], {
    from: { id: 'events', version: '1' },
    to: '2',
    adapters: {
      '1': async (events) => {
        const event = events[0];
        if (event?.type === 'ADD') {
          const value: number = event.value;
          // @ts-expect-error v1 ADD events do not contain the v2 field
          event.delta;
          void value;
        }
        return [{ type: 'CHANGE', delta: events.length }];
      },
      '*': async (events, source) => {
        // @ts-expect-error wildcard event values are unknown
        events[0].type;
        const id: string | undefined = source.id;
        const version: string | undefined = source.version;
        void id;
        void version;
        return [{ type: 'CHANGE', delta: 0 }];
      }
    }
  });
  const targetEvents: Array<{ type: 'CHANGE'; delta: number }> = adapted;
  void targetEvents;

  await eventVersions.adaptEvents([], {
    from: { id: 'events', version: '1' },
    to: '2',
    adapters: {
      // @ts-expect-error the target version is validated without adaptation
      '2': (events) => events
    }
  });

  await eventVersions.adaptEvents([], {
    from: { id: 'events', version: '1' },
    to: '2',
    adapters: {
      // @ts-expect-error adapters must return target-version events
      '1': () => [{ type: 'ADD', value: 1 }]
    }
  });
}

void version;
void setupVersion;
void versionsWithUnversioned;
void checkSnapshotMigrationTypes;
void checkEventAdaptationTypes;

describe('machine version types', () => {
  it('checks machine and migration versions at compile time', () => {
    expect(true).toBe(true);
  });
});
