import { createMachine, EventObject } from '../src';
import * as Ajv from 'ajv';
import { createSchema } from '../src/schema';

const noop = (..._args: any[]) => void 0;

describe('event schema', () => {
  it('action types can be provided', () => {
    type SomeActions =
      | {
          type: 'someEntry';
        }
      | { type: 'someExit' }
      | { type: 'someAction' }
      | { type: 'anotherAction' };

    const machine = createMachine({
      schema: {
        actions: createSchema<SomeActions>()
      },
      // @ts-expect-error
      entry: 'invalidAction',
      // @ts-expect-error
      exit: ['someExit', 'invalidAction'],
      initial: 'active',
      states: {
        active: {
          entry: [
            'someEntry',
            (context, event) => {
              noop(context, event);
              /* or a function */
            }
          ],
          on: {
            EVENT: {
              actions: ['someAction', { type: 'anotherAction' }]
            }
          },
          exit: { type: 'someExit' }
        },
        invalid: {
          // @ts-expect-error
          on: {
            EVENT: {
              actions: ['someAction', 'someInvalidAction']
            }
          }
        }
      }
    });

    noop(machine);
  });

  it('an event schema can validate incoming events', () => {
    const ajv = new Ajv();

    function createEventsSchema<TEvent extends EventObject>(
      obj: { [key in TEvent['type']]?: any }
    ) {
      return ({
        anyOf: Object.keys(obj).map((key) => {
          return {
            type: 'object',
            ...obj[key],
            properties: {
              type: {
                const: key
              },
              ...obj[key].properties
            }
          };
        })
      } as any) as TEvent;
    }

    function validateEventsSchema<TEvent extends EventObject>(
      eventsSchema: any,
      event: TEvent
    ): boolean {
      const validate = ajv.compile(eventsSchema);

      const valid = validate(event) as boolean;

      if (!valid) {
        console.error(validate.errors);
      }

      return valid;
    }

    const machine = createMachine({
      schema: {
        events: createEventsSchema<{ type: 'TOGGLE' }>({
          TOGGLE: {
            properties: {
              password: {
                type: 'string'
              }
            },
            required: ['password']
          }
        })
      },
      initial: 'inactive',
      states: {
        inactive: {
          on: {
            TOGGLE: 'active'
          }
        },
        active: {}
      }
    });

    expect(
      validateEventsSchema(machine.schema?.events, { type: 'TOGGLE' })
    ).toBeFalsy();
    expect(
      validateEventsSchema(machine.schema?.events, {
        type: 'TOGGLE',
        password: 'whatever'
      })
    ).toBeTruthy();
  });
});
