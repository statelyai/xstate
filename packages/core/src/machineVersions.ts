import type { StandardSchemaV1 } from './schema.types.ts';
import type { AnyMachineSchemas } from './types.v6.ts';
import type {
  AnyStateMachine,
  ContextFrom,
  PersistedSnapshotFor,
  Snapshot
} from './types.ts';

export type PersistedMachineIdentity<
  TMachine extends AnyStateMachine = AnyStateMachine
> = {
  id: TMachine['id'];
  version: NonNullable<TMachine['version']>;
};

type VersionedStateMachine = AnyStateMachine & {
  version: string;
  schemas?: AnyMachineSchemas;
};

export type PersistedSnapshotFrom<TMachine extends AnyStateMachine> =
  Snapshot<unknown> &
    PersistedSnapshotFor<TMachine> & {
      context: ContextFrom<TMachine>;
      machine: PersistedMachineIdentity<TMachine>;
      [key: string]: unknown;
    };

export type PersistedSnapshotDataFrom<TMachine extends AnyStateMachine> =
  Snapshot<unknown> & {
    context: ContextFrom<TMachine>;
    [key: string]: unknown;
  };

export type ParsedPersistedSnapshot<
  TMachines extends readonly AnyStateMachine[]
> = {
  [K in keyof TMachines]: TMachines[K] extends AnyStateMachine
    ? {
        machine: TMachines[K];
        snapshot: PersistedSnapshotFrom<TMachines[K]>;
      }
    : never;
}[number];

export type MachineVersionsOptions<
  TMachines extends readonly AnyStateMachine[]
> = {
  unversioned?: NonNullable<TMachines[number]['version']>;
};

type ParsedSnapshotSource = {
  machine: VersionedStateMachine;
  snapshot: Snapshot<unknown> & {
    context: unknown;
    machine: PersistedMachineIdentity;
    [key: string]: unknown;
  };
};

type SourceVersion<TSource extends ParsedSnapshotSource> =
  TSource extends unknown ? NonNullable<TSource['machine']['version']> : never;

type SourceForVersion<
  TSource extends ParsedSnapshotSource,
  TVersion extends string
> = TSource extends unknown
  ? TSource['machine']['version'] extends TVersion
    ? TSource
    : never
  : never;

export type SnapshotMigrationHandlers<
  TSource extends ParsedSnapshotSource,
  TTarget extends AnyStateMachine
> = {
  [TVersion in SourceVersion<TSource>]?: (
    snapshot: SourceForVersion<TSource, TVersion>['snapshot']
  ) => PersistedSnapshotDataFrom<TTarget>;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

async function validate(
  schema: StandardSchemaV1 | undefined,
  value: unknown,
  description: string
): Promise<unknown> {
  if (!schema) {
    return value;
  }
  const result = await schema['~standard'].validate(value);
  if (result.issues) {
    throw new Error(`Invalid ${description}: ${result.issues[0]?.message}`);
  }
  return result.value;
}

/** Creates parsers backed by retained versions of one machine. */
export function machineVersions<
  const TMachines extends readonly [
    VersionedStateMachine,
    ...VersionedStateMachine[]
  ]
>(machines: TMachines, options?: MachineVersionsOptions<TMachines>) {
  const byIdentity = new Map<string, VersionedStateMachine>();
  const machineId = machines[0].id;

  for (const machine of machines) {
    if (machine.version === undefined) {
      throw new Error(`Machine '${machine.id}' must define a version.`);
    }
    if (machine.id !== machineId) {
      throw new Error(
        `Machine '${machine.id}' does not match machine ID '${machineId}'.`
      );
    }
    const key = `${machine.id}\0${machine.version}`;
    if (byIdentity.has(key)) {
      throw new Error(
        `Duplicate machine identity '${machine.id}' version '${machine.version}'.`
      );
    }
    byIdentity.set(key, machine);
  }

  if (
    options?.unversioned !== undefined &&
    !byIdentity.has(`${machineId}\0${options.unversioned}`)
  ) {
    throw new Error(
      `Unversioned snapshot version '${options.unversioned}' is not retained for machine '${machineId}'.`
    );
  }

  return {
    async parseSnapshot(
      raw: unknown
    ): Promise<ParsedPersistedSnapshot<TMachines>> {
      if (!isObject(raw)) {
        throw new Error('Persisted snapshot is missing machine identity.');
      }

      let id: string;
      let version: string;
      if (isObject(raw.machine)) {
        ({ id, version } = raw.machine as { id: string; version: string });
        if (typeof id !== 'string' || typeof version !== 'string') {
          throw new Error(
            'Persisted snapshot has an invalid machine identity.'
          );
        }
      } else if (typeof raw.version === 'string') {
        id = machineId;
        version = raw.version;
      } else if (
        raw.version === undefined &&
        options?.unversioned !== undefined
      ) {
        id = machineId;
        version = options.unversioned;
      } else {
        throw new Error('Persisted snapshot is missing machine identity.');
      }
      if (raw.version !== undefined && typeof raw.version !== 'string') {
        throw new Error('Persisted snapshot has an invalid version.');
      }
      if (raw.version !== undefined && raw.version !== version) {
        throw new Error(
          `Persisted snapshot version '${raw.version}' conflicts with machine version '${version}'.`
        );
      }

      const machine = byIdentity.get(`${id}\0${version}`);
      if (!machine) {
        throw new Error(
          `Unknown machine identity '${id}' version '${version}'.`
        );
      }

      const context = await validate(
        machine.schemas?.context,
        raw.context,
        `context for machine '${id}' version '${version}'`
      );

      return {
        machine,
        snapshot: {
          ...raw,
          context,
          machine: { id, version }
        }
      } as ParsedPersistedSnapshot<TMachines>;
    }
  };
}

/** Migrates a parsed persisted snapshot directly to a target machine. */
export async function migrateSnapshot<
  TSource extends ParsedSnapshotSource,
  TTarget extends VersionedStateMachine
>(
  source: TSource,
  target: TTarget,
  migrations: SnapshotMigrationHandlers<TSource, TTarget>
): Promise<PersistedSnapshotFrom<TTarget>> {
  if (target.version === undefined) {
    throw new Error(`Target machine '${target.id}' must define a version.`);
  }
  if (source.machine.id !== target.id) {
    throw new Error(
      `Cannot migrate machine '${source.machine.id}' to '${target.id}'.`
    );
  }

  let snapshot: PersistedSnapshotDataFrom<TTarget>;
  if (source.machine.version === target.version) {
    snapshot = source.snapshot as PersistedSnapshotDataFrom<TTarget>;
  } else {
    const migrate = (
      migrations as Record<
        string,
        | ((
            snapshot: TSource['snapshot']
          ) => PersistedSnapshotDataFrom<TTarget>)
        | undefined
      >
    )[source.machine.version];
    if (!migrate) {
      throw new Error(
        `No snapshot migration from version '${source.machine.version}' to '${target.version}' for machine '${target.id}'.`
      );
    }
    snapshot = migrate(source.snapshot as never);
  }

  const context = await validate(
    target.schemas?.context,
    snapshot.context,
    `context for machine '${target.id}' version '${target.version}'`
  );

  return {
    ...snapshot,
    context,
    machine: { id: target.id, version: target.version },
    version: target.version
  } as unknown as PersistedSnapshotFrom<TTarget>;
}
