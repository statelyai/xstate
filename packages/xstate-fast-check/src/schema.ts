import * as fc from 'fast-check';
import type { AnyStateMachine, EventFrom, SnapshotFrom } from 'xstate';
import type { PropertyEventGenerators } from 'xstate/graph';
import type { FastCheckGeneratorKind } from './index.ts';

/**
 * Converts a single payload schema into a FastCheck arbitrary. Returns
 * `undefined` when the converter does not recognize the schema.
 */
export type SchemaConverter = (
  schema: unknown,
  path: string
) => fc.Arbitrary<unknown> | undefined;

export interface EventsFromSchemasOptions {
  /**
   * What to do with event types that the machine handles but that have no
   * declared schema.
   *
   * - `'empty'` (default) generates `{}` for them.
   * - `'skip'` leaves them out of the returned map.
   */
  readonly eventsWithoutSchema?: 'empty' | 'skip';
  /**
   * Converts schemas that are not recognized by the built-in converters.
   * Return `undefined` to fall through to the built-in error.
   */
  readonly fallback?: SchemaConverter;
  /** @internal Extra converters registered by an entrypoint. */
  readonly converters?: readonly SchemaConverter[];
}

const SUPPORTED_LIBRARIES =
  'Zod (v3 and v4) and Effect Schema (via `@xstate/fast-check/effect-schema`)';

function unsupported(message: string): never {
  throw new Error(`[@xstate/fast-check] ${message}`);
}

/** ---------------------------------------------------------------- Zod --- */

interface ZodDef {
  readonly type?: string;
  readonly typeName?: string;
  readonly [key: string]: unknown;
}

function getZodDef(schema: unknown): ZodDef | undefined {
  if (
    schema === null ||
    (typeof schema !== 'object' && typeof schema !== 'function')
  ) {
    return undefined;
  }
  const candidate = schema as {
    _zod?: { def?: ZodDef };
    _def?: ZodDef;
  };
  const def = candidate._zod?.def ?? candidate._def;
  if (!def || typeof def !== 'object') {
    return undefined;
  }
  return def;
}

function getZodKind(def: ZodDef): string | undefined {
  if (typeof def.type === 'string') {
    // Zod v4: `{ type: 'object' }`
    return def.type;
  }
  if (typeof def.typeName === 'string') {
    // Zod v3: `{ typeName: 'ZodObject' }`
    return def.typeName.replace(/^Zod/, '').toLowerCase();
  }
  return undefined;
}

function getZodShape(def: ZodDef): Record<string, unknown> {
  const shape = def.shape;
  return typeof shape === 'function'
    ? (shape as () => Record<string, unknown>)()
    : ((shape ?? {}) as Record<string, unknown>);
}

function isZodOptionalKind(schema: unknown): boolean {
  const def = getZodDef(schema);
  if (!def) {
    return false;
  }
  const kind = getZodKind(def);
  return kind === 'optional' || kind === 'default' || kind === 'prefault';
}

function zodNumberArbitrary(def: ZodDef): fc.Arbitrary<number> {
  const format = def.format;
  const checks = Array.isArray(def.checks) ? def.checks : [];
  const isInt =
    (typeof format === 'string' && format.includes('int')) ||
    checks.some((check) => {
      const checkDef = ((check as { _zod?: { def?: Record<string, unknown> } })
        ?._zod?.def ?? check) as { kind?: string; format?: string } | undefined;
      return (
        checkDef?.kind === 'int' ||
        (typeof checkDef?.format === 'string' &&
          checkDef.format.includes('int'))
      );
    });
  return isInt
    ? fc.integer()
    : fc.double({ noNaN: true, noDefaultInfinity: true });
}

function fromZod(schema: unknown, path: string): fc.Arbitrary<unknown> {
  const def = getZodDef(schema);
  if (!def) {
    unsupported(`Expected a Zod schema at '${path}'.`);
  }
  const kind = getZodKind(def);
  switch (kind) {
    case 'string':
      return fc.string();
    case 'number':
      return zodNumberArbitrary(def);
    case 'int':
    case 'bigint':
      return kind === 'int' ? fc.integer() : fc.bigInt();
    case 'boolean':
      return fc.boolean();
    case 'date':
      return fc.date({ noInvalidDate: true });
    case 'null':
      return fc.constant(null);
    case 'undefined':
    case 'void':
      return fc.constant(undefined);
    case 'any':
    case 'unknown':
      return fc.anything();
    case 'literal': {
      const values = Array.isArray(def.values)
        ? (def.values as unknown[])
        : [def.value];
      return fc.constantFrom(...values);
    }
    case 'enum':
    case 'nativeenum': {
      const values = Array.isArray(def.values)
        ? (def.values as unknown[])
        : Object.values(
            (def.entries ?? def.values ?? {}) as Record<string, unknown>
          );
      if (!values.length) {
        unsupported(`Zod enum at '${path}' declares no values.`);
      }
      return fc.constantFrom(...values);
    }
    case 'union': {
      const options = (def.options ?? []) as unknown[];
      if (!options.length) {
        unsupported(`Zod union at '${path}' declares no options.`);
      }
      return fc.oneof(
        ...options.map((option, index) =>
          fromZod(option, `${path}|${String(index)}`)
        )
      );
    }
    case 'array':
      return fc.array(fromZod(def.element ?? def.type, `${path}[]`));
    case 'tuple': {
      const items = (def.items ?? []) as unknown[];
      return fc.tuple(
        ...items.map((item, index) => fromZod(item, `${path}[${index}]`))
      );
    }
    case 'record':
      return fc.dictionary(
        fromZod(def.keyType, `${path}.<key>`) as fc.Arbitrary<string>,
        fromZod(def.valueType, `${path}.<value>`)
      );
    case 'optional':
      return fc.option(fromZod(def.innerType, path), {
        nil: undefined
      });
    case 'nullable':
      return fc.option(fromZod(def.innerType, path), { nil: null });
    case 'default':
    case 'prefault':
    case 'catch':
    case 'readonly':
    case 'nonoptional':
      return fromZod(def.innerType, path);
    case 'object':
    case 'interface': {
      const shape = getZodShape(def);
      return zodObjectArbitrary(shape, path);
    }
    default:
      return unsupported(
        `Unsupported Zod schema kind '${kind ?? 'unknown'}' at '${path}'.`
      );
  }
}

function zodObjectArbitrary(
  shape: Record<string, unknown>,
  path: string
): fc.Arbitrary<Record<string, unknown>> {
  const model: Record<string, fc.Arbitrary<unknown>> = {};
  const requiredKeys: string[] = [];
  for (const [key, value] of Object.entries(shape)) {
    model[key] = fromZod(value, path ? `${path}.${key}` : key);
    if (!isZodOptionalKind(value)) {
      requiredKeys.push(key);
    }
  }
  return fc.record(model, { requiredKeys });
}

function isZodSchema(schema: unknown): boolean {
  const def = getZodDef(schema);
  return !!def && getZodKind(def) !== undefined;
}

/** ------------------------------------------------------------ Generic --- */

const zodConverter: SchemaConverter = (schema, path) =>
  isZodSchema(schema) ? fromZod(schema, path) : undefined;

function isEffectSchema(schema: unknown): boolean {
  return (
    schema !== null &&
    (typeof schema === 'object' || typeof schema === 'function') &&
    'ast' in (schema as object) &&
    !!(schema as { ast?: { _tag?: unknown } }).ast
  );
}

function isTypeOnlySchema(schema: unknown): boolean {
  return (
    isStandardSchema(schema) &&
    (schema as { '~standard': { vendor?: string } })['~standard'].vendor ===
      'xstate.types'
  );
}

function isStandardSchema(schema: unknown): boolean {
  return (
    schema !== null &&
    (typeof schema === 'object' || typeof schema === 'function') &&
    '~standard' in (schema as object)
  );
}

/**
 * Converts a declared payload schema into a FastCheck arbitrary. Only schema
 * libraries whose structure can be inspected are supported; a Standard Schema
 * alone only validates, so nothing can be generated from it.
 */
export function arbitraryFromSchema(
  schema: unknown,
  options: EventsFromSchemasOptions = {},
  path = ''
): fc.Arbitrary<unknown> {
  const converters = [...(options.converters ?? []), zodConverter];
  for (const converter of converters) {
    const arbitrary = converter(schema, path);
    if (arbitrary) {
      return arbitrary;
    }
  }
  const fallback = options.fallback?.(schema, path);
  if (fallback) {
    return fallback;
  }
  if (isEffectSchema(schema)) {
    return unsupported(
      `Effect Schema found at '${path}'. Import \`eventsFromSchemas\` from '@xstate/fast-check/effect-schema' to generate from Effect Schemas.`
    );
  }
  if (isTypeOnlySchema(schema)) {
    return unsupported(
      `The schema at '${path}' is a type-only schema (\`types<...>()\`). Type-only declarations carry no runtime structure, so no generator can be derived. Declare a runtime schema (${SUPPORTED_LIBRARIES}) or pass an explicit generator.`
    );
  }
  if (isStandardSchema(schema)) {
    return unsupported(
      `The schema at '${path}' implements Standard Schema but is not a recognized schema library. Standard Schema only validates, so no generator can be derived. Supported libraries: ${SUPPORTED_LIBRARIES}. Pass a \`fallback\` converter to handle it.`
    );
  }
  return unsupported(
    `Unrecognized schema at '${path}'. Supported libraries: ${SUPPORTED_LIBRARIES}.`
  );
}

/** Strips a top-level `type` key; event-map keys supply the event type. */
function stripType(
  arbitrary: fc.Arbitrary<unknown>,
  eventType: string
): fc.Arbitrary<Record<string, unknown>> {
  return arbitrary.map((value) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(
        `Property event "${eventType}" generated a non-object payload (${
          typeof value === 'string' ? JSON.stringify(value) : String(value)
        }). Event payloads must be plain objects; use a \`resolve\` function to map generated values onto an event payload.`
      );
    }
    const { type: _type, ...payload } = value as Record<string, unknown>;
    return payload;
  });
}

/**
 * Derives event generators from the event schemas declared on a machine
 * (`setup({ schemas: { events } })` or `createMachine({ schemas: { events } })`).
 *
 * Type-only event declarations (`types.events`) are erased at runtime and
 * cannot be used here.
 */
export function eventsFromSchemas<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options: EventsFromSchemasOptions = {}
): PropertyEventGenerators<
  SnapshotFrom<TMachine>,
  EventFrom<TMachine>,
  FastCheckGeneratorKind
> {
  const schemas = (machine.schemas?.events ?? {}) as Record<string, unknown>;
  const generators: Record<string, fc.Arbitrary<unknown>> = {};

  for (const [eventType, schema] of Object.entries(schemas)) {
    if (eventType.includes('*')) {
      // Wildcard descriptors do not name a concrete event type.
      continue;
    }
    generators[eventType] = stripType(
      arbitraryFromSchema(schema, options, eventType),
      eventType
    );
  }

  if ((options.eventsWithoutSchema ?? 'empty') === 'empty') {
    for (const eventType of machine.events) {
      if (
        typeof eventType !== 'string' ||
        eventType.includes('*') ||
        eventType.startsWith('xstate.') ||
        eventType.startsWith('@xstate.') ||
        generators[eventType]
      ) {
        continue;
      }
      generators[eventType] = fc.constant({});
    }
  }

  return generators as PropertyEventGenerators<
    SnapshotFrom<TMachine>,
    EventFrom<TMachine>,
    FastCheckGeneratorKind
  >;
}

/**
 * Merges derived generators with explicit ones. Explicit entries win for event
 * types declared in both.
 */
export function mergeEventGenerators<TDerived, TExplicit>(
  derived: TDerived,
  explicit: TExplicit
): TDerived & TExplicit {
  return { ...derived, ...explicit };
}
