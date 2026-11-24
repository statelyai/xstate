import type { PublicEventFromMachine } from './eventTypes.ts';
import type { PersistedMachineSnapshot } from './machineVersion.types.ts';
import {
  isSnapshotRecord,
  validatePersistedSnapshot
} from './persistedSnapshotValidation.ts';
import type { StandardSchemaV1 } from './schema.types.ts';
import type {
  AnyStateMachine,
  ContextFrom,
  EventFrom,
  EventObject,
  Snapshot
} from './types.ts';
import { matchesEventDescriptor } from './utils.ts';

type PublicEventOf<TMachine extends AnyStateMachine> = PublicEventFromMachine<
  EventFrom<TMachine>,
  TMachine extends { _internalEventType: infer TInternal extends EventObject }
    ? TInternal
    : never
>;

/** @public */
export type MachinePersistedSnapshotSchema<TMachine extends AnyStateMachine> =
  StandardSchemaV1<
    unknown,
    Snapshot<unknown> &
      PersistedMachineSnapshot & { context: ContextFrom<TMachine> }
  >;

function findEventSchema(
  schemas: Record<string, StandardSchemaV1> | undefined,
  eventType: string
): StandardSchemaV1 | undefined {
  if (!schemas) {
    return undefined;
  }

  if (Object.hasOwn(schemas, eventType)) {
    return schemas[eventType];
  }

  const descriptor = Object.keys(schemas).find((key) =>
    matchesEventDescriptor(eventType, key)
  );
  return descriptor === undefined ? undefined : schemas[descriptor];
}

function memo<T>(cache: WeakMap<object, T>, key: object, create: () => T): T {
  let value = cache.get(key);
  if (!value) {
    cache.set(key, (value = create()));
  }
  return value;
}

const snapshotSchemas = new WeakMap<object, StandardSchemaV1>();
const historicalEventSchemas = new WeakMap<object, StandardSchemaV1>();
const eventSchemas = new WeakMap<object, StandardSchemaV1>();

/**
 * Standard Schema for snapshots persisted by `machine` (its version): checks
 * the snapshot structure against the machine's states and children, and the
 * context against `schemas.context`.
 *
 * @public
 */
export function snapshotSchema<TMachine extends AnyStateMachine>(
  machine: TMachine
): MachinePersistedSnapshotSchema<TMachine> {
  return memo(
    snapshotSchemas,
    machine,
    (): MachinePersistedSnapshotSchema<TMachine> => ({
      '~standard': {
        version: 1,
        vendor: 'xstate',
        validate: async (value) => {
          if (value === null || typeof value !== 'object') {
            return { issues: [{ message: 'Expected a persisted snapshot.' }] };
          }
          const snapshot: Record<string, unknown> = {
            historyValue: {},
            timers: [],
            ...(value as Record<string, unknown>)
          };
          const contextSchema = machine.schemas?.context;
          let context = snapshot.context;
          if (contextSchema) {
            const result = await contextSchema['~standard'].validate(context);
            if (result.issues) {
              return {
                issues: [
                  {
                    message: `Invalid context for machine '${machine.id}' version '${machine.version}': ${result.issues[0]?.message}`
                  }
                ]
              };
            }
            context = result.value;
          }
          for (const key of ['value', 'children'] as const) {
            if (!(key in snapshot)) {
              return {
                issues: [{ message: `Persisted snapshot is missing '${key}'.` }]
              };
            }
          }
          if (
            !['active', 'done', 'error', 'stopped'].includes(
              snapshot.status as string
            )
          ) {
            return {
              issues: [{ message: 'Persisted snapshot has invalid status.' }]
            };
          }
          if (!isSnapshotRecord(snapshot.historyValue)) {
            return {
              issues: [
                { message: "Persisted snapshot has invalid 'historyValue'." }
              ]
            };
          }
          try {
            validatePersistedSnapshot(machine, snapshot);
          } catch (error) {
            return {
              issues: [
                {
                  message:
                    error instanceof Error
                      ? error.message
                      : 'Persisted snapshot has invalid state value.'
                }
              ]
            };
          }
          return {
            value: { ...snapshot, context } as Snapshot<unknown> &
              PersistedMachineSnapshot & { context: ContextFrom<TMachine> }
          };
        }
      }
    })
  ) as MachinePersistedSnapshotSchema<TMachine>;
}

/**
 * @internal Standard Schema for events in a machine's history, including
 * internal and runtime events that public input excludes.
 */
export function historicalEventSchema(
  machine: AnyStateMachine
): StandardSchemaV1<unknown, EventObject> {
  return memo(
    historicalEventSchemas,
    machine,
    (): StandardSchemaV1<unknown, EventObject> => ({
      '~standard': {
        version: 1,
        vendor: 'xstate',
        validate: async (value) => {
          if (
            value === null ||
            typeof value !== 'object' ||
            typeof (value as EventObject).type !== 'string'
          ) {
            return { issues: [{ message: 'Expected an event object.' }] };
          }
          const event = value as EventObject;
          const eventSchemas = machine.schemas?.events;
          const internalEventSchemas = machine.schemas?.internalEvents;
          const isFrameworkEvent =
            event.type.startsWith('xstate.') ||
            event.type.startsWith('@xstate.');
          const schema =
            findEventSchema(internalEventSchemas, event.type) ??
            findEventSchema(eventSchemas, event.type);
          if (
            (eventSchemas || internalEventSchemas) &&
            !schema &&
            !isFrameworkEvent
          ) {
            return {
              issues: [
                {
                  message: `Unknown event '${event.type}' for machine '${machine.id}' version '${machine.version}'.`
                }
              ]
            };
          }
          if (!schema) {
            return { value: event as EventObject };
          }
          const { type, ...payload } = event;
          const result = await schema['~standard'].validate(payload);
          if (result.issues) {
            return result;
          }
          if (result.value === null || typeof result.value !== 'object') {
            return { issues: [{ message: 'Expected an event payload.' }] };
          }
          return { value: { ...result.value, type } as EventObject };
        }
      }
    })
  ) as StandardSchemaV1<unknown, EventObject>;
}

/**
 * Standard Schema for complete public input events of `machine`; excludes
 * internal and runtime events.
 *
 * @public
 */
export function eventSchema<TMachine extends AnyStateMachine>(
  machine: TMachine
): StandardSchemaV1<unknown, PublicEventOf<TMachine>> {
  return memo(
    eventSchemas,
    machine,
    (): StandardSchemaV1<unknown, PublicEventOf<TMachine>> => ({
      '~standard': {
        version: 1,
        vendor: 'xstate',
        validate: async (value) => {
          const event = value as EventObject;
          if (event && typeof event.type === 'string') {
            const internal = findEventSchema(
              machine.schemas?.internalEvents,
              event.type
            );
            const framework =
              event.type.startsWith('xstate.') ||
              event.type.startsWith('@xstate.');
            if (internal || framework) {
              if (!internal && event.type === 'xstate.route') {
                const result =
                  await historicalEventSchema(machine)['~standard'].validate(
                    value
                  );
                if (result.issues) {
                  return result;
                }
                const to = (result.value as EventObject & { to?: unknown }).to;
                const route =
                  typeof to === 'string' && to.startsWith('#')
                    ? machine.idMap.get(to.slice(1))
                    : undefined;
                if (
                  route &&
                  route !== machine.root &&
                  route.config.id &&
                  route.config.route
                ) {
                  return {
                    value: result.value as PublicEventOf<TMachine>
                  };
                }
              }
              return {
                issues: [
                  {
                    message: `Event '${event.type}' is not a public input event.`
                  }
                ]
              };
            }
          }
          return historicalEventSchema(machine)['~standard'].validate(
            value
          ) as Promise<StandardSchemaV1.Result<PublicEventOf<TMachine>>>;
        }
      }
    })
  ) as StandardSchemaV1<unknown, PublicEventOf<TMachine>>;
}
