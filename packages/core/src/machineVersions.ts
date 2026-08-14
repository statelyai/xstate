import type { StandardSchemaV1 } from './schema.types.ts';
import type { AnyMachineSchemas } from './types.v6.ts';
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
  schemas?: AnyMachineSchemas;
};

/** Durable machine snapshot fields that a historical snapshot schema describes. */
export type PersistedMachineSnapshot = {
  status: Snapshot<unknown>['status'];
  output?: unknown;
  error?: unknown;
  value: unknown;
  context: unknown;
  children: Record<string, unknown>;
  historyValue: Record<string, unknown>;
  timers: Record<string, unknown>;
  _nextActorId?: number;
  _nextTimerId?: number;
  stateInputs?: Record<string, Record<string, unknown>>;
  machine?: { id: string; version: string };
  version?: string;
  [key: string]: unknown;
};

/** A schema-backed historical machine snapshot version. */
export type SnapshotVersion<
  TId extends string = string,
  TVersion extends string = string,
  TSchema extends StandardSchemaV1<unknown, PersistedMachineSnapshot> =
    StandardSchemaV1<unknown, PersistedMachineSnapshot>
> = {
  kind: 'snapshot';
  id: TId;
  version: TVersion;
  schema: TSchema;
};

type VersionEntry = VersionedStateMachine | SnapshotVersion;

/** Describes a historical persisted snapshot without retaining its machine. */
export function snapshotVersion<
  const TId extends string,
  const TVersion extends string,
  const TSchema extends StandardSchemaV1<unknown, PersistedMachineSnapshot>
>(descriptor: Omit<SnapshotVersion<TId, TVersion, TSchema>, 'kind'>) {
  return { ...descriptor, kind: 'snapshot' as const };
}

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
  unversioned?: TEntries[number]['version'];
};

type MaybePromise<T> = T | PromiseLike<T>;

type MachineVersion<TEntries extends readonly VersionEntry[]> = Extract<
  TEntries[number],
  VersionedStateMachine
>['version'];

type EntryVersion<TEntries extends readonly VersionEntry[]> =
  TEntries[number]['version'];

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

type EntryForVersion<
  TEntries extends readonly VersionEntry[],
  TVersion extends string
> = {
  [K in keyof TEntries]: TEntries[K] extends VersionEntry
    ? TEntries[K]['version'] extends TVersion
      ? TEntries[K]
      : never
    : never;
}[number];

type PersistedSnapshotFromEntry<TEntry extends VersionEntry> =
  TEntry extends SnapshotVersion<string, string, infer TSchema>
    ? StandardSchemaV1.InferOutput<TSchema>
    : TEntry extends VersionedStateMachine
      ? PersistedSnapshotFrom<TEntry>
      : never;

export type PersistedSnapshotSource = {
  id?: string;
  version?: string;
};

export type SnapshotMigrationHandlers<
  TEntries extends readonly VersionEntry[],
  TTarget extends VersionedStateMachine
> = {
  [TVersion in Exclude<EntryVersion<TEntries>, TTarget['version']>]?: (
    snapshot: PersistedSnapshotFromEntry<EntryForVersion<TEntries, TVersion>>
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
  [TVersion in Exclude<MachineVersion<TEntries>, TTarget['version']>]?: (
    events: readonly EventFrom<MachineForVersion<TEntries, TVersion>>[]
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

function isSnapshotVersion(entry: VersionEntry): entry is SnapshotVersion {
  return (entry as SnapshotVersion).kind === 'snapshot';
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

async function validateEvents<TMachine extends VersionedStateMachine>(
  events: readonly unknown[],
  machine: TMachine
): Promise<EventFrom<TMachine>[]> {
  return Promise.all(
    events.map(async (event, index) => {
      if (!isObject(event) || typeof event.type !== 'string') {
        throw new Error(`Invalid event at index ${index}.`);
      }
      const eventSchemas = machine.schemas?.events;
      const isFrameworkEvent =
        event.type.startsWith('xstate.') || event.type.startsWith('@xstate.');
      const schema =
        eventSchemas && Object.hasOwn(eventSchemas, event.type)
          ? eventSchemas[event.type]
          : undefined;
      if (eventSchemas && !schema && !isFrameworkEvent) {
        throw new Error(
          `Unknown event '${event.type}' for machine '${machine.id}' version '${machine.version}'.`
        );
      }
      if (!schema) {
        return event as EventFrom<TMachine>;
      }
      const { type, ...payload } = event;
      const validatedPayload = await validate(
        schema,
        payload,
        `event '${type}' at index ${index}`
      );
      if (!isObject(validatedPayload)) {
        throw new Error(`Invalid event '${type}' at index ${index}.`);
      }
      return { ...validatedPayload, type } as EventFrom<TMachine>;
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
    if (!isSnapshotVersion(entry)) {
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

    const snapshot = isSnapshotVersion(source)
      ? await validate(
          source.schema,
          raw,
          `snapshot for machine '${id}' version '${version}'`
        )
      : {
          ...raw,
          context: await validate(
            source.schemas?.context,
            raw.context,
            `context for machine '${id}' version '${version}'`
          )
        };

    return {
      source,
      ...(!isSnapshotVersion(source) && { machine: source }),
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
      const source = machinesByIdentity.get(
        `${sourceId}\0${adaptationOptions.from.version}`
      );
      let sourceError: unknown;
      let sourceValidationFailed = false;
      if (source) {
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
            return validateEvents(await adapter(sourceEvents), target);
          }
        }
      }

      const wildcardAdapter = adaptationOptions.adapters['*'];
      if (wildcardAdapter) {
        return validateEvents(
          await wildcardAdapter(events, adaptationOptions.from),
          target
        );
      }
      if (source) {
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
