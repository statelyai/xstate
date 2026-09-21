import * as fc from 'fast-check';
import type { AnyStateMachine, EventFrom, SnapshotFrom } from 'xstate';
import type { PropertyEventGenerators } from 'xstate/graph';
import type { FastCheckGeneratorKind } from './adapter.ts';

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
  'Zod (v3 and v4) and Effect Schema (via `@xstate/test/effect-schema`)';

function unsupported(message: string): never {
  throw new Error(`[@xstate/test] ${message}`);
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

/**
 * A Zod check (`.min()`, `.email()`, `.trim()`, …) normalized across Zod v3
 * (`_def.checks[]` with a `kind`) and Zod v4 (`_zod.def.checks[]` with a
 * `check`, plus format schemas that carry the check on the def itself).
 */
type ZodCheck =
  | {
      readonly kind: 'min';
      readonly value: unknown;
      readonly inclusive: boolean;
    }
  | {
      readonly kind: 'max';
      readonly value: unknown;
      readonly inclusive: boolean;
    }
  | { readonly kind: 'int' }
  | { readonly kind: 'multipleOf'; readonly value: unknown }
  | { readonly kind: 'minLength'; readonly value: number }
  | { readonly kind: 'maxLength'; readonly value: number }
  | { readonly kind: 'length'; readonly value: number }
  | {
      readonly kind: 'format';
      readonly format: string;
      readonly pattern?: RegExp;
      readonly value?: string;
    }
  | { readonly kind: 'transform'; readonly apply: (value: string) => string };

function unsupportedCheck(name: string, kind: string, path: string): never {
  return unsupported(
    `Unsupported Zod check '${name}' on ${kind} at '${path}'. Pass an explicit generator for this payload.`
  );
}

/**
 * Collects the raw check definitions of a schema. Zod v4 wraps each check in a
 * `_zod.def`, and a format schema (`z.email()`, `z.int()`) carries its check on
 * the schema def itself.
 */
function getZodCheckDefs(def: ZodDef): Record<string, any>[] {
  const raw: unknown[] = [];
  if (typeof def.check === 'string') {
    raw.push(def);
  }
  if (Array.isArray(def.checks)) {
    raw.push(...def.checks);
  }
  return raw.map(
    (check) =>
      ((check as { _zod?: { def?: unknown } })?._zod?.def ?? check) as Record<
        string,
        any
      >
  );
}

function numberFormatChecks(
  format: string,
  name: string,
  kind: string,
  path: string
): ZodCheck[] {
  const bounded = (min: number | bigint, max: number | bigint): ZodCheck[] => [
    { kind: 'int' },
    { kind: 'min', value: min, inclusive: true },
    { kind: 'max', value: max, inclusive: true }
  ];
  switch (format) {
    case 'int':
    case 'safeint':
      return [{ kind: 'int' }];
    case 'int32':
      return bounded(-2147483648, 2147483647);
    case 'uint32':
      return bounded(0, 4294967295);
    case 'int64':
      return bounded(-(2n ** 63n), 2n ** 63n - 1n);
    case 'uint64':
      return bounded(0n, 2n ** 64n - 1n);
    case 'float64':
      // A plain double; no extra constraint.
      return [];
    default:
      return unsupportedCheck(`${name}:${format}`, kind, path);
  }
}

/** Normalizes every check declared on a schema, per Zod major version. */
function getZodChecks(def: ZodDef, kind: string, path: string): ZodCheck[] {
  const checks: ZodCheck[] = [];
  for (const check of getZodCheckDefs(def)) {
    const name: string | undefined =
      typeof check.check === 'string'
        ? check.check
        : typeof check.kind === 'string'
          ? check.kind
          : undefined;
    switch (name) {
      // ------------------------------------------------------------ v4 ---
      case 'greater_than':
        checks.push({
          kind: 'min',
          value: check.value,
          inclusive: check.inclusive !== false
        });
        break;
      case 'less_than':
        checks.push({
          kind: 'max',
          value: check.value,
          inclusive: check.inclusive !== false
        });
        break;
      case 'min_length':
      case 'min_size':
        checks.push({ kind: 'minLength', value: check.minimum });
        break;
      case 'max_length':
      case 'max_size':
        checks.push({ kind: 'maxLength', value: check.maximum });
        break;
      case 'length_equals':
      case 'size_equals':
        checks.push({ kind: 'length', value: check.length ?? check.size });
        break;
      case 'multiple_of':
        checks.push({ kind: 'multipleOf', value: check.value });
        break;
      case 'number_format':
      case 'bigint_format':
        checks.push(
          ...numberFormatChecks(String(check.format), name, kind, path)
        );
        break;
      case 'string_format':
        checks.push({
          kind: 'format',
          format: String(check.format),
          pattern: check.pattern instanceof RegExp ? check.pattern : undefined,
          value: check.prefix ?? check.suffix ?? check.includes
        });
        break;
      case 'overwrite':
        if (typeof check.tx !== 'function') {
          unsupportedCheck(name, kind, path);
        }
        checks.push({ kind: 'transform', apply: check.tx });
        break;
      // ------------------------------------------------------------ v3 ---
      case 'min':
        checks.push(
          kind === 'string'
            ? { kind: 'minLength', value: check.value }
            : {
                kind: 'min',
                value: check.value,
                inclusive: check.inclusive !== false
              }
        );
        break;
      case 'max':
        checks.push(
          kind === 'string'
            ? { kind: 'maxLength', value: check.value }
            : {
                kind: 'max',
                value: check.value,
                inclusive: check.inclusive !== false
              }
        );
        break;
      case 'length':
        checks.push({ kind: 'length', value: check.value });
        break;
      case 'int':
        checks.push({ kind: 'int' });
        break;
      case 'multipleOf':
        checks.push({ kind: 'multipleOf', value: check.value });
        break;
      case 'finite':
      case 'safe':
        // Generated doubles are already finite and safe.
        break;
      case 'email':
      case 'uuid':
      case 'url':
        checks.push({ kind: 'format', format: name });
        break;
      case 'regex':
        if (!(check.regex instanceof RegExp)) {
          unsupportedCheck(name, kind, path);
        }
        checks.push({ kind: 'format', format: 'regex', pattern: check.regex });
        break;
      case 'startsWith':
        checks.push({
          kind: 'format',
          format: 'starts_with',
          value: check.value
        });
        break;
      case 'endsWith':
        checks.push({
          kind: 'format',
          format: 'ends_with',
          value: check.value
        });
        break;
      case 'includes':
        checks.push({ kind: 'format', format: 'includes', value: check.value });
        break;
      case 'trim':
        checks.push({ kind: 'transform', apply: (value) => value.trim() });
        break;
      case 'toLowerCase':
        checks.push({
          kind: 'transform',
          apply: (value) => value.toLowerCase()
        });
        break;
      case 'toUpperCase':
        checks.push({
          kind: 'transform',
          apply: (value) => value.toUpperCase()
        });
        break;
      default:
        unsupportedCheck(name ?? 'unknown', kind, path);
    }
  }
  return checks;
}

interface SizeBounds {
  minLength?: number;
  maxLength?: number;
}

/** Reads `minLength`/`maxLength`/`length` checks, rejecting anything else. */
function zodSizeBounds(checks: readonly ZodCheck[], path: string): SizeBounds {
  const bounds: SizeBounds = {};
  for (const check of checks) {
    switch (check.kind) {
      case 'minLength':
        bounds.minLength = Math.max(bounds.minLength ?? 0, check.value);
        break;
      case 'maxLength':
        bounds.maxLength = Math.min(bounds.maxLength ?? Infinity, check.value);
        break;
      case 'length':
        bounds.minLength = check.value;
        bounds.maxLength = check.value;
        break;
      default:
        unsupportedCheck(check.kind, 'collection', path);
    }
  }
  return bounds;
}

/** Merges the size bounds Zod v3 keeps on the def itself, not in `checks`. */
function zodLegacySizeBounds(def: ZodDef, bounds: SizeBounds): SizeBounds {
  const read = (value: unknown): number | undefined =>
    typeof (value as { value?: unknown })?.value === 'number'
      ? (value as { value: number }).value
      : undefined;
  const exact = read(def.exactLength);
  const min = exact ?? read(def.minLength) ?? read(def.minSize);
  const max = exact ?? read(def.maxLength) ?? read(def.maxSize);
  const minLength = min ?? bounds.minLength;
  const maxLength = max ?? bounds.maxLength;
  return {
    ...(minLength === undefined ? {} : { minLength }),
    ...(maxLength === undefined || maxLength === Infinity ? {} : { maxLength })
  };
}

function toNumber(value: unknown): number {
  return typeof value === 'bigint'
    ? Number(value)
    : value instanceof Date
      ? value.getTime()
      : (value as number);
}

interface NumericBounds {
  min?: number;
  max?: number;
  minExcluded: boolean;
  maxExcluded: boolean;
  int: boolean;
  multipleOf?: number;
}

function zodNumericBounds(
  checks: readonly ZodCheck[],
  kind: string,
  path: string
): NumericBounds {
  const bounds: NumericBounds = {
    minExcluded: false,
    maxExcluded: false,
    int: false
  };
  for (const check of checks) {
    switch (check.kind) {
      case 'min': {
        const value = toNumber(check.value);
        if (bounds.min === undefined || value >= bounds.min) {
          bounds.min = value;
          bounds.minExcluded = !check.inclusive;
        }
        break;
      }
      case 'max': {
        const value = toNumber(check.value);
        if (bounds.max === undefined || value <= bounds.max) {
          bounds.max = value;
          bounds.maxExcluded = !check.inclusive;
        }
        break;
      }
      case 'int':
        bounds.int = true;
        break;
      case 'multipleOf':
        bounds.multipleOf = toNumber(check.value);
        break;
      default:
        unsupportedCheck(check.kind, kind, path);
    }
  }
  return bounds;
}

const INT_SPAN = 2 ** 31 - 1;

function integerRange(bounds: NumericBounds): { min: number; max: number } {
  let min =
    bounds.min === undefined
      ? -INT_SPAN
      : Math.ceil(bounds.min) +
        (bounds.minExcluded && Number.isInteger(bounds.min) ? 1 : 0);
  let max =
    bounds.max === undefined
      ? INT_SPAN
      : Math.floor(bounds.max) -
        (bounds.maxExcluded && Number.isInteger(bounds.max) ? 1 : 0);
  min = Math.max(min, -Number.MAX_SAFE_INTEGER);
  max = Math.min(max, Number.MAX_SAFE_INTEGER);
  return { min, max };
}

function zodNumberArbitrary(
  def: ZodDef,
  kind: string,
  path: string
): fc.Arbitrary<number> {
  const bounds = zodNumericBounds(getZodChecks(def, kind, path), kind, path);
  const format = def.format;
  if (
    !bounds.int &&
    typeof format === 'string' &&
    (format.includes('int') || kind === 'int')
  ) {
    bounds.int = true;
  }

  if (bounds.multipleOf !== undefined) {
    const step = bounds.multipleOf;
    const limit = Math.min(
      INT_SPAN,
      Math.floor(Number.MAX_SAFE_INTEGER / Math.abs(step))
    );
    const factors = integerRange({
      ...bounds,
      min: bounds.min === undefined ? undefined : bounds.min / step,
      max: bounds.max === undefined ? undefined : bounds.max / step,
      multipleOf: undefined
    });
    const min = Math.max(factors.min, -limit);
    const max = Math.min(factors.max, limit);
    if (min > max) {
      unsupported(
        `Zod number at '${path}' declares a multipleOf that no value in its range satisfies.`
      );
    }
    return fc.integer({ min, max }).map((factor) => factor * step);
  }

  if (bounds.int) {
    const { min, max } = integerRange(bounds);
    if (min > max) {
      unsupported(`Zod number at '${path}' declares an empty integer range.`);
    }
    return fc.integer({ min, max });
  }

  return fc.double({
    noNaN: true,
    noDefaultInfinity: true,
    ...(bounds.min === undefined
      ? {}
      : { min: bounds.min, minExcluded: bounds.minExcluded }),
    ...(bounds.max === undefined
      ? {}
      : { max: bounds.max, maxExcluded: bounds.maxExcluded })
  });
}

function zodBigIntArbitrary(
  def: ZodDef,
  kind: string,
  path: string
): fc.Arbitrary<bigint> {
  let min: bigint | undefined;
  let max: bigint | undefined;
  for (const check of getZodChecks(def, kind, path)) {
    switch (check.kind) {
      case 'min': {
        const value =
          BigInt(check.value as bigint) + (check.inclusive ? 0n : 1n);
        min = min === undefined || value > min ? value : min;
        break;
      }
      case 'max': {
        const value =
          BigInt(check.value as bigint) - (check.inclusive ? 0n : 1n);
        max = max === undefined || value < max ? value : max;
        break;
      }
      case 'int':
        break;
      default:
        unsupportedCheck(check.kind, 'bigint', path);
    }
  }
  return fc.bigInt({
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max })
  });
}

function zodDateArbitrary(
  def: ZodDef,
  kind: string,
  path: string
): fc.Arbitrary<Date> {
  let min: Date | undefined;
  let max: Date | undefined;
  for (const check of getZodChecks(def, kind, path)) {
    switch (check.kind) {
      case 'min': {
        const value = new Date(
          toNumber(check.value) + (check.inclusive ? 0 : 1)
        );
        min = min === undefined || value > min ? value : min;
        break;
      }
      case 'max': {
        const value = new Date(
          toNumber(check.value) - (check.inclusive ? 0 : 1)
        );
        max = max === undefined || value < max ? value : max;
        break;
      }
      default:
        unsupportedCheck(check.kind, 'date', path);
    }
  }
  return fc.date({
    noInvalidDate: true,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max })
  });
}

const ALPHANUMERIC = fc.constantFrom(
  ...'abcdefghijklmnopqrstuvwxyz0123456789'.split('')
);

/**
 * `fc.emailAddress()` covers RFC 5322, which is wider than the address Zod
 * accepts, so a conservative address is generated instead.
 */
const emailArbitrary = (): fc.Arbitrary<string> =>
  fc
    .tuple(
      fc.string({ unit: ALPHANUMERIC, minLength: 1, maxLength: 10 }),
      fc.string({ unit: ALPHANUMERIC, minLength: 1, maxLength: 10 })
    )
    .map(([local, domain]) => `${local}@${domain}.com`);

const NAMED_STRING_FORMATS: Record<string, () => fc.Arbitrary<string>> = {
  email: emailArbitrary,
  uuid: () => fc.uuid(),
  url: () => fc.webUrl()
};

function zodStringArbitrary(
  def: ZodDef,
  kind: string,
  path: string
): fc.Arbitrary<string> {
  let minLength: number | undefined;
  let maxLength: number | undefined;
  let prefix = '';
  let suffix = '';
  let infix = '';
  let named: fc.Arbitrary<string> | undefined;
  let pattern: RegExp | undefined;
  const transforms: ((value: string) => string)[] = [];

  for (const check of getZodChecks(def, kind, path)) {
    switch (check.kind) {
      case 'minLength':
        minLength = Math.max(minLength ?? 0, check.value);
        break;
      case 'maxLength':
        maxLength = Math.min(maxLength ?? Infinity, check.value);
        break;
      case 'length':
        minLength = check.value;
        maxLength = check.value;
        break;
      case 'transform':
        transforms.push(check.apply);
        break;
      case 'format': {
        const namedFormat = NAMED_STRING_FORMATS[check.format];
        if (namedFormat) {
          named = namedFormat();
          break;
        }
        switch (check.format) {
          case 'starts_with':
            prefix += check.value ?? '';
            break;
          case 'ends_with':
            suffix = (check.value ?? '') + suffix;
            break;
          case 'includes':
            infix += check.value ?? '';
            break;
          case 'regex':
            if (!check.pattern) {
              unsupportedCheck('regex', 'string', path);
            }
            pattern = check.pattern;
            break;
          default:
            if (!check.pattern) {
              unsupportedCheck(`string_format:${check.format}`, 'string', path);
            }
            pattern = check.pattern;
        }
        break;
      }
      default:
        unsupportedCheck(check.kind, 'string', path);
    }
  }

  let arbitrary: fc.Arbitrary<string>;
  if (named) {
    arbitrary = named;
  } else if (pattern) {
    arbitrary = fc.stringMatching(pattern);
  } else {
    const fixed = prefix.length + infix.length + suffix.length;
    const innerMax =
      maxLength === undefined || maxLength === Infinity
        ? undefined
        : maxLength - fixed;
    if (innerMax !== undefined && innerMax < 0) {
      unsupported(
        `Zod string at '${path}' declares a maxLength shorter than its required substrings.`
      );
    }
    arbitrary = fc
      .string({
        minLength: Math.max(0, (minLength ?? 0) - fixed),
        ...(innerMax === undefined ? {} : { maxLength: innerMax })
      })
      .map((value) => prefix + infix + value + suffix);
  }

  if (transforms.length) {
    arbitrary = arbitrary.map((value) =>
      transforms.reduce((result, transform) => transform(result), value)
    );
  }

  const constrained =
    minLength !== undefined ||
    (maxLength !== undefined && maxLength !== Infinity);
  if (constrained && (named || pattern || transforms.length)) {
    // The base generator does not honor the length bounds on its own.
    arbitrary = arbitrary.filter(
      (value) =>
        value.length >= (minLength ?? 0) &&
        value.length <= (maxLength ?? Infinity)
    );
  }

  return arbitrary;
}

function fromZod(schema: unknown, path: string): fc.Arbitrary<unknown> {
  const def = getZodDef(schema);
  if (!def) {
    unsupported(`Expected a Zod schema at '${path}'.`);
  }
  const kind = getZodKind(def);
  switch (kind) {
    case 'string':
      return zodStringArbitrary(def, kind, path);
    case 'number':
    case 'int':
      return zodNumberArbitrary(def, kind, path);
    case 'bigint':
      return zodBigIntArbitrary(def, kind, path);
    case 'boolean':
      return fc.boolean();
    case 'date':
      return zodDateArbitrary(def, kind, path);
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
    case 'array': {
      const bounds = zodLegacySizeBounds(
        def,
        zodSizeBounds(getZodChecks(def, kind, path), path)
      );
      return fc.array(fromZod(def.element ?? def.type, `${path}[]`), bounds);
    }
    case 'set': {
      const bounds = zodLegacySizeBounds(
        def,
        zodSizeBounds(getZodChecks(def, kind, path), path)
      );
      return fc
        .uniqueArray(fromZod(def.valueType, `${path}[]`), bounds)
        .map((values) => new Set(values));
    }
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

/**
 * `types<...>()` declares a payload's TypeScript type and nothing else, so no
 * generator can be derived from it. Implicit derivation skips these; explicit
 * `eventsFromSchemas()` still reports them.
 *
 * @internal
 */
export function isTypeOnlySchema(schema: unknown): boolean {
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
      `Effect Schema found at '${path}'. Import \`eventsFromSchemas\` from '@xstate/test/effect-schema' to generate from Effect Schemas.`
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
