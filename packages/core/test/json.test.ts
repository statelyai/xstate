import { createMachineFromConfig } from '../src/createMachineFromConfig';

import * as machineSchema from '../src/machine.schema.json';

import Ajv from 'ajv';

const ajv = new Ajv();
const validate = ajv.compile(machineSchema);

describe.skip('json', () => {
  it('should serialize the machine', () => {
    const machine = createMachineFromConfig({
      initial: 'foo',
      version: '1.0.0',
      context: {
        number: 0,
        string: 'hello'
      },
      invoke: [{ id: 'invokeId', src: 'invokeSrc' }],
      states: {
        testActions: {
          invoke: [{ id: 'invokeId', src: 'invokeSrc' }],
          entry: [
            { type: 'stringActionType' },
            {
              type: 'objectActionType'
            },
            {
              type: 'objectActionTypeWithExec',
              params: { other: 'any' }
            }
          ],
          on: {
            TO_FOO: {
              target: ['foo', 'bar'],
              guard: { type: 'isString', params: { string: 'hello' } }
            }
          },
          after: {
            1000: { target: 'bar' }
          }
        },
        foo: {},
        bar: {},
        testHistory: {
          type: 'history',
          history: 'deep'
        },
        testFinal: {
          type: 'final',
          output: {
            something: 'else'
          }
        },
        testParallel: {
          type: 'parallel',
          states: {
            one: {
              initial: 'inactive',
              states: {
                inactive: {}
              }
            },
            two: {
              initial: 'inactive',
              states: {
                inactive: {}
              }
            }
          }
        }
      },
      output: { result: 42 }
    });

    const json = JSON.parse(JSON.stringify(machine.definition));

    try {
      validate(json);
    } catch (err: any) {
      throw new Error(JSON.stringify(JSON.parse(err.message), null, 2));
    }

    expect(validate.errors).toBeNull();
  });

  it('should detect an invalid machine', () => {
    const invalidMachineConfig = {
      id: 'something',
      key: 'something',
      type: 'invalid type',
      states: {}
    };

    validate(invalidMachineConfig);
    expect(validate.errors).not.toBeNull();
  });

  it('should not double-serialize invoke transitions', () => {
    const machine = createMachineFromConfig({
      initial: 'active',
      states: {
        active: {
          id: 'active',
          invoke: {
            src: 'someSrc',
            onDone: { target: 'foo' },
            onError: { target: 'bar' }
          },
          on: {
            EVENT: { target: 'foo' }
          }
        },
        foo: {},
        bar: {}
      }
    });

    const machineJSON = JSON.stringify(machine);

    const machineObject = JSON.parse(machineJSON);

    const revivedMachine = createMachineFromConfig(machineObject);

    expect([...revivedMachine.states.active.transitions.values()].flat())
      .toMatchInlineSnapshot(`
      [
        {
          "actions": [],
          "eventType": "EVENT",
          "guard": undefined,
          "reenter": false,
          "source": "#active",
          "target": [
            "#(machine).foo",
          ],
          "toJSON": [Function],
        },
        {
          "actions": [],
          "eventType": "xstate.done.actor.0.active",
          "guard": undefined,
          "reenter": false,
          "source": "#active",
          "target": [
            "#(machine).foo",
          ],
          "toJSON": [Function],
        },
        {
          "actions": [],
          "eventType": "xstate.error.actor.0.active",
          "guard": undefined,
          "reenter": false,
          "source": "#active",
          "target": [
            "#(machine).bar",
          ],
          "toJSON": [Function],
        },
      ]
    `);

    // 1. onDone
    // 2. onError
    // 3. EVENT
    expect(
      [
        ...revivedMachine.getStateNodeById('active').transitions.values()
      ].flatMap((t) => t).length
    ).toBe(3);
  });
});
