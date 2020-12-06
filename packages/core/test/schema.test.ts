import { createMachine, EventObject } from '../src';
import * as Ajv from 'ajv';

describe('event schema', () => {
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
