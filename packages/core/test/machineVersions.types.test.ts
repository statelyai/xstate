import {
  createActor,
  createMachine,
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

const version: '1' = checkoutV1.version;
const setupVersion: '1' = setup({}).createMachine({
  id: 'checkout',
  version: '1',
  initial: 'active',
  states: { active: {} }
}).version;
const versions = machineVersions([checkoutV1, checkoutV2]);
const versionsWithUnversioned = machineVersions([checkoutV1, checkoutV2], {
  unversioned: '1'
});
const unversioned = createMachine({
  id: 'checkout',
  initial: 'active',
  states: { active: {} }
});

if (false) {
  // @ts-expect-error version parsers require versioned machines
  machineVersions([unversioned]);
  // @ts-expect-error unversioned must reference a retained version
  machineVersions([checkoutV1, checkoutV2], { unversioned: '3' });
}

async function checkSnapshotMigrationTypes() {
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
  // @ts-expect-error a v2 snapshot is not compatible with the v1 machine
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

void version;
void setupVersion;
void versionsWithUnversioned;
void checkSnapshotMigrationTypes;

describe('machine version types', () => {
  it('checks machine and migration versions at compile time', () => {
    expect(true).toBe(true);
  });
});
