import type { StandardSchemaV1 } from './schema.types.ts';
import type { EventObject, Snapshot } from './types.ts';

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
  _nextActorIds?: Record<string, number>;
  _nextTimerId?: number;
  stateInputs?: Record<string, Record<string, unknown>>;
  machine?: { id: string; version: string };
  version?: string;
  [key: string]: unknown;
};

/** A Standard Schema for a complete persisted machine snapshot. */
export type MachineSnapshotSchema = StandardSchemaV1<
  unknown,
  PersistedMachineSnapshot
>;

/** A Standard Schema for a complete persisted event object. */
export type MachineEventSchema = StandardSchemaV1<unknown, EventObject>;

/** Schema-backed capabilities for one machine version. */
export type MachineVersionDescriptor = {
  id: string;
  version: string;
} & (
  | {
      snapshotSchema: MachineSnapshotSchema;
      eventSchema?: MachineEventSchema;
    }
  | {
      snapshotSchema?: MachineSnapshotSchema;
      eventSchema: MachineEventSchema;
    }
);
