import * as fc from 'fast-check';
import type { AnyStateMachine, EventFrom, SnapshotFrom } from 'xstate';
import type { TestEventGenerators } from 'xstate/graph';
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
   * declared schema, under either their own key or a matching wildcard key
   * (`'user.*'`).
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

function unsatisfiable(path: string, reason: string): never {
  return unsupported(
    `Unsatisfiable Zod schema at '${path}': ${reason}. Pass an explicit generator for this payload.`
  );
}

const MAX_FILTER_ATTEMPTS = 1000;

/**
 * Like `.filter()`, but throws after `MAX_FILTER_ATTEMPTS` consecutive
 * rejections instead of looping forever. Shrinking filters without a limit.
 */
class BoundedFilterArbitrary<T> extends fc.Arbitrary<T> {
  private readonly arbitrary: fc.Arbitrary<T>;
  private readonly predicate: (value: T) => boolean;
  private readonly description: string;
  private readonly path: string;

  constructor(
    arbitrary: fc.Arbitrary<T>,
    predicate: (value: T) => boolean,
    description: string,
    path: string
  ) {
    super();
    this.arbitrary = arbitrary;
    this.predicate = predicate;
    this.description = description;
    this.path = path;
  }

  generate(mrng: fc.Random, biasFactor: number | undefined): fc.Value<T> {
    for (let attempt = 0; attempt < MAX_FILTER_ATTEMPTS; attempt++) {
      const generated = this.arbitrary.generate(mrng, biasFactor);
      if (this.predicate(generated.value)) {
        return generated;
      }
    }
    return unsupported(
      `Could not generate a value satisfying ${this.description} at '${this.path}' after ${MAX_FILTER_ATTEMPTS} attempts. Pass an explicit generator for this payload.`
    );
  }

  canShrinkWithoutContext(value: unknown): value is T {
    return (
      this.arbitrary.canShrinkWithoutContext(value) && this.predicate(value)
    );
  }

  shrink(value: T, context: unknown): fc.Stream<fc.Value<T>> {
    return this.arbitrary
      .shrink(value, context)
      .filter((shrunk) => this.predicate(shrunk.value));
  }
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
  multipleOf: number[];
}

function zodNumericBounds(
  checks: readonly ZodCheck[],
  kind: string,
  path: string
): NumericBounds {
  const bounds: NumericBounds = {
    minExcluded: false,
    maxExcluded: false,
    int: false,
    multipleOf: []
  };
  for (const check of checks) {
    switch (check.kind) {
      case 'min': {
        const value = toNumber(check.value);
        if (bounds.min === undefined || value > bounds.min) {
          bounds.min = value;
          bounds.minExcluded = !check.inclusive;
        } else if (value === bounds.min && !check.inclusive) {
          // On a tie, the exclusive bound wins.
          bounds.minExcluded = true;
        }
        break;
      }
      case 'max': {
        const value = toNumber(check.value);
        if (bounds.max === undefined || value < bounds.max) {
          bounds.max = value;
          bounds.maxExcluded = !check.inclusive;
        } else if (value === bounds.max && !check.inclusive) {
          bounds.maxExcluded = true;
        }
        break;
      }
      case 'int':
        bounds.int = true;
        break;
      case 'multipleOf':
        bounds.multipleOf.push(toNumber(check.value));
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

function gcd(a: bigint, b: bigint): bigint {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

type Fraction = readonly [numerator: bigint, denominator: bigint];

/** Reads a finite, non-zero number as the exact fraction of its decimal form. */
function toFraction(value: number): Fraction | undefined {
  if (!Number.isFinite(value) || value === 0) {
    return undefined;
  }
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(
    String(Math.abs(value))
  );
  if (!match) {
    return undefined;
  }
  const [, whole, decimals = '', exponent = '0'] = match;
  const scale = Number(exponent) - decimals.length;
  const numerator =
    BigInt(whole + decimals) * (scale > 0 ? 10n ** BigInt(scale) : 1n);
  const denominator = scale < 0 ? 10n ** BigInt(-scale) : 1n;
  const divisor = gcd(numerator, denominator);
  return [numerator / divisor, denominator / divisor];
}

/**
 * Combines every `multipleOf` step (and `int`, a step of 1) into their least
 * common multiple, as an exact fraction.
 */
function combinedStep(bounds: NumericBounds, path: string): Fraction {
  const steps = bounds.int ? [...bounds.multipleOf, 1] : bounds.multipleOf;
  let result: Fraction | undefined;
  for (const step of steps) {
    const fraction = toFraction(step);
    if (!fraction) {
      return unsupported(
        `Unsupported Zod multipleOf(${step}) on number at '${path}'. Pass an explicit generator for this payload.`
      );
    }
    if (!result) {
      result = fraction;
      continue;
    }
    const [a, b] = result;
    const [c, d] = fraction;
    result = [(a / gcd(a, c)) * c, gcd(b, d)];
  }
  if (
    !result ||
    result[0] > BigInt(Number.MAX_SAFE_INTEGER) ||
    result[1] > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    return unsupported(
      `Unsupported Zod multipleOf combination (${steps.join(', ')}) on number at '${path}': no common multiple can be generated exactly. Pass an explicit generator for this payload.`
    );
  }
  return result;
}

function zodMultipleOfArbitrary(
  bounds: NumericBounds,
  path: string
): fc.Arbitrary<number> {
  const [numerator, denominator] = combinedStep(bounds, path).map(Number);
  // `factor * numerator` stays an exact integer, so dividing once yields the
  // double nearest to the true multiple, which Zod's multipleOf accepts.
  const valueOf = (factor: number) => (factor * numerator) / denominator;
  const step = numerator / denominator;
  const limit = Math.min(
    INT_SPAN,
    Math.floor(Number.MAX_SAFE_INTEGER / numerator)
  );
  const aboveMin = (value: number) =>
    bounds.min === undefined ||
    (bounds.minExcluded ? value > bounds.min : value >= bounds.min);
  const belowMax = (value: number) =>
    bounds.max === undefined ||
    (bounds.maxExcluded ? value < bounds.max : value <= bounds.max);

  let min =
    bounds.min === undefined
      ? -limit
      : Math.max(-limit, Math.ceil(bounds.min / step) - 1);
  let max =
    bounds.max === undefined
      ? limit
      : Math.min(limit, Math.floor(bounds.max / step) + 1);
  while (min <= max && !aboveMin(valueOf(min))) {
    min++;
  }
  while (max >= min && !belowMax(valueOf(max))) {
    max--;
  }
  if (min > max) {
    unsupported(
      `Zod number at '${path}' declares a multipleOf that no value in its range satisfies.`
    );
  }
  return fc.integer({ min, max }).map(valueOf);
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

  if (bounds.multipleOf.length) {
    return zodMultipleOfArbitrary(bounds, path);
  }

  if (bounds.int) {
    const { min, max } = integerRange(bounds);
    if (min > max) {
      unsupported(`Zod number at '${path}' declares an empty integer range.`);
    }
    return fc.integer({ min, max });
  }

  // `-0` is below an exclusive `0` bound in fast-check's ordering, but Zod
  // rejects it for `.lt(0)`/`.negative()`, so step past it.
  if (bounds.max === 0 && bounds.maxExcluded) {
    bounds.max = -Number.MIN_VALUE;
    bounds.maxExcluded = false;
  }
  if (bounds.min === 0 && bounds.minExcluded) {
    bounds.min = Number.MIN_VALUE;
    bounds.minExcluded = false;
  }
  if (
    bounds.min !== undefined &&
    bounds.max !== undefined &&
    (bounds.min > bounds.max ||
      (bounds.min === bounds.max && (bounds.minExcluded || bounds.maxExcluded)))
  ) {
    unsatisfiable(path, 'the numeric range is empty');
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
  if (min !== undefined && max !== undefined && min > max) {
    unsatisfiable(path, 'the bigint range is empty');
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
  if (min !== undefined && max !== undefined && min > max) {
    unsatisfiable(path, 'the date range is empty');
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

const EMAIL_SUFFIX = '.co';
/** `a@b.co`, the shortest address Zod accepts. */
const EMAIL_MIN_LENGTH = 6;

/**
 * `fc.emailAddress()` covers RFC 5322, which is wider than the address Zod
 * accepts, so a conservative address within the length bounds is generated
 * instead.
 */
function emailArbitrary(
  minLength: number,
  maxLength: number
): fc.Arbitrary<string> | undefined {
  const fixed = '@'.length + EMAIL_SUFFIX.length;
  const min = Math.max(2, minLength - fixed);
  const max = Math.min(Math.max(20, min), maxLength - fixed);
  if (min > max) {
    return undefined;
  }
  const part = (length: number) =>
    fc.string({ unit: ALPHANUMERIC, minLength: length, maxLength: length });
  return fc
    .integer({ min, max })
    .chain((total) =>
      fc
        .integer({ min: 1, max: total - 1 })
        .chain((local) => fc.tuple(part(local), part(total - local)))
    )
    .map(([local, domain]) => `${local}@${domain}${EMAIL_SUFFIX}`);
}

const UUID_LENGTH = 36;

/** The generator for a named format or pattern, honoring length bounds. */
function stringFormatArbitrary(
  check: { readonly format: string; readonly pattern?: RegExp },
  minLength: number,
  maxLength: number,
  path: string
): fc.Arbitrary<string> {
  switch (check.format) {
    case 'email': {
      const arbitrary = emailArbitrary(minLength, maxLength);
      if (!arbitrary) {
        unsatisfiable(
          path,
          `an email address has at least ${EMAIL_MIN_LENGTH} characters, outside the length bounds ${minLength}..${maxLength}`
        );
      }
      return arbitrary;
    }
    case 'uuid':
    case 'guid':
      if (minLength > UUID_LENGTH || maxLength < UUID_LENGTH) {
        unsatisfiable(
          path,
          `a ${check.format} has ${UUID_LENGTH} characters, outside the length bounds ${minLength}..${maxLength}`
        );
      }
      // Zod v4 carries a version-specific pattern (`z.uuidv7()`).
      return check.pattern ? fc.stringMatching(check.pattern) : fc.uuid();
    case 'url':
      return fc.webUrl();
    default:
      if (!check.pattern) {
        return unsupportedCheck(
          check.format === 'regex' ? 'regex' : `string_format:${check.format}`,
          'string',
          path
        );
      }
      return fc.stringMatching(check.pattern);
  }
}

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
  const formats: { readonly format: string; readonly pattern?: RegExp }[] = [];
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
      case 'format':
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
          default:
            formats.push(check);
        }
        break;
      default:
        unsupportedCheck(check.kind, 'string', path);
    }
  }

  if (
    minLength !== undefined &&
    maxLength !== undefined &&
    minLength > maxLength
  ) {
    unsatisfiable(
      path,
      `the minimum length ${minLength} exceeds the maximum length ${maxLength}`
    );
  }
  if (formats.length > 1) {
    unsupported(
      `Unsupported combination of Zod string formats ${formats
        .map((check) => `'${check.format}'`)
        .join(
          ' and '
        )} at '${path}'. Pass an explicit generator for this payload.`
    );
  }
  const format = formats[0];
  if (format && (prefix || suffix || infix)) {
    unsupported(
      `Unsupported combination of Zod string format '${format.format}' with startsWith/endsWith/includes at '${path}'. Pass an explicit generator for this payload.`
    );
  }

  let arbitrary: fc.Arbitrary<string>;
  if (format) {
    arbitrary = stringFormatArbitrary(
      format,
      minLength ?? 0,
      maxLength ?? Infinity,
      path
    );
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
  if (constrained && (format || transforms.length)) {
    // The base generator does not honor the length bounds on its own.
    arbitrary = new BoundedFilterArbitrary(
      arbitrary,
      (value) =>
        value.length >= (minLength ?? 0) &&
        value.length <= (maxLength ?? Infinity),
      `the length bounds ${minLength ?? 0}..${maxLength ?? Infinity}`,
      path
    );
  }

  return arbitrary;
}

/**
 * The values of an enum, without the reverse mappings (`{ 0: 'A' }`) that
 * TypeScript adds to numeric enums.
 */
function zodEnumValues(def: ZodDef): unknown[] {
  if (Array.isArray(def.values)) {
    return def.values as unknown[];
  }
  const entries = (def.entries ?? def.values ?? {}) as Record<string, unknown>;
  return Object.entries(entries)
    .filter(
      ([key, value]) =>
        !(
          typeof value === 'string' &&
          String(Number(key)) === key &&
          entries[value] === Number(key)
        )
    )
    .map(([, value]) => value);
}

function zodLiteralValues(def: ZodDef): unknown[] {
  return Array.isArray(def.values) ? (def.values as unknown[]) : [def.value];
}

/** An upper bound on the number of distinct values a schema accepts. */
function zodDomainSize(schema: unknown): number {
  const def = getZodDef(schema);
  if (!def) {
    return Infinity;
  }
  switch (getZodKind(def)) {
    case 'literal':
      return zodLiteralValues(def).length;
    case 'enum':
    case 'nativeenum':
      return zodEnumValues(def).length;
    case 'boolean':
      return 2;
    case 'null':
    case 'undefined':
    case 'void':
      return 1;
    case 'union':
      return ((def.options ?? []) as unknown[]).reduce<number>(
        (size, option) => size + zodDomainSize(option),
        0
      );
    case 'optional':
    case 'nullable':
      return zodDomainSize(def.innerType) + 1;
    case 'default':
    case 'prefault':
    case 'catch':
    case 'readonly':
    case 'nonoptional':
      return zodDomainSize(def.innerType);
    default:
      return Infinity;
  }
}

function checkSizeBounds(bounds: SizeBounds, path: string): void {
  if (
    bounds.minLength !== undefined &&
    bounds.maxLength !== undefined &&
    bounds.minLength > bounds.maxLength
  ) {
    unsatisfiable(
      path,
      `the minimum size ${bounds.minLength} exceeds the maximum size ${bounds.maxLength}`
    );
  }
}

function isZodExactOptional(schema: unknown): boolean {
  const traits = (schema as { _zod?: { traits?: Set<string> } })._zod?.traits;
  return traits?.has('$ZodExactOptional') === true;
}

/** Zod definitions being converted along the current path, to catch cycles. */
const convertingZodDefs = new Set<ZodDef>();

function fromZod(schema: unknown, path: string): fc.Arbitrary<unknown> {
  const def = getZodDef(schema);
  if (!def) {
    unsupported(`Expected a Zod schema at '${path}'.`);
  }
  if (convertingZodDefs.has(def)) {
    unsupported(
      `Recursive Zod schema at '${path}'. Recursive schemas cannot be derived; pass an explicit generator for this payload.`
    );
  }
  convertingZodDefs.add(def);
  try {
    return fromZodDef(schema, def, path);
  } finally {
    convertingZodDefs.delete(def);
  }
}

function fromZodDef(
  schema: unknown,
  def: ZodDef,
  path: string
): fc.Arbitrary<unknown> {
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
      const values = zodLiteralValues(def);
      if (!values.length) {
        unsupported(`Zod literal at '${path}' declares no values.`);
      }
      return fc.constantFrom(...values);
    }
    case 'enum':
    case 'nativeenum': {
      const values = zodEnumValues(def);
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
      checkSizeBounds(bounds, path);
      return fc.array(fromZod(def.element ?? def.type, `${path}[]`), bounds);
    }
    case 'set': {
      const bounds = zodLegacySizeBounds(
        def,
        zodSizeBounds(getZodChecks(def, kind, path), path)
      );
      checkSizeBounds(bounds, path);
      const domainSize = zodDomainSize(def.valueType);
      if ((bounds.minLength ?? 0) > domainSize) {
        unsatisfiable(
          path,
          `the set needs at least ${bounds.minLength} distinct elements, but its element schema accepts only ${domainSize}`
        );
      }
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
    case 'record': {
      // A Zod v4 record whose keys form a finite set (`z.enum()`,
      // `z.literal()`) requires every key; `z.partialRecord()` clears the set.
      const keys = (def.keyType as { _zod?: { values?: Set<unknown> } })?._zod
        ?.values;
      if (keys) {
        const model: Record<string, fc.Arbitrary<unknown>> = {};
        for (const key of keys) {
          if (typeof key !== 'string' && typeof key !== 'number') {
            unsupported(
              `Unsupported Zod record key ${String(key)} at '${path}'. Pass an explicit generator for this payload.`
            );
          }
          model[String(key)] = fromZod(def.valueType, `${path}.${key}`);
        }
        return fc.record(model);
      }
      return fc.dictionary(
        fromZod(def.keyType, `${path}.<key>`) as fc.Arbitrary<string>,
        fromZod(def.valueType, `${path}.<value>`)
      );
    }
    case 'optional':
      // `exactOptional()` accepts a missing key, never an `undefined` value.
      return isZodExactOptional(schema)
        ? fromZod(def.innerType, path)
        : fc.option(fromZod(def.innerType, path), { nil: undefined });
    case 'nullable':
      return fc.option(fromZod(def.innerType, path), { nil: null });
    case 'default':
    case 'prefault':
    case 'catch':
    case 'readonly':
    case 'nonoptional':
      return fromZod(def.innerType, path);
    case 'lazy':
      if (typeof def.getter !== 'function') {
        return unsupported(`Zod lazy schema at '${path}' has no getter.`);
      }
      return fromZod((def.getter as () => unknown)(), path);
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
    `Unrecognized schema at '${path}'. Supported libraries: ${SUPPORTED_LIBRARIES}. Pass a \`fallback\` converter to \`eventsFromSchemas()\` to handle other schemas, or an explicit generator in \`events\`.`
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

/** Mirrors xstate's event descriptor matching (`'user.*'`, `'*'`). */
function matchesEventDescriptor(
  eventType: string,
  descriptor: string
): boolean {
  if (descriptor === eventType || descriptor === '*') {
    return true;
  }
  if (!descriptor.endsWith('.*')) {
    return false;
  }
  const descriptorTokens = descriptor.split('.');
  const eventTokens = eventType.split('.');
  for (let index = 0; index < descriptorTokens.length; index++) {
    if (descriptorTokens[index] === '*') {
      return index === descriptorTokens.length - 1;
    }
    if (descriptorTokens[index] !== eventTokens[index]) {
      return false;
    }
  }
  return true;
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
): TestEventGenerators<
  SnapshotFrom<TMachine>,
  EventFrom<TMachine>,
  FastCheckGeneratorKind
> {
  const schemas = (machine.schemas?.events ?? {}) as Record<string, unknown>;
  const wildcards = Object.keys(schemas).filter((key) => key.includes('*'));
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
    // Like the machine's event validation, the first matching wildcard key
    // supplies the schema.
    const descriptor = wildcards.find((key) =>
      matchesEventDescriptor(eventType, key)
    );
    if (descriptor !== undefined) {
      generators[eventType] = stripType(
        arbitraryFromSchema(schemas[descriptor], options, eventType),
        eventType
      );
    } else if ((options.eventsWithoutSchema ?? 'empty') === 'empty') {
      generators[eventType] = fc.constant({});
    }
  }

  return generators as TestEventGenerators<
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
