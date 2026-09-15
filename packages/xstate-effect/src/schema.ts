import { Schema } from 'effect';
import type {
  SetupSchemas,
  SetupStateSchema,
  SetupStateSchemas,
  StandardSchemaV1
} from 'xstate';

/**
 * An Effect `Schema` accepted by this package. `setupEffect`, `fromEffect`,
 * `fromEffectStream` and `fromEffectEventStream` convert it to a Standard
 * Schema, so XState infers the decoded `Schema.Type` without an explicit call
 * to `Schema.toStandardSchemaV1`.
 */
export type EffectSchema = Schema.ConstraintDecoder<unknown>;

/**
 * Either an Effect {@link EffectSchema} or a Standard Schema. Every schema
 * position in this package accepts both, so Effect schemas and schemas from
 * other libraries can be mixed in one machine.
 */
export type EffectSchemaLike = StandardSchemaV1 | EffectSchema;

interface RuntimeValidationDoesNotSupportTransformingSchemas {
  readonly __xstate_effect_error: 'Runtime validation does not support schemas with different encoded and decoded types';
}

type IsAny<T> = 0 extends 1 & T ? true : false;

export type ToStandardSchema<TSchema> = TSchema extends StandardSchemaV1
  ? TSchema
  : TSchema extends EffectSchema
    ? StandardSchemaV1<TSchema['Encoded'], TSchema['Type']> & TSchema
    : never;

type AssertNonTransformingSchema<TSchema> = TSchema extends EffectSchemaLike
  ? IsAny<StandardSchemaV1.InferInput<ToStandardSchema<TSchema>>> extends true
    ? TSchema
    : IsAny<
          StandardSchemaV1.InferOutput<ToStandardSchema<TSchema>>
        > extends true
      ? TSchema
      : [
            StandardSchemaV1.InferInput<ToStandardSchema<TSchema>>,
            StandardSchemaV1.InferOutput<ToStandardSchema<TSchema>>
          ] extends [
            StandardSchemaV1.InferOutput<ToStandardSchema<TSchema>>,
            StandardSchemaV1.InferInput<ToStandardSchema<TSchema>>
          ]
        ? TSchema
        : RuntimeValidationDoesNotSupportTransformingSchemas
  : TSchema;

type EffectSchemaShape<TValue> = TValue extends StandardSchemaV1
  ? EffectSchemaLike
  : TValue extends Record<string, unknown>
    ? { [K in keyof TValue]: EffectSchemaShape<TValue[K]> }
    : TValue;

type ToStandardSchemaShape<TValue> = TValue extends EffectSchemaLike
  ? ToStandardSchema<TValue>
  : TValue extends Record<string, unknown>
    ? { [K in keyof TValue]: ToStandardSchemaShape<TValue[K]> }
    : TValue;

/**
 * The `schemas` option of `setupEffect`: XState's `SetupSchemas` with every
 * schema position widened to {@link EffectSchemaLike}. Covers `context`,
 * `input`, `output` and the per-key records for `events`, `internalEvents`,
 * `emitted` and `children`.
 */
export type EffectSetupSchemas = {
  [K in keyof SetupSchemas]?: EffectSchemaShape<NonNullable<SetupSchemas[K]>>;
};

export type ValidateEffectActorSchemas<TSchemas> = {
  [K in keyof TSchemas]: AssertNonTransformingSchema<TSchemas[K]>;
};

export type ValidateEffectSetupSchemas<TSchemas> = {
  [K in keyof TSchemas]: K extends
    | 'events'
    | 'internalEvents'
    | 'emitted'
    | 'children'
    ? {
        [P in keyof TSchemas[K]]: AssertNonTransformingSchema<TSchemas[K][P]>;
      }
    : K extends 'context' | 'input' | 'output'
      ? AssertNonTransformingSchema<TSchemas[K]>
      : TSchemas[K];
};

export type ToStandardSetupSchemas<TSchemas> = {
  [K in keyof TSchemas]: ToStandardSchemaShape<TSchemas[K]>;
} extends infer TStandardSchemas extends SetupSchemas
  ? TStandardSchemas
  : never;

/**
 * One node of the `states` option of `setupEffect`: the schemas declared for
 * that state, and the same shape recursively for its child states. It is
 * XState's `SetupStateSchema` with Effect schemas allowed in every schema
 * position.
 */
export interface EffectSetupStateSchema {
  schemas?: EffectSchemaShape<SetupStateSchemas>;
  states?: Record<string, EffectSetupStateSchema>;
}

export type ValidateEffectSetupStates<TStates> = {
  [K in keyof TStates]: TStates[K] extends EffectSetupStateSchema
    ? {
        [P in keyof TStates[K]]: P extends 'schemas'
          ? TStates[K][P] extends Record<string, unknown>
            ? {
                [S in keyof TStates[K][P]]: AssertNonTransformingSchema<
                  TStates[K][P][S]
                >;
              }
            : TStates[K][P]
          : P extends 'states'
            ? TStates[K][P] extends Record<string, EffectSetupStateSchema>
              ? ValidateEffectSetupStates<TStates[K][P]>
              : TStates[K][P]
            : TStates[K][P];
      }
    : TStates[K];
};

type ToStandardSetupStateSchema<TStateSchema> =
  TStateSchema extends EffectSetupStateSchema
    ? {
        [K in keyof TStateSchema]: K extends 'schemas'
          ? ToStandardSchemaShape<TStateSchema[K]>
          : K extends 'states'
            ? TStateSchema[K] extends Record<string, EffectSetupStateSchema>
              ? ToStandardSetupStates<TStateSchema[K]>
              : TStateSchema[K]
            : TStateSchema[K];
      } extends infer TStandardStateSchema extends SetupStateSchema
      ? TStandardStateSchema
      : never
    : never;

export type ToStandardSetupStates<TStates> = {
  [K in keyof TStates]: ToStandardSetupStateSchema<TStates[K]>;
};

function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return (
    !!value &&
    (typeof value === 'object' || typeof value === 'function') &&
    '~standard' in value
  );
}

export function toStandardSchema(schema: EffectSchemaLike): StandardSchemaV1 {
  if (Schema.isSchema(schema)) {
    return Schema.toStandardSchemaV1(schema as EffectSchema);
  }
  return schema as StandardSchemaV1;
}

function mapSchemaRecord(
  value: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.keys(value).map((key) => {
      const entry = value[key];
      if (Schema.isSchema(entry) || isStandardSchema(entry)) {
        return [key, toStandardSchema(entry as EffectSchemaLike)];
      }
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
        return [key, mapSchemaRecord(entry as Record<string, unknown>)];
      }
      return [key, entry];
    })
  );
}

export function toStandardSetupSchemas(
  schemas: EffectSetupSchemas | undefined
): SetupSchemas | undefined {
  return schemas ? mapSchemaRecord(schemas) : undefined;
}

export function toStandardSetupStates(
  states: Record<string, EffectSetupStateSchema> | undefined
): Record<string, SetupStateSchema> | undefined {
  if (!states) {
    return undefined;
  }

  return Object.fromEntries(
    Object.keys(states).map((key) => {
      const state = states[key];
      return [
        key,
        {
          ...state,
          ...(state.schemas
            ? {
                schemas: mapSchemaRecord(state.schemas)
              }
            : undefined),
          ...(state.states
            ? { states: toStandardSetupStates(state.states) }
            : undefined)
        }
      ];
    })
  ) as Record<string, SetupStateSchema>;
}
