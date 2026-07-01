/**
 * Machine-definition serialization.
 *
 * `machineConfigToJSON` converts a machine config into a JSON-safe structure
 * (the `MachineJSON` shape accepted by `createMachineFromConfig`). The boundary
 * between serializable structure and runtime implementations is explicit:
 * functions are represented as `@code` source objects, while actor logic,
 * runtime schemas, and other non-data runtime values are omitted.
 */

import type { AnyStateMachine } from './types.ts';

export interface CodeExpression {
  '@code': string;
  '@lang': 'ts';
}

/**
 * Returns the JSON-serializable definition of a machine.
 *
 * Inline functions are represented as `{ "@code": string, "@lang": "ts" }`. A
 * machine created via `createMachineFromConfig` returns its original JSON
 * config (lossless round-trip):
 *
 * ```ts
 * import { serializeMachine, createMachineFromConfig } from 'xstate';
 *
 * const json = serializeMachine(machine);
 * const revived = createMachineFromConfig(
 *   JSON.parse(JSON.stringify(json))
 * );
 * ```
 */
export function serializeMachine(
  machine: AnyStateMachine
): Record<string, unknown> {
  return (machine as any)._json ?? machineConfigToJSON(machine.config);
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function codeExpression(fn: Function): CodeExpression {
  return {
    '@code': fn.toString(),
    '@lang': 'ts'
  };
}

function isActorLogic(value: unknown): value is { id?: string } {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as any).transition === 'function' &&
    typeof (value as any).getInitialSnapshot === 'function'
  );
}

function isRuntimeSchema(value: unknown): boolean {
  return !!value && typeof value === 'object' && '~standard' in value;
}

/** JSON-safe deep copy of a plain value; functions become code expressions. */
function valueToJSON(value: unknown): unknown {
  if (typeof value === 'function') {
    return codeExpression(value);
  }
  if (value === null || typeof value !== 'object') {
    return typeof value === 'bigint' || typeof value === 'symbol'
      ? undefined
      : value;
  }
  if (isActorLogic(value)) {
    return undefined;
  }
  if (isRuntimeSchema(value)) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map(valueToJSON).filter((item) => item !== undefined);
  }
  if (value.constructor !== Object && value.constructor !== undefined) {
    // Class instances (actor logic, schemas, dates, ...) are not portable.
    return undefined;
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const v = (value as Record<string, unknown>)[key];
    if (v !== undefined) {
      const jsonValue = valueToJSON(v);
      if (jsonValue !== undefined) {
        result[key] = jsonValue;
      }
    }
  }
  return result;
}

function invokeToJSON(invoke: unknown): unknown {
  if (Array.isArray(invoke)) {
    const values = invoke
      .map(invokeToJSON)
      .filter((value) => value !== undefined);
    return values.length ? values : undefined;
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
        ? (value as { id?: string }).id
        : valueToJSON(value);
    if (result[key] === undefined) {
      delete result[key];
    }
  }
  return result.src === undefined ? undefined : result;
}

function implementationsToJSON(
  map: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!map) {
    return undefined;
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(map)) {
    const value = map[key];
    if (typeof value === 'function') {
      result[key] = undefined;
    } else {
      result[key] = valueToJSON(value);
    }
    if (result[key] === undefined) {
      delete result[key];
    }
  }
  return result;
}

function stateNodeConfigToJSON(
  config: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const key of Object.keys(config)) {
    if (key === 'states' || key === 'invoke') {
      continue;
    }
    const value = config[key];
    if (value !== undefined) {
      result[key] = valueToJSON(value);
    }
  }
  if (config.invoke !== undefined) {
    const invoke = invokeToJSON(config.invoke);
    if (invoke !== undefined) {
      result.invoke = invoke;
    }
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
 * definition.
 */
export function machineConfigToJSON(
  config: Record<string, unknown>
): Record<string, unknown> {
  const result = stateNodeConfigToJSON(config);

  if (config.internalEvents !== undefined) {
    result.internalEvents = valueToJSON(config.internalEvents);
  }
  if (config.schemas) {
    const schemas: Record<string, unknown> = {};
    for (const key of Object.keys(config.schemas as object)) {
      const value = (config.schemas as Record<string, unknown>)[key];
      if (value && typeof value === 'object' && !('~standard' in value)) {
        // Map-form schemas (events/emitted): preserve event-type keys.
        schemas[key] = implementationsToJSON(value as Record<string, unknown>);
      } else {
        schemas[key] = valueToJSON(value);
      }
      if (schemas[key] === undefined) {
        delete schemas[key];
      }
    }
    result.schemas = schemas;
  }
  for (const key of ['actions', 'guards', 'actorSources', 'delays'] as const) {
    if (config[key]) {
      const value = implementationsToJSON(
        config[key] as Record<string, unknown>
      );
      if (value && Object.keys(value).length) {
        result[key] = value;
      } else {
        delete result[key];
      }
    }
  }

  return result;
}
