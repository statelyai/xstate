import type { StandardSchemaV1 } from './schema.types.ts';
import type {
  MachineEventSchema,
  MachineSnapshotSchema,
  MachineVersionDescriptor
} from './machineVersion.types.ts';
export type {
  MachineEventSchema,
  MachineSnapshotSchema,
  MachineVersionDescriptor,
  PersistedMachineSnapshot
} from './machineVersion.types.ts';
import type {
  AnyStateMachine,
  ContextFrom,
  EventFrom,
  EventObject,
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
  snapshotSchema: MachineSnapshotSchema;
  eventSchema: MachineEventSchema;
};

type VersionEntry = MachineVersionDescriptor;

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

export type ParsedPersistedSnapshot<TEntries extends readonly VersionEntry[]> =
  {
    [K in keyof TEntries]: TEntries[K] extends VersionEntry
      ? TEntries[K] extends VersionedStateMachine
        ? {
            source: TEntries[K];
            machine: TEntries[K];
            snapshot: PersistedSnapshotFromEntry<TEntries[K]>;
          }
        : {
            source: TEntries[K];
            snapshot: PersistedSnapshotFromEntry<TEntries[K]>;
          }
      : never;
  }[number];

export type MachineVersionsOptions<TEntries extends readonly VersionEntry[]> = {
  unversioned?: SnapshotSourceVersion<TEntries>;
};

type MaybePromise<T> = T | PromiseLike<T>;

type MachineVersion<TEntries extends readonly VersionEntry[]> = Extract<
  TEntries[number],
  VersionedStateMachine
>['version'];

type SnapshotSourceVersion<TEntries extends readonly VersionEntry[]> = {
  [K in keyof TEntries]: TEntries[K] extends
    | VersionedStateMachine
    | { snapshotSchema: MachineSnapshotSchema }
    ? TEntries[K]['version']
    : never;
}[number];

type EventSourceVersion<TEntries extends readonly VersionEntry[]> = {
  [K in keyof TEntries]: TEntries[K] extends
    | VersionedStateMachine
    | { eventSchema: MachineEventSchema }
    ? TEntries[K]['version']
    : never;
}[number];

type MachineForVersion<
  TEntries extends readonly VersionEntry[],
  TVersion extends string
> = {
  [K in keyof TEntries]: TEntries[K] extends VersionedStateMachine
    ? TEntries[K]['version'] extends TVersion
      ? TEntries[K]
      : never
    : never;
}[number];

type SnapshotEntryForVersion<
  TEntries extends readonly VersionEntry[],
  TVersion extends string
> = {
  [K in keyof TEntries]: TEntries[K] extends
    | VersionedStateMachine
    | { snapshotSchema: MachineSnapshotSchema }
    ? TEntries[K]['version'] extends TVersion
      ? TEntries[K]
      : never
    : never;
}[number];

type EventEntryForVersion<
  TEntries extends readonly VersionEntry[],
  TVersion extends string
> = {
  [K in keyof TEntries]: TEntries[K] extends
    | VersionedStateMachine
    | { eventSchema: MachineEventSchema }
    ? TEntries[K]['version'] extends TVersion
      ? TEntries[K]
      : never
    : never;
}[number];

type PersistedSnapshotFromEntry<TEntry extends VersionEntry> = TEntry extends {
  snapshotSchema: infer TSchema extends MachineSnapshotSchema;
}
  ? StandardSchemaV1.InferOutput<TSchema>
  : TEntry extends VersionedStateMachine
    ? PersistedSnapshotFrom<TEntry>
    : never;

type EventFromEntry<TEntry extends VersionEntry> = TEntry extends {
  eventSchema: infer TSchema extends MachineEventSchema;
}
  ? StandardSchemaV1.InferOutput<TSchema>
  : TEntry extends VersionedStateMachine
    ? EventFrom<TEntry>
    : never;

export type PersistedSnapshotSource = {
  id?: string;
  version?: string;
};

export type SnapshotMigrationHandlers<
  TEntries extends readonly VersionEntry[],
  TTarget extends VersionedStateMachine
> = {
  [TVersion in Exclude<SnapshotSourceVersion<TEntries>, TTarget['version']>]?: (
    snapshot: PersistedSnapshotFromEntry<
      SnapshotEntryForVersion<TEntries, TVersion>
    >
  ) => MaybePromise<PersistedSnapshotDataFrom<TTarget>>;
} & {
  '*'?: (
    snapshot: unknown,
    source: PersistedSnapshotSource
  ) => MaybePromise<PersistedSnapshotDataFrom<TTarget>>;
};

export type MigrateSnapshotOptions<
  TEntries extends readonly VersionEntry[],
  TTargetVersion extends MachineVersion<TEntries>
> = {
  to: TTargetVersion;
  migrations: SnapshotMigrationHandlers<
    TEntries,
    MachineForVersion<TEntries, TTargetVersion>
  >;
};

export type EventHistorySource = {
  id?: string;
  version?: string;
};

export type EventAdapterHandlers<
  TEntries extends readonly VersionEntry[],
  TTarget extends VersionedStateMachine
> = {
  [TVersion in Exclude<EventSourceVersion<TEntries>, TTarget['version']>]?: (
    events: readonly EventFromEntry<EventEntryForVersion<TEntries, TVersion>>[]
  ) => MaybePromise<readonly EventFrom<TTarget>[]>;
} & {
  '*'?: (
    events: readonly unknown[],
    source: EventHistorySource
  ) => MaybePromise<readonly EventFrom<TTarget>[]>;
};

export type AdaptEventsOptions<
  TEntries extends readonly VersionEntry[],
  TTargetVersion extends MachineVersion<TEntries>
> = {
  from: EventHistorySource;
  to: TTargetVersion;
  adapters: EventAdapterHandlers<
    TEntries,
    MachineForVersion<TEntries, TTargetVersion>
  >;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function isVersionedStateMachine(
  entry: VersionEntry
): entry is VersionedStateMachine {
  return (
    'transition' in entry &&
    typeof (entry as VersionedStateMachine).transition === 'function'
  );
}

function hasSnapshotSchema(
  entry: VersionEntry
): entry is MachineVersionDescriptor & {
  snapshotSchema: MachineSnapshotSchema;
} {
  return 'snapshotSchema' in entry && entry.snapshotSchema !== undefined;
}

function hasEventSchema(
  entry: VersionEntry
): entry is MachineVersionDescriptor & { eventSchema: MachineEventSchema } {
  return 'eventSchema' in entry && entry.eventSchema !== undefined;
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
  return (await validate(
    target.snapshotSchema,
    {
      ...snapshot,
      machine: { id: target.id, version: target.version },
      version: target.version
    },
    `snapshot for machine '${target.id}' version '${target.version}'`
  )) as PersistedSnapshotFrom<TTarget>;
}

async function validateEvents<
  TSource extends MachineVersionDescriptor & {
    eventSchema: MachineEventSchema;
  }
>(
  events: readonly unknown[],
  source: TSource
): Promise<EventFromEntry<TSource>[]> {
  return Promise.all(
    events.map(async (event, index) => {
      const result = await source.eventSchema['~standard'].validate(event);
      if (result.issues) {
        const message = result.issues[0]?.message;
        if (message?.startsWith('Unknown event ')) {
          throw new Error(message);
        }
        const type = isObject(event) ? event.type : undefined;
        throw new Error(
          typeof type === 'string'
            ? `Invalid event '${type}' at index ${index}${message ? `: ${message}` : '.'}`
            : `Invalid event at index ${index}${message ? `: ${message}` : '.'}`
        );
      }
      const validated = result.value;
      if (!isObject(validated) || typeof validated.type !== 'string') {
        throw new Error(`Invalid event at index ${index}.`);
      }
      return validated as EventFromEntry<TSource>;
    })
  );
}

/** Creates migration and adaptation utilities for versions of one machine. */
export function machineVersions<
  const TEntries extends readonly [VersionEntry, ...VersionEntry[]]
>(entries: TEntries, options?: MachineVersionsOptions<TEntries>) {
  const byIdentity = new Map<string, VersionEntry>();
  const machinesByIdentity = new Map<string, VersionedStateMachine>();
  const machineId = entries[0].id;

  for (const entry of entries) {
    if (entry.version === undefined) {
      throw new Error(`Machine '${entry.id}' must define a version.`);
    }
    if (entry.version === '*') {
      throw new Error(
        "Machine version '*' is reserved for wildcard migrations."
      );
    }
    if (entry.id !== machineId) {
      throw new Error(
        `Machine '${entry.id}' does not match machine ID '${machineId}'.`
      );
    }
    const key = `${entry.id}\0${entry.version}`;
    if (byIdentity.has(key)) {
      throw new Error(
        `Duplicate machine identity '${entry.id}' version '${entry.version}'.`
      );
    }
    byIdentity.set(key, entry);
    if (isVersionedStateMachine(entry)) {
      machinesByIdentity.set(key, entry);
    }
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
  ): Promise<ParsedPersistedSnapshot<TEntries>> => {
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

    const source = byIdentity.get(`${id}\0${version}`);
    if (!source) {
      throw new Error(`Unknown machine identity '${id}' version '${version}'.`);
    }

    if (!hasSnapshotSchema(source)) {
      throw new Error(
        `Machine version '${version}' does not define a snapshot schema.`
      );
    }
    const snapshot = await validate(
      source.snapshotSchema,
      raw,
      `snapshot for machine '${id}' version '${version}'`
    );

    return {
      source,
      ...(isVersionedStateMachine(source) && { machine: source }),
      snapshot: {
        ...(snapshot as Record<string, unknown>),
        machine: { id, version }
      }
    } as ParsedPersistedSnapshot<TEntries>;
  };

  return {
    parseSnapshot,
    async adaptEvents<TTargetVersion extends MachineVersion<TEntries>>(
      events: readonly unknown[],
      adaptationOptions: AdaptEventsOptions<TEntries, TTargetVersion>
    ): Promise<EventFrom<MachineForVersion<TEntries, TTargetVersion>>[]> {
      type TargetMachine = MachineForVersion<TEntries, TTargetVersion>;
      const target = machinesByIdentity.get(
        `${machineId}\0${adaptationOptions.to}`
      ) as TargetMachine | undefined;
      if (!target) {
        throw new Error(
          `Target version '${adaptationOptions.to}' is not backed by a machine for '${machineId}'.`
        );
      }

      const sourceId = adaptationOptions.from.id ?? machineId;
      const source = byIdentity.get(
        `${sourceId}\0${adaptationOptions.from.version}`
      );
      let sourceError: unknown;
      let sourceValidationFailed = false;
      const hasTypedSource = source && hasEventSchema(source);
      if (hasTypedSource) {
        let sourceEvents: EventObject[] | undefined;
        try {
          sourceEvents = await validateEvents(events, source);
        } catch (error) {
          sourceError = error;
          sourceValidationFailed = true;
        }
        if (sourceEvents) {
          if (source === target) {
            return sourceEvents as EventFrom<TargetMachine>[];
          }
          const adapter = (
            adaptationOptions.adapters as Record<
              string,
              | ((
                  events: readonly EventObject[]
                ) =>
                  | readonly EventFrom<TargetMachine>[]
                  | PromiseLike<readonly EventFrom<TargetMachine>[]>)
              | undefined
            >
          )[source.version];
          if (adapter) {
            return validateEvents(
              await adapter(sourceEvents),
              target
            ) as Promise<EventFrom<TargetMachine>[]>;
          }
        }
      }

      const wildcardAdapter = adaptationOptions.adapters['*'];
      if (wildcardAdapter) {
        return validateEvents(
          await wildcardAdapter(events, adaptationOptions.from),
          target
        ) as Promise<EventFrom<TargetMachine>[]>;
      }
      if (hasTypedSource) {
        if (sourceValidationFailed) {
          throw sourceError instanceof Error
            ? sourceError
            : new Error(
                `Unable to validate event history for machine '${source.id}' version '${source.version}'.`,
                { cause: sourceError }
              );
        }
        throw new Error(
          `No event adapter from version '${source.version}' to '${target.version}' for machine '${target.id}'.`
        );
      }
      throw new Error(
        `Unknown event history source '${sourceId}' version '${adaptationOptions.from.version}'.`
      );
    },
    async migrateSnapshot<TTargetVersion extends MachineVersion<TEntries>>(
      raw: unknown,
      migrationOptions: MigrateSnapshotOptions<TEntries, TTargetVersion>
    ): Promise<
      PersistedSnapshotFrom<MachineForVersion<TEntries, TTargetVersion>>
    > {
      type TargetMachine = MachineForVersion<TEntries, TTargetVersion>;
      const target = machinesByIdentity.get(
        `${machineId}\0${migrationOptions.to}`
      ) as TargetMachine | undefined;
      if (!target) {
        throw new Error(
          `Target version '${migrationOptions.to}' is not backed by a machine for '${machineId}'.`
        );
      }

      let source: ParsedPersistedSnapshot<TEntries> | undefined;
      let parseError: unknown;
      try {
        source = await parseSnapshot(raw);
      } catch (error) {
        parseError = error;
      }

      if (source) {
        if (source.source.version === target.version) {
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
        )[source.source.version];
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
            `No snapshot migration from version '${source.source.version}' to '${target.version}' for machine '${target.id}'.`
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
