/**
 * Machine-definition serialization.
 *
 * `machineConfigToJSON` converts a machine config into a JSON-safe structure
 * (the `MachineJSON` shape accepted by `createMachineFromConfig`). The boundary
 * between serializable structure and runtime implementations is explicit: any
 * value that cannot be represented as data (inline functions, actor logic,
 * runtime schemas) is replaced with an `{ "$unserializable": <kind> }` marker
 * rather than silently dropped.
 *
 * A machine definition is fully portable iff its JSON contains no
 * `$unserializable` markers; reviving a definition that has markers requires
 * re-providing those implementations (e.g. via `machine.provide(...)` or the
 * `actions`/`guards`/`actors` maps on `createMachineFromConfig` revival).
 */

export interface UnserializableMarker {
  $unserializable: 'function' | 'actor' | 'schema' | 'value';
  /** Best-effort identifier (function name, actor logic id) for diagnostics. */
  id?: string;
}

/**
 * State-node config keys that are part of the serializable definition. Keys
 * outside this list (unknown/internal properties) are dropped.
 */
const STATE_NODE_KEYS = [
  'id',
  'key',
  'type',
  'history',
  'description',
  'target',
  'version',
  'initial',
  'context',
  'on',
  'after',
  'always',
  'choice',
  'onTimeout',
  'timeout',
  'entry',
  'exit',
  'meta',
  'output',
  'tags',
  'input',
  '_scxmlDonedata'
] as const;

function marker(
  kind: UnserializableMarker['$unserializable'],
  id?: string
): UnserializableMarker {
  const m: UnserializableMarker = { $unserializable: kind };
  if (id) {
    m.id = id;
  }
  return m;
}

/** JSON-safe deep copy of a plain value; functions become markers. */
function valueToJSON(value: unknown): unknown {
  if (typeof value === 'function') {
    return marker('function', (value as { name?: string }).name || undefined);
  }
  if (value === null || typeof value !== 'object') {
    return typeof value === 'bigint' || typeof value === 'symbol'
      ? marker('value')
      : value;
  }
  if (Array.isArray(value)) {
    return value.map(valueToJSON);
  }
  if (value.constructor !== Object && value.constructor !== undefined) {
    // Class instances (actor logic, schemas, dates, ...) are not portable.
    return marker('value');
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const v = (value as Record<string, unknown>)[key];
    if (v !== undefined) {
      result[key] = valueToJSON(v);
    }
  }
  return result;
}

function invokeToJSON(invoke: unknown): unknown {
  if (Array.isArray(invoke)) {
    return invoke.map(invokeToJSON);
  }
  const def = invoke as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(def)) {
    const value = def[key];
    if (value === undefined) {
      continue;
    }
    result[key] =
      key === 'src' && typeof value !== 'string'
        ? // Actor logic keeps its dedicated marker kind so revival knows the
          // contract is an actor, not a plain function.
          marker('actor', (value as { id?: string }).id)
        : valueToJSON(value);
  }
  return result;
}

function implementationsToJSON(
  map: Record<string, unknown> | undefined,
  kind: UnserializableMarker['$unserializable']
): Record<string, unknown> | undefined {
  if (!map) {
    return undefined;
  }
  // Keys are preserved — they are the contract a revived machine must
  // fulfill via provide() — while values become markers (or stay, for
  // JSON-safe values like numeric delays).
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(map)) {
    const value = map[key];
    result[key] =
      typeof value === 'function'
        ? marker('function', key)
        : value && typeof value === 'object'
          ? marker(kind, key)
          : value;
  }
  return result;
}

function stateNodeConfigToJSON(
  config: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of STATE_NODE_KEYS) {
    const value = config[key];
    if (value !== undefined) {
      result[key] = valueToJSON(value);
    }
  }
  if (config.invoke !== undefined) {
    result.invoke = invokeToJSON(config.invoke);
  }
  if (config.states) {
    const states: Record<string, unknown> = {};
    for (const key of Object.keys(config.states as object)) {
      states[key] = stateNodeConfigToJSON(
        (config.states as Record<string, Record<string, unknown>>)[key]
      );
    }
    result.states = states;
  }

  return result;
}

/**
 * Converts a machine config (as passed to `createMachine`) to its JSON-safe
 * definition. See module docs for the `$unserializable` marker contract.
 */
export function machineConfigToJSON(
  config: Record<string, unknown>
): Record<string, unknown> {
  const result = stateNodeConfigToJSON(config);

  if (config.internalEvents !== undefined) {
    result.internalEvents = valueToJSON(config.internalEvents);
  }
  if (config.triggers !== undefined) {
    result.triggers = valueToJSON(config.triggers);
  }
  if (config.schemas) {
    const schemas: Record<string, unknown> = {};
    for (const key of Object.keys(config.schemas as object)) {
      const value = (config.schemas as Record<string, unknown>)[key];
      if (value && typeof value === 'object' && !('~standard' in value)) {
        // Map-form schemas (events/emitted): preserve event-type keys.
        schemas[key] = implementationsToJSON(
          value as Record<string, unknown>,
          'schema'
        );
      } else {
        schemas[key] = marker('schema', key);
      }
    }
    result.schemas = schemas;
  }
  for (const key of ['actions', 'guards', 'actors', 'delays'] as const) {
    if (config[key]) {
      result[key] = implementationsToJSON(
        config[key] as Record<string, unknown>,
        key === 'actors' ? 'actor' : 'function'
      );
    }
  }

  return result;
}
