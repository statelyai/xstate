import {
  createActor,
  createMachine,
  machineVersions,
  migrateSnapshot,
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
  const source = await versions.parseSnapshot({} as unknown);

  const compatible = await migrateSnapshot(source, checkoutV2, {
    '1': (snapshot) => {
      const count: number = snapshot.context.count;
      // @ts-expect-error v1 context does not contain the v2 field
      snapshot.context.total;
      return {
        ...snapshot,
        context: { total: count }
      };
    }
  });

  createActor(checkoutV2, { snapshot: compatible });
  // @ts-expect-error a v2 snapshot is not compatible with the v1 machine
  createActor(checkoutV1, { snapshot: compatible });
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
