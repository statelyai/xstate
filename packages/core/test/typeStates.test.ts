import z from 'zod';
import { Compute } from '../src';
import {
  TargetAndContextFromTypeStates,
  TypeStateFromSchema,
  TypeStateFromSchemas,
  TypeStateSchemas
} from '../src/typestates.types';
import { StandardSchemaV1 } from '../src/schema.types';

function createMachineWithTypeStates<T extends TypeStateSchemas>(config: {
  schemas: {
    typeStates: T;
  };
  states: {
    [K in keyof T]?: {
      on: {
        [E in string]: (x: Compute<TypeStateFromSchema<T[K]>>) =>
          | TargetAndContextFromTypeStates<TypeStateFromSchemas<T>>
          | {
              target: K;
              context?: T[K]['context'] extends StandardSchemaV1
                ? StandardSchemaV1.InferOutput<T[K]['context']>
                : never;
            };
      };
    };
  };
}) {}

describe('typeStates', () => {
  it('should be able to type the states', () => {
    createMachineWithTypeStates({
      schemas: {
        typeStates: {
          idle: {
            context: z.object({
              user: z.null()
            })
          },
          loading: {
            context: z.object({
              user: z.null()
            })
          },
          success: {
            context: z.object({
              user: z.string()
            })
          }
        }
      },
      states: {
        idle: {
          on: {
            VALID: () => ({
              target: 'loading',
              context: {
                user: null
              }
            }),
            VALID_SUCCESS: () => ({
              target: 'success',
              context: {
                user: 'test'
              }
            }),
            VALID_SAME_STATE_NO_CONTEXT: () => ({
              target: 'idle'
            }),
            INVALID_WRONG_CONTEXT: () =>
              // @ts-expect-error
              ({
                target: 'loading',
                context: {
                  user: 'test'
                }
              }),
            INVALID_DIFF_STATE_NO_CONTEXT: () =>
              // @ts-expect-error
              ({
                target: 'success'
              }),
            INVALID_SAME_STATE_WRONG_CONTEXT: (x) =>
              // @ts-expect-error
              ({
                target: 'idle',
                context: {
                  user: 'test'
                }
              })
          }
        }
      }
    });
  });
});
