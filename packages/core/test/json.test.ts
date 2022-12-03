import { createMachine, assign } from '../src/index';
import * as machineSchema from '../src/machine.schema.json';

import * as Ajv from 'ajv';

const ajv = new Ajv();
const validate = ajv.compile(machineSchema);

describe('json', () => {
  it('should serialize the machine', () => {
    const machine = createMachine<{ [key: string]: any }>({
      initial: 'foo',
      version: '1.0.0',
      context: {
        number: 0,
        string: 'hello'
      },
      invoke: [{ id: 'invokeId', src: 'invokeSrc', autoForward: true }],
      states: {
        testActions: {
          invoke: [{ id: 'invokeId', src: 'invokeSrc', autoForward: true }],
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
            }),
            assign((ctx) => ({
              ...ctx
            }))
          ],
          on: {
            TO_FOO: {
              target: ['foo', 'bar'],
              cond: (ctx) => !!ctx.string
            }
          },
          after: {
            1000: 'bar'
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
          data: {
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
      }
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
    const machine = createMachine({
      initial: 'active',
      states: {
        active: {
          invoke: {
            src: 'someSrc',
            onDone: 'foo',
            onError: 'bar'
          },
          on: {
            EVENT: 'foo'
          }
        },
        foo: {},
        bar: {}
      }
    });

    const machineJSON = JSON.stringify(machine);

    const machineObject = JSON.parse(machineJSON);

    const revivedMachine = createMachine(machineObject);

    expect(revivedMachine.states.active.transitions).toMatchInlineSnapshot(`
      Array [
        Object {
          "actions": Array [],
          "cond": undefined,
          "event": "done.invoke.(machine).active:invocation[0]",
          "eventType": "done.invoke.(machine).active:invocation[0]",
          "internal": false,
          "source": "#(machine).active",
          "target": Array [
            "#(machine).foo",
          ],
          "toJSON": [Function],
        },
        Object {
          "actions": Array [],
          "cond": undefined,
          "event": "error.platform.(machine).active:invocation[0]",
          "eventType": "error.platform.(machine).active:invocation[0]",
          "internal": false,
          "source": "#(machine).active",
          "target": Array [
            "#(machine).bar",
          ],
          "toJSON": [Function],
        },
        Object {
          "actions": Array [],
          "cond": undefined,
          "event": "EVENT",
          "eventType": "EVENT",
          "internal": false,
          "source": "#(machine).active",
          "target": Array [
            "#(machine).foo",
          ],
          "toJSON": [Function],
        },
      ]
    `);

    // 1. onDone
    // 2. onError
    // 3. EVENT
    expect(revivedMachine.states.active.transitions.length).toBe(3);
  });
});
