import { createMachine, assign } from '../src/index';
import * as machineSchema from '../src/machine.schema.json';

import * as Ajv from 'ajv';

const ajv = new Ajv();
const validate = ajv.compile(machineSchema);

describe('json', () => {
  it('should serialize the machine', () => {
    const machine = createMachine<{ [key: string]: any }>({
      initial: 'foo',
      context: {
        number: 0,
        string: 'hello'
      },
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
            assign(ctx => ({
              ...ctx
            }))
          ],
          on: {
            TO_FOO: {
              target: ['foo', 'bar'],
              cond: ctx => !!ctx.string
            }
          }
        },
        foo: {},
        bar: {}
      }
    });

    const json = JSON.parse(JSON.stringify(machine.definition));

    validate(json);

    expect(validate.errors).toBeNull();
  });
});
