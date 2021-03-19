import { createMachine, createSchema } from '../src';

namespace JSONSchema {
  export interface String {
    type: 'string';
  }
  export interface Number {
    type: 'number';
  }
  export interface Object<TK extends string> {
    type: 'object';
    properties: {
      [key in TK]: JSONSchema.Thing;
    };
  }
  export type Thing =
    | JSONSchema.String
    | JSONSchema.Number
    | JSONSchema.Object<string>;
  export type TypeFrom<T extends JSONSchema.Thing> = T extends JSONSchema.String
    ? string
    : T extends JSONSchema.Number
    ? number
    : T extends JSONSchema.Object<infer Keys>
    ? {
        [Key in Keys]: TypeFrom<T['properties'][Key]>;
      }
    : unknown;
}

function fromJSONSchema<T extends JSONSchema.Thing>(
  schema: T
): JSONSchema.TypeFrom<T> {
  return schema as any;
}

describe('schema', () => {
  it('should infer types from provided schema', () => {
    const noop = (_: any) => void 0;

    const m = createMachine({
      schema: {
        context: fromJSONSchema({
          type: 'object',
          properties: {
            foo: { type: 'string' },
            bar: { type: 'number' },
            baz: {
              type: 'object',
              properties: {
                one: { type: 'string' }
              }
            }
          }
        }),
        events: createSchema<{ type: 'FOO' } | { type: 'BAR' }>()
      },
      context: { foo: '', bar: 0, baz: { one: '' } },
      initial: 'active',
      states: {
        active: {
          entry: ['asdf']
        }
      }
    });

    noop(m.context.foo);
    noop(m.context.baz.one);
    m.transition('active', 'BAR');

    // @ts-expect-error
    noop(m.context.something);

    // @ts-expect-error
    m.transition('active', 'INVALID');
  });

  it('schema should be present in the machine definition', () => {
    const schema = {
      context: fromJSONSchema({
        type: 'object',
        properties: {
          foo: { type: 'string' }
        }
      })
    };

    const m = createMachine({
      schema,
      context: { foo: '' },
      initial: 'active',
      states: {
        active: {}
      }
    });

    expect(m.schema).toEqual(schema);
  });
});
