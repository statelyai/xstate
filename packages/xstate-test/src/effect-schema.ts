import * as Schema from 'effect/Schema';
import * as SchemaAST from 'effect/SchemaAST';
import * as fc from 'fast-check';
import type { AnyStateMachine } from 'xstate';
import {
  eventsFromSchemas as baseEventsFromSchemas,
  type EventsFromSchemasOptions,
  type SchemaConverter
} from './schema.ts';

/**
 * Options for converting Effect Schemas to fast-check arbitraries.
 *
 * @experimental
 */
export interface FromEffectSchemaOptions {
  /**
   * Returns an arbitrary for an AST node, or `undefined` to use the built-in
   * conversion. Called for every node before it is converted, so it can
   * supply generators for nodes the built-in conversion does not support,
   * such as `Schema.Date` or recursive schemas.
   */
  readonly override?: (
    ast: SchemaAST.AST,
    path: string
  ) => fc.Arbitrary<unknown> | undefined;
}

interface ArbitraryConstraints {
  number?: 'integer' | 'finite';
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: boolean;
  exclusiveMaximum?: boolean;
  minLength?: number;
  maxLength?: number;
  patterns?: Array<{ source: string; flags: string }>;
}

type Check = NonNullable<SchemaAST.AST['checks']>[number];

function collectConstraints(
  checks: readonly Check[] | undefined,
  into: ArbitraryConstraints = {}
): ArbitraryConstraints {
  for (const check of checks ?? []) {
    if (check._tag === 'FilterGroup') {
      collectConstraints(check.checks, into);
      continue;
    }
    const constraint = (
      check.annotations as { arbitraryConstraint?: ArbitraryConstraints }
    )?.arbitraryConstraint;
    if (!constraint) {
      continue;
    }
    if (constraint.number === 'integer') {
      into.number = 'integer';
    } else if (constraint.number === 'finite') {
      into.number ??= 'finite';
    }
    if (
      constraint.minimum !== undefined &&
      (into.minimum === undefined || constraint.minimum >= into.minimum)
    ) {
      into.minimum = constraint.minimum;
      into.exclusiveMinimum = !!constraint.exclusiveMinimum;
    }
    if (
      constraint.maximum !== undefined &&
      (into.maximum === undefined || constraint.maximum <= into.maximum)
    ) {
      into.maximum = constraint.maximum;
      into.exclusiveMaximum = !!constraint.exclusiveMaximum;
    }
    if (constraint.minLength !== undefined) {
      into.minLength = Math.max(into.minLength ?? 0, constraint.minLength);
    }
    if (constraint.maxLength !== undefined) {
      into.maxLength = Math.min(
        into.maxLength ?? Number.POSITIVE_INFINITY,
        constraint.maxLength
      );
    }
    if (constraint.patterns) {
      into.patterns = [...(into.patterns ?? []), ...constraint.patterns];
    }
  }
  return into;
}

function passesChecks(
  checks: readonly Check[],
  value: unknown,
  ast: SchemaAST.AST
): boolean {
  return checks.every((check) =>
    check._tag === 'FilterGroup'
      ? passesChecks(check.checks, value, ast)
      : check.run(value, ast, {}) === undefined
  );
}

function numberArbitrary(c: ArbitraryConstraints): fc.Arbitrary<number> {
  if (c.number === 'integer') {
    let min =
      c.minimum === undefined
        ? Number.MIN_SAFE_INTEGER
        : Math.max(Number.MIN_SAFE_INTEGER, Math.ceil(c.minimum));
    let max =
      c.maximum === undefined
        ? Number.MAX_SAFE_INTEGER
        : Math.min(Number.MAX_SAFE_INTEGER, Math.floor(c.maximum));
    if (c.exclusiveMinimum && min === c.minimum) min++;
    if (c.exclusiveMaximum && max === c.maximum) max--;
    return fc.integer({ min, max });
  }
  const bounded = c.minimum !== undefined || c.maximum !== undefined;
  return fc.double({
    ...(c.minimum !== undefined && {
      min: c.minimum,
      minExcluded: !!c.exclusiveMinimum
    }),
    ...(c.maximum !== undefined && {
      max: c.maximum,
      maxExcluded: !!c.exclusiveMaximum
    }),
    ...((c.number === 'finite' || bounded) && {
      noNaN: true,
      noDefaultInfinity: true
    })
  });
}

function stringArbitrary(c: ArbitraryConstraints): fc.Arbitrary<string> {
  if (c.patterns?.length) {
    const [first] = c.patterns;
    return fc.stringMatching(new RegExp(first.source, first.flags));
  }
  return fc.string({
    ...(c.minLength !== undefined && { minLength: c.minLength }),
    ...(c.maxLength !== undefined &&
      Number.isFinite(c.maxLength) && { maxLength: c.maxLength })
  });
}

function unsupportedNode(ast: SchemaAST.AST, path: string): never {
  throw new Error(
    `Cannot derive a fast-check arbitrary from the Effect Schema AST node '${ast._tag}' at '${path || '(root)'}'. ` +
      'Pass an `override` to `fromEffectSchema()` that returns an arbitrary for this node, or configure the event with an explicit generator in `events`.'
  );
}

function fromAST(
  ast: SchemaAST.AST,
  path: string,
  options: FromEffectSchemaOptions
): fc.Arbitrary<unknown> {
  const overridden = options.override?.(ast, path);
  if (overridden) {
    return overridden;
  }
  const constraints = collectConstraints(ast.checks);
  const base = fromNode(ast, path, constraints, options);
  const checks = ast.checks;
  return checks
    ? base.filter((value) => passesChecks(checks, value, ast))
    : base;
}

function fromNode(
  ast: SchemaAST.AST,
  path: string,
  constraints: ArbitraryConstraints,
  options: FromEffectSchemaOptions
): fc.Arbitrary<unknown> {
  switch (ast._tag) {
    case 'Null':
      return fc.constant(null);
    case 'Undefined':
    case 'Void':
      return fc.constant(undefined);
    case 'Unknown':
    case 'Any':
      return fc.anything();
    case 'String':
      return stringArbitrary(constraints);
    case 'Number':
      return numberArbitrary(constraints);
    case 'Boolean':
      return fc.boolean();
    case 'BigInt':
      return fc.bigInt();
    case 'Symbol':
      return fc.string().map((description) => Symbol(description));
    case 'UniqueSymbol':
      return fc.constant(ast.symbol);
    case 'Literal':
      return fc.constant(ast.literal);
    case 'Enum':
      return fc.constantFrom(...ast.enums.map(([, value]) => value));
    case 'ObjectKeyword':
      return fc.object();
    case 'Union':
      return fc.oneof(
        ...ast.types.map((member, index) =>
          fromAST(member, `${path}|${index}`, options)
        )
      );
    case 'Arrays':
      return fromArrays(ast, path, constraints, options);
    case 'Objects':
      return fromObjects(ast, path, options);
    default:
      return unsupportedNode(ast, path);
  }
}

function fromArrays(
  ast: SchemaAST.Arrays,
  path: string,
  constraints: ArbitraryConstraints,
  options: FromEffectSchemaOptions
): fc.Arbitrary<unknown[]> {
  const elements = ast.elements.map((element, index) =>
    fromAST(element, `${path}[${index}]`, options)
  );
  const firstOptional = ast.elements.findIndex((element) =>
    SchemaAST.isOptional(element)
  );
  const required = firstOptional === -1 ? elements.length : firstOptional;
  // Optional elements are present as a prefix: `[a, b?, c?]` generates
  // `[a]`, `[a, b]` or `[a, b, c]`. Shrinking drops them first.
  const head: fc.Arbitrary<unknown[]> =
    required === elements.length
      ? fc.tuple(...elements)
      : fc
          .tuple(
            fc.integer({ min: required, max: elements.length }),
            fc.tuple(...elements)
          )
          .map(([length, values]) => values.slice(0, length));
  if (!ast.rest.length) {
    return head;
  }
  const [variadic, ...trailing] = ast.rest;
  const minLength = Math.max(
    0,
    (constraints.minLength ?? 0) - elements.length - trailing.length
  );
  const maxLength =
    constraints.maxLength !== undefined &&
    Number.isFinite(constraints.maxLength)
      ? Math.max(
          minLength,
          constraints.maxLength - elements.length - trailing.length
        )
      : undefined;
  const middle = fc.array(fromAST(variadic, `${path}[]`, options), {
    minLength,
    ...(maxLength !== undefined && { maxLength })
  });
  const tail = fc.tuple(
    ...trailing.map((element, index) =>
      fromAST(element, `${path}[-${trailing.length - index}]`, options)
    )
  );
  // Rest elements follow only when every optional element is present.
  return fc
    .tuple(head, middle, tail)
    .map(([h, m, t]) => (h.length < elements.length ? h : [...h, ...m, ...t]));
}

function fromObjects(
  ast: SchemaAST.Objects,
  path: string,
  options: FromEffectSchemaOptions
): fc.Arbitrary<Record<PropertyKey, unknown>> {
  const record: Record<PropertyKey, fc.Arbitrary<unknown>> = {};
  const requiredKeys: PropertyKey[] = [];
  for (const property of ast.propertySignatures) {
    const key = property.name;
    record[key as string] = fromAST(
      property.type,
      `${path}.${String(key)}`,
      options
    );
    if (!SchemaAST.isOptional(property.type)) {
      requiredKeys.push(key);
    }
  }
  const properties = fc.record(record, {
    requiredKeys: requiredKeys as string[]
  });
  if (!ast.indexSignatures.length) {
    return properties;
  }
  const indexes = ast.indexSignatures.map((signature) => {
    if (signature.parameter._tag !== 'String') {
      return unsupportedNode(signature.parameter, `${path}[key]`);
    }
    return fc.dictionary(
      fromAST(
        signature.parameter,
        `${path}[key]`,
        options
      ) as fc.Arbitrary<string>,
      fromAST(signature.type, `${path}[string]`, options)
    );
  });
  return fc
    .tuple(properties, ...indexes)
    .map(([props, ...dictionaries]) =>
      Object.assign({}, ...dictionaries, props)
    );
}

function effectConverter(options: FromEffectSchemaOptions): SchemaConverter {
  return (schema) =>
    schema !== null &&
    (typeof schema === 'object' || typeof schema === 'function') &&
    SchemaAST.isAST((schema as { ast?: unknown }).ast)
      ? (fromEffectSchema(
          schema as Schema.Top,
          options
        ) as fc.Arbitrary<unknown>)
      : undefined;
}

/**
 * Converts an Effect Schema into a native fast-check arbitrary for the
 * schema's type (decoded) side. Refinements are honored: known checks such as
 * `isInt`, `isGreaterThan` and `isMinLength` narrow the generator, and every
 * check also filters the generated values. Counterexamples shrink with
 * fast-check's built-in shrinking.
 *
 * Supported AST nodes: `Null`, `Undefined`, `Void`, `Unknown`, `Any`,
 * `String`, `Number`, `Boolean`, `BigInt`, `Symbol`, `UniqueSymbol`,
 * `Literal`, `Enum`, `ObjectKeyword`, `Union`, `Arrays` (arrays and tuples,
 * with optional and rest elements), and `Objects` (structs with optional
 * properties, and records with string keys). Other nodes throw unless
 * `options.override` returns an arbitrary for them.
 *
 * @experimental
 */
export function fromEffectSchema<TSchema extends Schema.Top>(
  schema: TSchema,
  options: FromEffectSchemaOptions = {}
): fc.Arbitrary<TSchema['Type']> {
  return fromAST(SchemaAST.toType(schema.ast), '', options) as fc.Arbitrary<
    TSchema['Type']
  >;
}

/**
 * Converts a keyed payload-schema map for use by `propertyTest()`.
 *
 * @experimental
 */
export function fromEffectSchemas<
  TSchemas extends Readonly<Record<string, Schema.Top>>
>(
  schemas: TSchemas,
  options: FromEffectSchemaOptions = {}
): {
  [TKey in keyof TSchemas]: fc.Arbitrary<TSchemas[TKey]['Type']>;
} {
  return Object.fromEntries(
    Object.entries(schemas).map(([key, schema]) => [
      key,
      fromEffectSchema(schema, options)
    ])
  ) as {
    [TKey in keyof TSchemas]: fc.Arbitrary<TSchemas[TKey]['Type']>;
  };
}

/**
 * Same as `eventsFromSchemas` from `@xstate/test`, with Effect Schema
 * support registered.
 *
 * @experimental
 */
export function eventsFromSchemas<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options: EventsFromSchemasOptions & FromEffectSchemaOptions = {}
): ReturnType<typeof baseEventsFromSchemas<TMachine>> {
  return baseEventsFromSchemas(machine, {
    ...options,
    converters: [effectConverter(options), ...(options.converters ?? [])]
  });
}
