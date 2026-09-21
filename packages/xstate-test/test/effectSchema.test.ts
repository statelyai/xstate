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
