import * as fc from 'fast-check';
import * as Schema from 'effect/Schema';
import * as z from 'zod';
import { createMachine, types } from 'xstate';
import { propertyTest } from 'xstate/graph';
import {
  arbitraryFromSchema,
  eventsFromSchemas,
  fastCheckAdapter,
  mergeEventGenerators
} from '../src/index.ts';
import { eventsFromSchemas as eventsFromSchemasWithEffect } from '../src/effect-schema.ts';

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
      adapter: fastCheckAdapter({ seed: 1, numRuns: 5, maxCommands: 3 }),
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
      /@xstate\/fast-check\/effect-schema/
    );
  });
});
