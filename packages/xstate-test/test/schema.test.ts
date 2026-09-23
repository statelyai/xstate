import * as fc from 'fast-check';
import * as Schema from 'effect/Schema';
import * as z from 'zod';
import * as z3 from 'zod/v3';
import { createMachine, types } from 'xstate';
import {
  arbitraryFromSchema,
  eventsFromSchemas,
  fastCheckAdapter,
  mergeEventGenerators,
  propertyTest
} from '../src/index.ts';
import { eventsFromSchemas as eventsFromSchemasWithEffect } from '../src/effect-schema.ts';

enum NumericEnum {
  A,
  B
}

enum MixedEnum {
  A = 0,
  B = 'b'
}

const sample = <T>(arbitrary: fc.Arbitrary<T>, numRuns = 20): T[] =>
  fc.sample(arbitrary, { seed: 7, numRuns });

describe('eventsFromSchemas with Zod', () => {
  const zodMachine = createMachine({
    schemas: {
      context: types<{ count: number }>(),
      events: {
        INC: z.object({ value: z.number().int() }),
        SET: z.object({
          label: z.string(),
          mode: z.enum(['a', 'b']),
          tags: z.array(z.string()),
          note: z.string().optional(),
          amount: z.union([z.number(), z.literal('max')])
        })
      }
    },
    context: { count: 0 },
    on: {
      INC: ({ context, event }) => ({
        context: { count: context.count + event.value }
      }),
      SET: () => ({}),
      RESET: () => ({ context: { count: 0 } })
    }
  });

  it('derives generators for each declared event schema', () => {
    const events = eventsFromSchemas(zodMachine);

    expect(Object.keys(events).sort()).toEqual(['INC', 'RESET', 'SET']);

    for (const value of sample(events.INC as fc.Arbitrary<{ value: number }>)) {
      expect(Number.isInteger(value.value)).toBe(true);
      expect(value).not.toHaveProperty('type');
    }

    for (const value of sample(
      events.SET as fc.Arbitrary<Record<string, unknown>>
    )) {
      expect(['a', 'b']).toContain(value.mode);
      expect(typeof value.label).toBe('string');
      expect(Array.isArray(value.tags)).toBe(true);
      expect(typeof value.amount === 'number' || value.amount === 'max').toBe(
        true
      );
    }

    const notes = sample(
      events.SET as fc.Arbitrary<Record<string, unknown>>,
      50
    ).map((value) => 'note' in value);
    expect(notes).toContain(false);
  });

  it('generates empty payloads for events without a schema by default', () => {
    const events = eventsFromSchemas(zodMachine);
    expect(
      sample((events as Record<string, fc.Arbitrary<unknown>>).RESET, 1)[0]
    ).toEqual({});
  });

  it('skips events without a schema when configured', () => {
    const events = eventsFromSchemas(zodMachine, {
      eventsWithoutSchema: 'skip'
    });
    expect(Object.keys(events).sort()).toEqual(['INC', 'SET']);
  });

  it('strips a declared `type` field from generated payloads', () => {
    const machine = createMachine({
      schemas: {
        events: { PING: z.object({ type: z.literal('PING'), id: z.string() }) }
      },
      on: { PING: () => ({}) }
    });

    for (const value of sample(
      eventsFromSchemas(machine).PING as fc.Arbitrary<Record<string, unknown>>
    )) {
      expect(value).not.toHaveProperty('type');
      expect(typeof value.id).toBe('string');
    }
  });

  it('throws a descriptive error for a non-object event payload', () => {
    const machine = createMachine({
      schemas: { events: { PING: z.number() as any } },
      on: { PING: () => ({}) }
    });

    expect(() =>
      sample(
        eventsFromSchemas(machine).PING as fc.Arbitrary<Record<string, unknown>>
      )
    ).toThrowError(/generated a non-object payload/);
  });

  it('supports Zod v3-shaped definitions', () => {
    const v3String = { _def: { typeName: 'ZodString' } };
    const v3Object = {
      _def: {
        typeName: 'ZodObject',
        shape: () => ({
          name: v3String,
          count: { _def: { typeName: 'ZodNumber', checks: [{ kind: 'int' }] } }
        })
      }
    };

    for (const value of sample(
      arbitraryFromSchema(v3Object) as fc.Arbitrary<Record<string, unknown>>
    )) {
      expect(typeof value.name).toBe('string');
      expect(Number.isInteger(value.count)).toBe(true);
    }
  });

  it('reports unsupported kinds with the schema path', () => {
    const machine = createMachine({
      schemas: { events: { GO: z.object({ when: z.promise(z.string()) }) } },
      on: { GO: () => ({}) }
    });

    expect(() => eventsFromSchemas(machine)).toThrowError(/'GO\.when'/);
  });

  it('reports type-only schemas as underivable', () => {
    const machine = createMachine({
      schemas: { events: { GO: types<{ value: number }>() } },
      on: { GO: () => ({}) }
    });

    expect(() => eventsFromSchemas(machine)).toThrowError(/type-only schema/);
  });

  it('uses a fallback converter when provided', () => {
    const machine = createMachine({
      schemas: { events: { GO: types<{ value: number }>() } },
      on: { GO: () => ({}) }
    });

    const events = eventsFromSchemas(machine, {
      fallback: () => fc.constant({ value: 1 })
    });
    expect(sample(events.GO as fc.Arbitrary<unknown>, 1)[0]).toEqual({
      value: 1
    });
  });

  it('merges derived and explicit generators', () => {
    const merged = mergeEventGenerators(eventsFromSchemas(zodMachine), {
      INC: fc.constant({ value: 3 })
    });
    expect(sample(merged.INC as fc.Arbitrary<unknown>, 1)[0]).toEqual({
      value: 3
    });
  });

  it('drives a property test from derived generators', async () => {
    const result = await propertyTest(zodMachine, {
      seed: 1,
      numRuns: 5,
      maxCommands: 3,
      events: mergeEventGenerators(
        eventsFromSchemas(zodMachine, { eventsWithoutSchema: 'skip' }),
        { INC: fc.record({ value: fc.integer({ min: 0, max: 2 }) }) }
      ),
      invariant: ({ snapshot }) => {
        expect(typeof snapshot.context.count).toBe('number');
      }
    });

    expect(result.coverage.runs).toBe(5);
  });
});

describe('eventsFromSchemas with Effect Schema', () => {
  // Effect Schemas do not implement Standard Schema, so the config is cast.
  const effectMachine = createMachine({
    schemas: {
      events: { INC: Schema.Struct({ value: Schema.Int }) }
    },
    on: { INC: () => ({}) }
  } as any);

  it('derives generators from the effect-schema entrypoint', () => {
    const events = eventsFromSchemasWithEffect(effectMachine) as Record<
      string,
      fc.Arbitrary<{ value: number }>
    >;
    for (const value of sample(events.INC)) {
      expect(Number.isInteger(value.value)).toBe(true);
    }
  });

  it('points at the effect-schema entrypoint from the main entrypoint', () => {
    expect(() => eventsFromSchemas(effectMachine)).toThrowError(
      /@xstate\/test\/effect-schema/
    );
  });
});

describe.each([
  ['Zod v4', z],
  ['Zod v3', z3]
])('%s constraints', (_label, Z: any) => {
  const holds = (schema: {
    safeParse(value: unknown): { success: boolean };
  }) => {
    fc.assert(
      fc.property(
        arbitraryFromSchema(schema),
        (value) => schema.safeParse(value).success
      ),
      { numRuns: 200 }
    );
  };

  it.each([
    ['string min', () => Z.string().min(3)],
    ['string min/max', () => Z.string().min(2).max(6)],
    ['string length', () => Z.string().length(4)],
    ['string email', () => Z.string().email()],
    ['string uuid', () => Z.string().uuid()],
    ['string url', () => Z.string().url()],
    ['string regex', () => Z.string().regex(/^[a-f]{2,5}$/)],
    [
      'string startsWith/endsWith/includes',
      () => Z.string().startsWith('ab').endsWith('yz').includes('m')
    ],
    ['string trim + min', () => Z.string().trim().min(1)],
    ['string toLowerCase', () => Z.string().toLowerCase()],
    ['number int range', () => Z.number().int().min(1).max(5)],
    ['number exclusive range', () => Z.number().gt(1).lt(5)],
    ['number multipleOf', () => Z.number().multipleOf(3).min(3).max(30)],
    ['number int multipleOf', () => Z.number().int().multipleOf(5)],
    ['number finite', () => Z.number().finite()],
    ['number nonnegative', () => Z.number().nonnegative()],
    ['array min/max', () => Z.array(Z.number()).min(2).max(4)],
    ['array length', () => Z.array(Z.string()).length(3)],
    ['set min/max', () => Z.set(Z.number().int()).min(1).max(3)],
    ['bigint min/max', () => Z.bigint().min(1n).max(5n)],
    ['date min/max', () => Z.date().min(new Date(0)).max(new Date(100000))],
    [
      'object of constrained fields',
      () =>
        Z.object({
          sku: Z.string().min(1),
          qty: Z.number().int().min(1).max(5)
        })
    ],
    [
      'numeric enum',
      () => (Z === z ? z.enum(NumericEnum) : z3.nativeEnum(NumericEnum))
    ],
    [
      'mixed enum',
      () => (Z === z ? z.enum(MixedEnum) : z3.nativeEnum(MixedEnum))
    ],
    ['record with enum keys', () => Z.record(Z.enum(['a', 'b']), Z.number())],
    ['number gt(0).min(0)', () => Z.number().gt(0).min(0)],
    ['number min(0).gt(0)', () => Z.number().min(0).gt(0)],
    ['number lt(0).max(0)', () => Z.number().lt(0).max(0)],
    ['number negative', () => Z.number().negative()],
    ['number lt(0)', () => Z.number().lt(0)],
    ['number positive', () => Z.number().positive()],
    ['number nonpositive', () => Z.number().nonpositive()],
    ['number int multipleOf(0.5)', () => Z.number().int().multipleOf(0.5)],
    [
      'number multipleOf(2).multipleOf(3)',
      () => Z.number().multipleOf(2).multipleOf(3)
    ],
    [
      'number multipleOf(0.25).multipleOf(0.1)',
      () => Z.number().multipleOf(0.25).multipleOf(0.1)
    ],
    ['number multipleOf(0.1)', () => Z.number().multipleOf(0.1)],
    [
      'number multipleOf(0.1) range',
      () => Z.number().multipleOf(0.1).gt(0.3).lte(0.7)
    ],
    ['number multipleOf(0.01)', () => Z.number().multipleOf(0.01)],
    ['string email max', () => Z.string().email().max(10)],
    ['string email min', () => Z.string().email().min(24)],
    ['string uuid length', () => Z.string().uuid().length(36)],
    [
      'string regex max',
      () =>
        Z.string()
          .regex(/^[a-f]{2,8}$/)
          .max(4)
    ],
    ['string url max', () => Z.string().url().max(40)],
    ['set of enum at capacity', () => Z.set(Z.enum(['a', 'b'])).min(2)],
    ['lazy', () => Z.object({ name: Z.lazy(() => Z.string().min(1)) })]
  ])('generates values satisfying %s', (_name, build) => {
    holds(build());
  });

  it('generates only real numeric enum values', () => {
    const schema = Z === z ? z.enum(NumericEnum) : z3.nativeEnum(NumericEnum);
    expect(new Set(sample(arbitraryFromSchema(schema), 100))).toEqual(
      new Set([NumericEnum.A, NumericEnum.B])
    );
  });

  it('never generates -0 below an exclusive 0 bound', () => {
    for (const value of sample(
      arbitraryFromSchema(Z.number().negative()),
      500
    )) {
      expect(Object.is(value, -0)).toBe(false);
    }
  });

  it.each([
    ['email with startsWith', () => Z.string().email().startsWith('ab')],
    [
      'regex with endsWith',
      () =>
        Z.string()
          .regex(/^[a-z]+$/)
          .endsWith('z')
    ],
    ['two formats', () => Z.string().email().uuid()]
  ])('rejects %s, naming the path', (_name, build) => {
    expect(() => arbitraryFromSchema(build(), {}, 'evt.field')).toThrowError(
      /Unsupported combination .* at 'evt\.field'/
    );
  });

  it.each<[string, () => any]>([
    ['email shorter than any address', () => Z.string().email().max(5)],
    ['uuid of the wrong length', () => Z.string().uuid().max(10)],
    ['set larger than its literal domain', () => Z.set(Z.literal('a')).min(2)],
    [
      'set larger than its union domain',
      () => Z.set(Z.union([Z.boolean(), Z.null()])).min(4)
    ],
    // Zod v4 rejects `.min(5).max(2)` on a string when it is declared.
    ...(Z === z3
      ? [
          ['string min above max', () => Z.string().min(5).max(2)] as [
            string,
            () => any
          ]
        ]
      : []),
    ['array min above max', () => Z.array(Z.number()).min(5).max(2)],
    ['empty number range', () => Z.number().gt(1).lt(1)],
    ['empty bigint range', () => Z.bigint().min(5n).max(1n)],
    ['empty date range', () => Z.date().min(new Date(10)).max(new Date(0))],
    ['nonpositive and positive', () => Z.number().positive().max(0)]
  ])(
    'reports an unsatisfiable %s, naming the path',
    (_name, build) => {
      expect(() =>
        sample(arbitraryFromSchema(build(), {}, 'evt.field'), 5)
      ).toThrowError(/Unsatisfiable Zod schema at 'evt\.field'/);
    },
    5000
  );

  it('bounds filters instead of hanging', () => {
    expect(() =>
      sample(
        arbitraryFromSchema(Z.string().regex(/^a+$/).min(200), {}, 'evt.field'),
        5
      )
    ).toThrowError(
      /Could not generate a value satisfying .* at 'evt\.field' after 1000 attempts/
    );
  }, 5000);

  it('reports a recursive lazy schema, naming the path', () => {
    const node: any = Z.object({
      name: Z.string(),
      children: Z.lazy(() => Z.array(node))
    });
    expect(() => arbitraryFromSchema(node, {}, 'evt')).toThrowError(
      /Recursive Zod schema at 'evt\.children\[\]'/
    );
  });
});

describe('Zod v4-only schemas', () => {
  const holds = (schema: z.ZodType) => {
    fc.assert(
      fc.property(
        arbitraryFromSchema(schema),
        (value) => schema.safeParse(value).success
      ),
      { numRuns: 200 }
    );
  };

  it.each([
    ['partialRecord', () => z.partialRecord(z.enum(['a', 'b']), z.number())],
    [
      'record with literal keys',
      () => z.record(z.literal(['x', 'y']), z.string())
    ],
    ['exactOptional', () => z.object({ a: z.string().exactOptional() })],
    ['uuidv4', () => z.uuidv4()],
    ['uuidv6', () => z.uuidv6()],
    ['uuidv7', () => z.uuidv7()],
    ['guid', () => z.guid()],
    ['z.int().multipleOf(0.5)', () => z.int().multipleOf(0.5)],
    ['email().max(8)', () => z.email().max(8)]
  ])('generates values satisfying %s', (_name, build) => {
    holds(build());
  });

  it('generates every key of a record with enum keys', () => {
    for (const value of sample(
      arbitraryFromSchema(z.record(z.enum(['a', 'b']), z.number()))
    )) {
      expect(Object.keys(value as object).sort()).toEqual(['a', 'b']);
    }
  });

  it('keeps partialRecord keys optional', () => {
    const keyCounts = sample(
      arbitraryFromSchema(z.partialRecord(z.enum(['a', 'b']), z.number())),
      50
    ).map((value) => Object.keys(value as object).length);
    expect(keyCounts).toContain(0);
  });

  it('omits exactOptional keys instead of generating undefined', () => {
    const values = sample(
      arbitraryFromSchema(z.object({ a: z.string().exactOptional() })),
      100
    ) as Record<string, unknown>[];
    expect(values.some((value) => !('a' in value))).toBe(true);
    for (const value of values) {
      if ('a' in value) {
        expect(typeof value.a).toBe('string');
      }
    }
  });

  it('reports a recursive getter-based object, naming the path', () => {
    const Node = z.object({
      name: z.string(),
      get children() {
        return z.array(Node);
      }
    });
    expect(() => arbitraryFromSchema(Node, {}, 'evt')).toThrowError(
      /Recursive Zod schema at 'evt\.children\[\]'/
    );
  });

  it('reports a recursive z.lazy schema, naming the path', () => {
    const tree: z.ZodType = z.lazy(() =>
      z.object({ value: z.number(), next: tree.optional() })
    );
    expect(() => arbitraryFromSchema(tree, {}, 'evt')).toThrowError(
      /Recursive Zod schema at 'evt\.next'/
    );
  });
});

describe('eventsFromSchemas with wildcard schema keys', () => {
  const machine = createMachine({
    schemas: {
      events: {
        'user.*': z.object({ id: z.string().min(1) }),
        'user.special': z.object({ special: z.literal(true) }),
        '*': z.object({ any: z.boolean() })
      }
    },
    on: {
      'user.login': () => ({}),
      'user.logout': () => ({}),
      'user.special': () => ({}),
      other: () => ({})
    }
  } as any);

  it.each(['empty', 'skip'] as const)(
    'derives matching event types from the wildcard schema (%s)',
    (eventsWithoutSchema) => {
      const events = eventsFromSchemas(machine, {
        eventsWithoutSchema
      }) as Record<string, fc.Arbitrary<Record<string, unknown>>>;

      expect(Object.keys(events).sort()).toEqual([
        'other',
        'user.login',
        'user.logout',
        'user.special'
      ]);
      for (const type of ['user.login', 'user.logout']) {
        for (const value of sample(events[type])) {
          expect(typeof value.id).toBe('string');
          expect((value.id as string).length).toBeGreaterThan(0);
        }
      }
      for (const value of sample(events['user.special'])) {
        expect(value).toEqual({ special: true });
      }
      for (const value of sample(events.other)) {
        expect(typeof value.any).toBe('boolean');
      }
    }
  );

  it('generates events the machine accepts', async () => {
    const events = eventsFromSchemas(machine) as Record<
      string,
      fc.Arbitrary<Record<string, unknown>>
    >;
    const { validate } = (machine as any).eventSchema['~standard'];
    for (const [type, arbitrary] of Object.entries(events)) {
      for (const payload of sample(arbitrary)) {
        expect((await validate({ type, ...payload })).issues).toBeUndefined();
      }
    }
  });
});

describe('unsupported Zod checks', () => {
  it('reports the check kind instead of ignoring it', () => {
    expect(() =>
      arbitraryFromSchema(
        z.number().refine((value) => value > 0),
        {},
        'evt.value'
      )
    ).toThrowError(/Unsupported Zod check 'custom' on number at 'evt.value'/);
  });
});
