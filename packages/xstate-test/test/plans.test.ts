import { createTestModel } from '../src';
import { coversAllStates } from '../src/coverage';
import { createTestMachine } from '../src/machine';

describe('testModel.testPlans(...)', () => {
  it('custom plan generators can be provided', async () => {
    const testModel = createTestModel(
      createTestMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: 'b'
            }
          },
          b: {}
        }
      })
    );

    const plans = testModel.getPlans({
      planGenerator: (behavior, options) => {
        const events = options.getEvents?.(behavior.initialState) ?? [];

        const nextState = behavior.transition(behavior.initialState, events[0]);
        return [
          {
            state: nextState,
            paths: [
              {
                state: nextState,
                steps: [
                  {
                    state: behavior.initialState,
                    event: events[0]
                  }
                ],
                weight: 1
              }
            ]
          }
        ];
      }
    });

    await testModel.testPlans({ plans });

    expect(testModel.getCoverage(coversAllStates())).toMatchInlineSnapshot(`
      Array [
        Object {
          "criterion": Object {
            "description": "Visits \\"(machine)\\"",
            "predicate": [Function],
            "skip": false,
          },
          "status": "covered",
        },
        Object {
          "criterion": Object {
            "description": "Visits \\"(machine).a\\"",
            "predicate": [Function],
            "skip": false,
          },
          "status": "covered",
        },
        Object {
          "criterion": Object {
            "description": "Visits \\"(machine).b\\"",
            "predicate": [Function],
            "skip": false,
          },
          "status": "covered",
        },
      ]
    `);
  });
});
