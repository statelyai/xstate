import * as Schema from 'effect/Schema';
import * as fc from 'fast-check';
import type { AnyStateMachine } from 'xstate';
import {
  eventsFromSchemas as baseEventsFromSchemas,
  type EventsFromSchemasOptions,
  type SchemaConverter
} from './schema.ts';

const effectConverter: SchemaConverter = (schema) =>
  schema !== null &&
  (typeof schema === 'object' || typeof schema === 'function') &&
  typeof (schema as { ast?: { _tag?: unknown } }).ast === 'object'
    ? (fromEffectSchema(schema as Schema.Top) as fc.Arbitrary<unknown>)
    : undefined;

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

/**
 * Same as `eventsFromSchemas` from `@xstate/fast-check`, with Effect Schema
 * support registered.
 */
export function eventsFromSchemas<TMachine extends AnyStateMachine>(
  machine: TMachine,
  options: EventsFromSchemasOptions = {}
): ReturnType<typeof baseEventsFromSchemas<TMachine>> {
  return baseEventsFromSchemas(machine, {
    ...options,
    converters: [effectConverter, ...(options.converters ?? [])]
  });
}
