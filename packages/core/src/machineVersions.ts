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

type MaybePromise<T> = T | PromiseLike<T>;

type MachineVersion<TMachines extends readonly VersionedStateMachine[]> =
  TMachines[number]['version'];

type MachineForVersion<
  TMachines extends readonly VersionedStateMachine[],
  TVersion extends string
> = {
  [K in keyof TMachines]: TMachines[K] extends VersionedStateMachine
    ? TMachines[K]['version'] extends TVersion
      ? TMachines[K]
      : never
    : never;
}[number];

export type PersistedSnapshotSource = {
  id?: string;
  version?: string;
};

export type SnapshotMigrationHandlers<
  TMachines extends readonly VersionedStateMachine[],
  TTarget extends VersionedStateMachine
> = {
  [TVersion in Exclude<MachineVersion<TMachines>, TTarget['version']>]?: (
    snapshot: PersistedSnapshotFrom<MachineForVersion<TMachines, TVersion>>
  ) => MaybePromise<PersistedSnapshotDataFrom<TTarget>>;
} & {
  '*'?: (
    snapshot: unknown,
    source: PersistedSnapshotSource
  ) => MaybePromise<PersistedSnapshotDataFrom<TTarget>>;
};

export type MigrateSnapshotOptions<
  TMachines extends readonly VersionedStateMachine[],
  TTargetVersion extends MachineVersion<TMachines>
> = {
  to: TTargetVersion;
  migrations: SnapshotMigrationHandlers<
    TMachines,
    MachineForVersion<TMachines, TTargetVersion>
  >;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function getSnapshotSource(
  raw: unknown,
  defaultId: string
): PersistedSnapshotSource {
  if (!isObject(raw)) {
    return {};
  }
  if (isObject(raw.machine)) {
    return {
      id: typeof raw.machine.id === 'string' ? raw.machine.id : undefined,
      version:
        typeof raw.machine.version === 'string'
          ? raw.machine.version
          : undefined
    };
  }
  return {
    id: typeof raw.version === 'string' ? defaultId : undefined,
    version: typeof raw.version === 'string' ? raw.version : undefined
  };
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

async function finalizeSnapshot<TTarget extends VersionedStateMachine>(
  snapshot: PersistedSnapshotDataFrom<TTarget>,
  target: TTarget
): Promise<PersistedSnapshotFrom<TTarget>> {
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
    if (machine.version === '*') {
      throw new Error(
        "Machine version '*' is reserved for wildcard migrations."
      );
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

  const parseSnapshot = async (
    raw: unknown
  ): Promise<ParsedPersistedSnapshot<TMachines>> => {
    if (!isObject(raw)) {
      throw new Error('Persisted snapshot is missing machine identity.');
    }

    let id: string;
    let version: string;
    if (isObject(raw.machine)) {
      ({ id, version } = raw.machine as { id: string; version: string });
      if (typeof id !== 'string' || typeof version !== 'string') {
        throw new Error('Persisted snapshot has an invalid machine identity.');
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
      throw new Error(`Unknown machine identity '${id}' version '${version}'.`);
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
  };

  return {
    parseSnapshot,
    async migrateSnapshot<TTargetVersion extends MachineVersion<TMachines>>(
      raw: unknown,
      migrationOptions: MigrateSnapshotOptions<TMachines, TTargetVersion>
    ): Promise<
      PersistedSnapshotFrom<MachineForVersion<TMachines, TTargetVersion>>
    > {
      type TargetMachine = MachineForVersion<TMachines, TTargetVersion>;
      const target = byIdentity.get(`${machineId}\0${migrationOptions.to}`) as
        | TargetMachine
        | undefined;
      if (!target) {
        throw new Error(
          `Target version '${migrationOptions.to}' is not retained for machine '${machineId}'.`
        );
      }

      let source: ParsedPersistedSnapshot<TMachines> | undefined;
      let parseError: unknown;
      try {
        source = await parseSnapshot(raw);
      } catch (error) {
        parseError = error;
      }

      if (source) {
        if (source.machine.version === target.version) {
          return finalizeSnapshot(
            source.snapshot as PersistedSnapshotDataFrom<TargetMachine>,
            target
          );
        }
        const exactMigration = (
          migrationOptions.migrations as unknown as Record<
            string,
            | ((
                snapshot: unknown
              ) => MaybePromise<PersistedSnapshotDataFrom<TargetMachine>>)
            | undefined
          >
        )[source.machine.version];
        if (exactMigration) {
          return finalizeSnapshot(
            await exactMigration(source.snapshot),
            target
          );
        }
      }

      const wildcardMigration = migrationOptions.migrations['*'];
      if (!wildcardMigration) {
        if (source) {
          throw new Error(
            `No snapshot migration from version '${source.machine.version}' to '${target.version}' for machine '${target.id}'.`
          );
        }
        throw parseError;
      }

      const snapshot = await wildcardMigration(
        raw,
        getSnapshotSource(raw, machineId)
      );
      return finalizeSnapshot(snapshot, target);
    }
  };
}
