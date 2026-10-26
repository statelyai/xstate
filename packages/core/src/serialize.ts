/**
 * Machine-definition serialization.
 *
 * `machineConfigToJSON` converts a machine config into a JSON-safe structure
 * (the `MachineJSON` shape accepted by `machineFromJSON`). The boundary
 * between serializable structure and runtime sources is explicit: functions are
 * represented as `@code` source objects, while actor logic, runtime schemas,
 * and other non-data runtime values are omitted.
 */

import type { MachineJSON } from './machineFromJSON.ts';
import type { AnyStateMachine } from './types.ts';

/** @public */
export interface CodeExpression {
  '@code': string;
  '@lang': 'ts';
}

/** @experimental */
export interface MachineSerializationDiagnostic {
  code:
    | 'code-expression'
    | 'omitted-value'
    | 'runtime-source'
    | 'unsupported-value';
  /** JSON Pointer into the machine definition. */
  path: string;
  message: string;
}

/**
 * Reports code expressions and values that need runtime bindings or are
 * omitted when exporting a definition. Does not call function values.
 *
 * @experimental
 */
export function getMachineSerializationDiagnostics(
  machine: AnyStateMachine
): MachineSerializationDiagnostic[] {
  const diagnostics: MachineSerializationDiagnostic[] = [];
  const ancestors = new Set<object>();
  const visit = (value: unknown, path: string, runtimeSource = false): void => {
    const report = (
      code: MachineSerializationDiagnostic['code'],
      message: string
    ) => diagnostics.push({ code, path, message });
    if (typeof value === 'function') {
      report(
        runtimeSource ? 'runtime-source' : 'code-expression',
        runtimeSource
          ? 'Supply this named implementation when reviving the definition.'
          : 'This function becomes source text and requires an evaluator and its dependencies.'
      );
      return;
    }
    if (
      value === undefined ||
      typeof value === 'bigint' ||
      typeof value === 'symbol'
    ) {
      report(
        'omitted-value',
        'This value is omitted from the exported definition.'
      );
      return;
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      report(
        'unsupported-value',
        'Nonfinite numbers do not retain their value in JSON.'
      );
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (isActorLogic(value)) {
      const named = typeof value.id === 'string';
      report(
        named ? 'runtime-source' : 'omitted-value',
        named
          ? 'Supply the actor implementation under its source ID when reviving.'
          : 'This actor has no named source; an invocation using it is omitted.'
      );
      return;
    }
    if (isRuntimeSchema(value)) {
      report(
        'omitted-value',
        'Runtime schemas are omitted; supply runtime schemas again when reviving.'
      );
      return;
    }
    if (ancestors.has(value)) {
      report(
        'unsupported-value',
        'Cyclic data cannot be exported as a JSON definition.'
      );
      return;
    }
    if (
      !Array.isArray(value) &&
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    ) {
      report(
        'omitted-value',
        'Class instances are omitted from the exported definition.'
      );
      return;
    }
    if (Object.hasOwn(value, '@code')) {
      report(
        'code-expression',
        'This source expression requires an evaluator and its dependencies.'
      );
      return;
    }
    ancestors.add(value);
    for (const [key, entry] of Object.entries(value)) {
      const pointer = `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`;
      const sourceEntry = /^\/(actions|guards|actors|delays)$/.test(path);
      visit(entry, pointer, sourceEntry);
    }
    ancestors.delete(value);
  };
  visit((machine as any)._json ?? machine.config, '');
  return diagnostics;
}

/**
 * Returns the JSON-serializable definition of a machine.
 *
 * Inline functions are represented as `{ "@code": string, "@lang": "ts" }`. A
 * machine created via `machineFromJSON` returns a copy of its original
 * JSON config (lossless round-trip):
 *
 * ```ts
 * import { machineToJSON, machineFromJSON } from 'xstate';
 *
 * const json = machineToJSON(machine);
 * const revived = machineFromJSON(
 *   JSON.parse(JSON.stringify(json))
 * );
 * ```
 *
 * @public
 */
export function machineToJSON(machine: AnyStateMachine): MachineJSON {
  const json = (machine as any)._json;
  return json ? cloneJSON(json) : machineConfigToJSON(machine.config);
}

/**
 * Copies the arrays and plain objects of a JSON definition, so that a machine
 * and its callers never share them.
 */
export function cloneJSON<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(cloneJSON) as T;
  }
  if (
    value === null ||
    typeof value !== 'object' ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  ) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, cloneJSON(entry)])
  ) as T;
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
  if (
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  ) {
    // Class instances (actor logic, schemas, dates, ...) are not portable.
    return undefined;
  }
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    const v = (value as Record<string, unknown>)[key];
    if (v !== undefined) {
      const jsonValue = valueToJSON(v);
      if (jsonValue !== undefined) {
        Object.defineProperty(result, key, {
          value: jsonValue,
          enumerable: true,
          writable: true,
          configurable: true
        });
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

function sourcesToJSON(
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
 *
 * @public
 */
export function machineConfigToJSON(
  config: Record<string, unknown>
): MachineJSON {
  const result = stateNodeConfigToJSON(config);

  const internalEvents = Object.keys(
    ((config.schemas as Record<string, unknown> | undefined)?.internalEvents as
      | object
      | undefined) ?? {}
  );
  // Only declared internal events are serialized; a stray top-level
  // `internalEvents` key on the config (removed author API) never leaks.
  delete result.internalEvents;
  if (internalEvents.length) {
    result.internalEvents = internalEvents;
  }
  if (config.schemas) {
    const schemas: Record<string, unknown> = {};
    for (const key of Object.keys(config.schemas as object)) {
      const value = (config.schemas as Record<string, unknown>)[key];
      if (value && typeof value === 'object' && !('~standard' in value)) {
        // Map-form schemas (events/emitted): preserve event-type keys.
        schemas[key] = sourcesToJSON(value as Record<string, unknown>);
      } else {
        schemas[key] = valueToJSON(value);
      }
      if (schemas[key] === undefined) {
        delete schemas[key];
      }
    }
    result.schemas = schemas;
  }
  for (const key of ['actions', 'guards', 'actors', 'delays'] as const) {
    if (config[key]) {
      const value = sourcesToJSON(config[key] as Record<string, unknown>);
      if (value && Object.keys(value).length) {
        result[key] = value;
      } else {
        delete result[key];
      }
    }
  }

  return result as unknown as MachineJSON;
}
