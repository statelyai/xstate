/** The Standard Schema interface. See https://standardschema.dev */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

// oxlint-disable-next-line typescript/no-namespace -- mirrors the Standard Schema spec
export declare namespace StandardSchemaV1 {
  export interface Props<Input = unknown, Output = Input> {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (
      value: unknown
    ) => Result<Output> | Promise<Result<Output>>;
    readonly types?: Types<Input, Output> | undefined;
  }

  export type Result<Output> = SuccessResult<Output> | FailureResult;

  export interface SuccessResult<Output> {
    readonly value: Output;
    readonly issues?: undefined;
  }

  export interface FailureResult {
    readonly issues: ReadonlyArray<Issue>;
  }

  export interface Issue {
    readonly message: string;
    readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
  }

  export interface PathSegment {
    readonly key: PropertyKey;
  }

  export interface Types<Input = unknown, Output = Input> {
    readonly input: Input;
    readonly output: Output;
  }

  export type InferInput<Schema extends StandardSchemaV1> = NonNullable<
    Schema['~standard']['types']
  >['input'];

  export type InferOutput<Schema extends StandardSchemaV1> = NonNullable<
    Schema['~standard']['types']
  >['output'];
}

/** A JSON Schema object. */
export type JSONSchema = Record<string, unknown>;

interface StandardJSONSchema extends StandardSchemaV1 {
  '~standard': StandardSchemaV1['~standard'] & {
    jsonSchema?: {
      input(options: { target: string }): JSONSchema;
    };
  };
}

export function isPromiseLike<T>(
  value: T | PromiseLike<T>
): value is PromiseLike<T> {
  return !!value && typeof (value as { then?: unknown }).then === 'function';
}

/**
 * Converts a schema to an input JSON Schema, using `toJSONSchema` when given
 * and Standard JSON Schema otherwise.
 */
export function getInputJSONSchema(
  schema: StandardSchemaV1,
  toJSONSchema: ((schema: StandardSchemaV1) => JSONSchema) | undefined,
  label: string
): JSONSchema {
  if (toJSONSchema) {
    return toJSONSchema(schema);
  }

  const jsonSchema = (schema as StandardJSONSchema)['~standard'].jsonSchema;

  if (jsonSchema?.input) {
    const { $schema: _, ...rest } = jsonSchema.input({ target: 'draft-07' });
    return rest;
  }

  throw new Error(
    `The schema for ${label} does not implement Standard JSON Schema. Pass a \`toJSONSchema\` option to convert it.`
  );
}

/** Thrown when tool input fails its schema. */
export class WebMCPInputError extends Error {
  public readonly toolName: string;
  public readonly issues: ReadonlyArray<StandardSchemaV1.Issue> | undefined;

  constructor(
    toolName: string,
    issues?: ReadonlyArray<StandardSchemaV1.Issue>
  ) {
    super(
      `Invalid input for tool "${toolName}"${
        issues?.length
          ? `: ${issues
              .map((issue) =>
                issue.path?.length
                  ? `${issue.path
                      .map((segment) =>
                        String(
                          typeof segment === 'object' ? segment.key : segment
                        )
                      )
                      .join('.')}: ${issue.message}`
                  : issue.message
              )
              .join('; ')}`
          : ''
      }`
    );
    this.name = 'WebMCPInputError';
    this.toolName = toolName;
    this.issues = issues;
  }
}

export async function validateInput(
  schema: StandardSchemaV1 | undefined,
  toolName: string,
  input: unknown
): Promise<Record<string, unknown>> {
  if (!schema) {
    return (input ?? {}) as Record<string, unknown>;
  }

  const result = schema['~standard'].validate(input ?? {});
  const validated = isPromiseLike(result) ? await result : result;

  if (validated.issues) {
    throw new WebMCPInputError(toolName, validated.issues);
  }

  if (
    !validated.value ||
    typeof validated.value !== 'object' ||
    Array.isArray(validated.value)
  ) {
    throw new WebMCPInputError(toolName, [{ message: 'Expected an object.' }]);
  }

  return validated.value as Record<string, unknown>;
}
