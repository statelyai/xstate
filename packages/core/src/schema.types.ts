/** The Standard Schema interface. */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  /** The Standard Schema properties. */
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

/** A type-only Standard Schema produced by {@link types}. */
export interface TypeSchema<T> extends StandardSchemaV1<T, T> {
  readonly '~standard': StandardSchemaV1.Props<T, T> & {
    readonly vendor: 'xstate.types';
  };
}

/**
 * Declares schema types for inference only — no runtime validation.
 *
 * Use in a machine's `schemas` when you want TypeScript types without pulling
 * in a schema library like Zod. The returned value is a valid Standard Schema
 * whose validation is the identity function, so it carries types but never
 * rejects input.
 *
 * @example
 *
 * ```ts
 * import { createMachine, types } from 'xstate';
 *
 * const machine = createMachine({
 *   schemas: {
 *     context: types<{ count: number }>(),
 *     events: {
 *       inc: types<{ by: number }>(),
 *       reset: types<{}>()
 *     }
 *   },
 *   context: { count: 0 }
 *   // ...
 * });
 * ```
 */
export function types<T>(): TypeSchema<T> {
  return {
    '~standard': {
      version: 1,
      vendor: 'xstate.types',
      validate: (value) => ({ value: value as T })
    }
  };
}

/** Returns true if the value is a type-only schema created by {@link types}. */
export function isTypeSchema(value: unknown): value is TypeSchema<unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    '~standard' in value &&
    (value as StandardSchemaV1)['~standard'].vendor === 'xstate.types'
  );
}

// eslint-disable-next-line @typescript-eslint/no-namespace
export declare namespace StandardSchemaV1 {
  /** The Standard Schema properties interface. */
  export interface Props<Input = unknown, Output = Input> {
    /** The version number of the standard. */
    readonly version: 1;
    /** The vendor name of the schema library. */
    readonly vendor: string;
    /** Validates unknown input values. */
    readonly validate: (
      value: unknown
    ) => Result<Output> | Promise<Result<Output>>;
    /** Inferred types associated with the schema. */
    readonly types?: Types<Input, Output> | undefined;
  }

  /** The result interface of the validate function. */
  export type Result<Output> = SuccessResult<Output> | FailureResult;

  /** The result interface if validation succeeds. */
  export interface SuccessResult<Output> {
    /** The typed output value. */
    readonly value: Output;
    /** The non-existent issues. */
    readonly issues?: undefined;
  }

  /** The result interface if validation fails. */
  export interface FailureResult {
    /** The issues of failed validation. */
    readonly issues: ReadonlyArray<Issue>;
  }

  /** The issue interface of the failure output. */
  export interface Issue {
    /** The error message of the issue. */
    readonly message: string;
    /** The path of the issue, if any. */
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  /** The path segment interface of the issue. */
  export interface PathSegment {
    /** The key representing a path segment. */
    readonly key: PropertyKey;
  }

  /** The Standard Schema types interface. */
  export interface Types<Input = unknown, Output = Input> {
    /** The input type of the schema. */
    readonly input: Input;
    /** The output type of the schema. */
    readonly output: Output;
  }

  /** Infers the input type of a Standard Schema. */
  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
    Schema['~standard']['types']
  >['input'];

  /** Infers the output type of a Standard Schema. */
  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
    Schema['~standard']['types']
  >['output'];
}
