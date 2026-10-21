import * as Schema from 'effect/Schema';
import * as fc from 'fast-check';
import { fromEffectSchema, fromEffectSchemas } from '../src/effect-schema.ts';

describe('Effect Schema adapter', () => {
  it('returns native FastCheck arbitraries that honor refinements', () => {
    const positive = Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)));
    const derived = fromEffectSchema(positive);

    expect(fc.sample(derived, { seed: 1, numRuns: 20 })).toEqual(
      expect.arrayContaining([expect.any(Number)])
    );
    expect(
      fc
        .sample(derived, { seed: 1, numRuns: 20 })
        .every((value) => Number.isInteger(value) && value > 0)
    ).toBe(true);
  });

  it('converts keyed payload schemas', () => {
    const events = fromEffectSchemas({
      INC: Schema.Struct({ value: Schema.Int }),
      RESET: Schema.Struct({})
    });

    expect(fc.sample(events.INC, 1)[0]).toEqual({
      value: expect.any(Number)
    });
    expect(fc.sample(events.RESET, 1)[0]).toEqual({});
  });
});

describe('Effect Schema AST conversion', () => {
  const sample = <T>(schema: Schema.Top, numRuns = 50) =>
    fc.sample(fromEffectSchema(schema), { seed: 1, numRuns }) as T[];
  const valid = (schema: Schema.Top, values: unknown[]) =>
    values.every((value) => Schema.is(schema as any)(value));

  it.each([
    ['Null', Schema.Null],
    ['Undefined', Schema.Undefined],
    ['Void', Schema.Void],
    ['Unknown', Schema.Unknown],
    ['Any', Schema.Any],
    ['String', Schema.String],
    ['Number', Schema.Number],
    ['Boolean', Schema.Boolean],
    ['BigInt', Schema.BigInt],
    ['Symbol', Schema.Symbol],
    ['UniqueSymbol', Schema.UniqueSymbol(Symbol.for('xstate.test'))],
    ['Literal', Schema.Literal('on')],
    ['Literals', Schema.Literals(['a', 'b', 1])],
    ['Enum', Schema.Enum({ A: 'a', B: 2 })],
    ['ObjectKeyword', Schema.ObjectKeyword],
    ['Union', Schema.Union([Schema.String, Schema.Number])],
    ['Array', Schema.Array(Schema.Boolean)],
    ['Tuple', Schema.Tuple([Schema.String, Schema.optionalKey(Schema.Number)])],
    [
      'TupleWithRest',
      Schema.TupleWithRest(Schema.Tuple([Schema.String]), [
        Schema.Number,
        Schema.Boolean
      ])
    ],
    [
      'Struct',
      Schema.Struct({
        a: Schema.String,
        b: Schema.optional(Schema.Number),
        c: Schema.optionalKey(Schema.Boolean)
      })
    ],
    ['Record', Schema.Record(Schema.String, Schema.Number)],
    [
      'StructWithRest',
      Schema.StructWithRest(Schema.Struct({ id: Schema.String }), [
        Schema.Record(Schema.String, Schema.String)
      ])
    ],
    [
      'Int range',
      Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 3 }))
    ],
    [
      'exclusive',
      Schema.Number.check(Schema.isGreaterThan(0), Schema.isLessThan(1))
    ],
    ['Finite', Schema.Finite],
    [
      'string length',
      Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(4))
    ],
    ['pattern', Schema.String.check(Schema.isPattern(/^a+b$/))],
    [
      'array length',
      Schema.Array(Schema.Number).check(
        Schema.isMinLength(2),
        Schema.isMaxLength(3)
      )
    ],
    [
      'custom filter',
      Schema.Int.check(Schema.makeFilter((n: number) => n % 2 === 0))
    ],
    ['transformation (type side)', Schema.NumberFromString]
  ] as const)('generates valid %s values', (_name, schema) => {
    expect(valid(schema, sample(schema))).toBe(true);
  });

  it('omits optional struct keys', () => {
    const values = sample<Record<string, unknown>>(
      Schema.Struct({ a: Schema.optionalKey(Schema.Number) }),
      100
    );
    expect(values.some((value) => !('a' in value))).toBe(true);
    expect(values.some((value) => 'a' in value)).toBe(true);
  });

  it('generates the type side of transformations', () => {
    expect(
      sample(Schema.NumberFromString).every(
        (value) => typeof value === 'number'
      )
    ).toBe(true);
  });

  it('shrinks a failing property to the minimal counterexample', () => {
    const schema = Schema.Struct({
      count: Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 1000 })),
      tags: Schema.Array(Schema.String)
    });
    const result = fc.check(
      fc.property(fromEffectSchema(schema), (value) => value.count < 10),
      { seed: 1 }
    );
    expect(result.failed).toBe(true);
    expect(result.counterexample).toEqual([{ count: 10, tags: [] }]);
  });

  it('names unsupported AST nodes and suggests an override', () => {
    expect(() =>
      fromEffectSchema(Schema.Struct({ at: Schema.Date }))
    ).toThrowError(/'Declaration' at '\.at'.*override/);
  });

  it('uses an override for nodes it does not support', () => {
    const derived = fromEffectSchema(Schema.Struct({ at: Schema.Date }), {
      override: (ast) =>
        ast._tag === 'Declaration'
          ? fc.date({ noInvalidDate: true })
          : undefined
    });
    expect(fc.sample(derived, 1)[0].at).toBeInstanceOf(Date);
  });
});
