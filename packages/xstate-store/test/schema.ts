import type { StandardSchemaV1 } from '../src/schema.ts';

export function schema<TOutput>(): StandardSchemaV1<TOutput> {
  return {
    '~standard': {
      version: 1,
      vendor: 'xstate-store-test',
      validate: (value) => ({ value: value as TOutput })
    }
  };
}
