import { createMachine, assign } from '../src/index';
import { getConfig } from '../src/json';
import * as machineSchema from '../src/machine.schema.json';

import * as Ajv from 'ajv';

const ajv = new Ajv();
const validate = ajv.compile(machineSchema);

describe('json', () => {
  it('should ser', () => {
    const machine = createMachine<{ [key: string]: any }>({
      initial: 'foo',
      context: {
        number: 0,
        string: 'hello'
      },
      states: {
        testActions: {
          entry: [
            'stringActionType',
            {
              type: 'objectActionType'
            },
            {
              type: 'objectActionTypeWithExec',
              exec: () => {
                return true;
              },
              other: 'any'
            },
            function actionFunction() {
              return true;
            },
            assign({
              number: 10,
              string: 'test',
              evalNumber: () => 42
            })
          ]
        }
      }
    });

    const config = getConfig(machine);
    const configFromJson = JSON.parse(JSON.stringify(config));

    expect(configFromJson).toMatchInlineSnapshot(`
      Object {
        "entry": Array [],
        "exit": Array [],
        "id": "(machine)",
        "initial": "foo",
        "invoke": Array [],
        "on": Object {},
        "states": Object {
          "testActions": Object {
            "entry": Array [
              Object {
                "type": "stringActionType",
              },
              Object {
                "type": "objectActionType",
              },
              Object {
                "other": "any",
                "type": "objectActionTypeWithExec",
              },
              Object {
                "type": "actionFunction",
              },
              Object {
                "assignment": Object {
                  "number": 10,
                  "string": "test",
                },
                "type": "xstate.assign",
              },
            ],
            "exit": Array [],
            "id": "(machine).testActions",
            "invoke": Array [],
            "on": Object {},
            "states": Object {},
            "type": "atomic",
          },
        },
        "type": "compound",
      }
    `);

    validate(configFromJson);

    expect(validate.errors).toBeNull();
  });
});
