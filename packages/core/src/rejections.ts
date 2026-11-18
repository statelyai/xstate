import type { EventObject, Values } from './base.types.ts';
import type { StandardSchemaV1 } from './schema.types.ts';

type InferRejection<TType extends string, TSchema extends StandardSchemaV1> =
  StandardSchemaV1.InferInput<TSchema> extends infer TInput
    ? [TInput] extends [never]
      ? never
      : unknown extends TInput
        ? TInput & { type: TType }
        : [TInput] extends [void]
          ? { type: TType }
          : TInput & { type: TType }
    : never;

type InferRejections<TSchemaMap extends Record<string, StandardSchemaV1>> =
  TSchemaMap extends unknown
    ? Values<{
        [K in keyof TSchemaMap & string]: InferRejection<K, TSchemaMap[K]>;
      }>
    : never;

/** @public */
export type RejectionResult<TRejection extends EventObject> = {
  reject: readonly [TRejection, ...TRejection[]];
  target?: never;
  context?: never;
  input?: never;
  reenter?: never;
};

/** @public */
export type Reject<TRejection extends EventObject> = (
  reasons: readonly [TRejection, ...TRejection[]]
) => RejectionResult<TRejection>;

/** @public */
export type RejectionsFromConfig<T> = T extends {
  schemas: { rejections: infer TMap extends Record<string, StandardSchemaV1> };
}
  ? InferRejections<TMap>
  : never;

/** @public */
export type RejectionFrom<T> = T extends { _stateSchema: infer TConfig }
  ? RejectionsFromConfig<TConfig>
  : never;

/** @public */
export type TransitionRejection<TRejection extends EventObject> = {
  source: string;
  reasons: readonly [TRejection, ...TRejection[]];
};

/** @public */
export type TransitionCheck<TRejection extends EventObject> =
  | { status: 'accepted' }
  | { status: 'unhandled' }
  | {
      status: 'rejected' | 'partial';
      rejections: readonly [
        TransitionRejection<TRejection>,
        ...TransitionRejection<TRejection>[]
      ];
    };

function isReason(value: unknown): value is EventObject {
  return (
    !!value &&
    typeof value === 'object' &&
    'type' in value &&
    typeof value.type === 'string'
  );
}

export function reject(reasons: unknown): RejectionResult<EventObject> {
  if (!Array.isArray(reasons)) {
    throw new Error(
      'reject(...) requires a nonempty array of rejection objects with a string type.'
    );
  }
  const parsed: EventObject[] = [];
  for (const reason of reasons) {
    if (!isReason(reason))
      throw new Error(
        'reject(...) requires a nonempty array of rejection objects with a string type.'
      );
    parsed.push(reason);
  }
  const [first, ...rest] = parsed;
  if (!first)
    throw new Error(
      'reject(...) requires a nonempty array of rejection objects with a string type.'
    );
  return { reject: [first, ...rest] };
}

export function isRejection(
  value: unknown
): value is RejectionResult<EventObject> {
  return !!value && typeof value === 'object' && 'reject' in value;
}

export function assertRejectionResult(
  value: RejectionResult<EventObject>,
  schemas: Record<string, StandardSchemaV1> | undefined
): void {
  reject(value.reject);
  if (['target', 'context', 'input', 'reenter'].some((key) => key in value)) {
    throw new Error(
      'A rejection cannot include a target, context, input, or reenter.'
    );
  }
  if (!schemas) return;
  for (const reason of value.reject) {
    const schema = schemas[reason.type];
    if (!schema) throw new Error(`Unknown rejection type "${reason.type}".`);
    const { type: _type, ...payload } = reason;
    const result = schema['~standard'].validate(payload);
    if ('then' in result) {
      void Promise.resolve(result).catch(() => {});
      throw new Error('Rejection schemas must be synchronous.');
    }
    if (result.issues)
      throw new Error(
        `Invalid rejection "${reason.type}": ${result.issues.map((issue) => issue.message).join(', ')}`
      );
  }
}
