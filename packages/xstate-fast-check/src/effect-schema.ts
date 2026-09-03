import * as Schema from 'effect/Schema';
import * as fc from 'fast-check';

/** Converts an Effect Schema into a native FastCheck arbitrary. */
export function fromEffectSchema<TSchema extends Schema.Top>(
  schema: TSchema
): fc.Arbitrary<TSchema['Type']> {
  return Schema.toArbitrary(schema)(fc);
}

/** Converts a keyed payload-schema map for use by `propertyTest()`. */
export function fromEffectSchemas<
  TSchemas extends Readonly<Record<string, Schema.Top>>
>(
  schemas: TSchemas
): {
  [TKey in keyof TSchemas]: fc.Arbitrary<TSchemas[TKey]['Type']>;
} {
  return Object.fromEntries(
    Object.entries(schemas).map(([key, schema]) => [
      key,
      fromEffectSchema(schema)
    ])
  ) as {
    [TKey in keyof TSchemas]: fc.Arbitrary<TSchemas[TKey]['Type']>;
  };
}
