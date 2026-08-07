import { z } from 'zod';
import { setup } from '../src/index.ts';
import { standardSchemaValidator } from '../src/validation/index.ts';

describe('runtime validation types', () => {
  it('rejects type-changing schemas only when validation is installed', () => {
    const transforming = z.string().transform((value) => value.length);

    setup({ schemas: { input: transforming } });

    if (false) {
      setup({
        validator: standardSchemaValidator(),
        // @ts-expect-error - runtime validation does not apply schema transforms
        schemas: { input: transforming }
      });
    }
  });

  it('checks validated schema maps and nested state schemas', () => {
    const transforming = z.string().transform((value) => value.length);

    setup({
      validator: standardSchemaValidator(),
      schemas: {
        actions: { track: { params: transforming } },
        guards: { allowed: { params: transforming } },
        meta: transforming
      }
    });

    if (false) {
      setup({
        validator: standardSchemaValidator(),
        schemas: {
          events: {
            // @ts-expect-error - event schema changes its runtime type
            GO: transforming
          }
        }
      });

      setup({
        validator: standardSchemaValidator(),
        states: {
          loading: {
            schemas: {
              // @ts-expect-error - state input schema changes its runtime type
              input: transforming
            }
          }
        }
      });
    }
  });

  it('allows same-type transforms as a documented generic limitation', () => {
    setup({
      validator: standardSchemaValidator(),
      schemas: {
        input: z.string().transform((value) => value.trim())
      }
    });
  });

  it('inherits validation across extend unless explicitly disabled', () => {
    const transforming = z.string().transform((value) => value.length);
    const validated = setup({ validator: standardSchemaValidator() });

    if (false) {
      validated.extend({
        schemas: {
          // @ts-expect-error - extended schemas inherit runtime validation
          input: transforming
        }
      });

      validated.createMachine({
        schemas: {
          // @ts-expect-error - inline machine schemas use the setup validator
          input: transforming
        }
      });

      validated.createMachine({
        states: {
          loading: {
            schemas: {
              // @ts-expect-error - inline state schemas use the setup validator
              input: transforming
            }
          }
        }
      });
    }

    const unvalidated = validated.extend({
      validator: undefined,
      schemas: { input: transforming }
    });
    unvalidated.createMachine({
      schemas: { output: transforming }
    });
  });

  it('requires validation to be installed by the root setup', () => {
    const transforming = z.string().transform((value) => value.length);
    const base = setup({ schemas: { input: transforming } });

    if (false) {
      base.extend({
        // @ts-expect-error - validation must be installed by the root setup
        validator: standardSchemaValidator()
      });
    }
  });
});
