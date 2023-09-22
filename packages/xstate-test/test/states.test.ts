import { StateValue } from 'xstate';
import { createTestModel } from '../src/index.ts';
import { createTestMachine } from '../src/machine';
import { testUtils } from './testUtils';

describe('states', () => {
  it('should test states by key', async () => {
    const testedStateValues: StateValue[] = [];
    const testModel = createTestModel(
      createTestMachine({
        initial: 'a',
        states: {
          a: {
            on: {
              EVENT: 'b'
            }
          },
          b: {
            initial: 'b1',
            states: {
              b1: { on: { NEXT: 'b2' } },
              b2: {}
            }
          }
        }
      })
    );

    await testUtils.testModel(testModel, {
      states: {
        a: (state) => {
          testedStateValues.push(state.value);
        },
        b: (state) => {
          testedStateValues.push(state.value);
        },
        'b.b1': (state) => {
          testedStateValues.push(state.value);
        },
        'b.b2': (state) => {
          testedStateValues.push(state.value);
        }
      }
    });

    expect(testedStateValues).toMatchInlineSnapshot(`
      [
        "a",
        {
          "b": "b1",
        },
        {
          "b": "b1",
        },
        {
          "b": "b2",
        },
        {
          "b": "b2",
        },
      ]
    `);
  });
  it('should test states by ID', async () => {
    const testedStateValues: StateValue[] = [];
    const testModel = createTestModel(
      createTestMachine({
        initial: 'a',
        states: {
          a: {
            id: 'state_a',
            on: {
              EVENT: 'b'
            }
          },
          b: {
            id: 'state_b',
            initial: 'b1',
            states: {
              b1: {
                id: 'state_b1',
                on: { NEXT: 'b2' }
              },
              b2: {
                id: 'state_b2'
              }
            }
          }
        }
      })
    );

    await testUtils.testModel(testModel, {
      states: {
        '#state_a': (state) => {
          testedStateValues.push(state.value);
        },
        '#state_b': (state) => {
          testedStateValues.push(state.value);
        },
        '#state_b1': (state) => {
          testedStateValues.push(state.value);
        },
        '#state_b2': (state) => {
          testedStateValues.push(state.value);
        }
      }
    });

    expect(testedStateValues).toMatchInlineSnapshot(`
      [
        "a",
        {
          "b": "b1",
        },
        {
          "b": "b1",
        },
        {
          "b": "b2",
        },
        {
          "b": "b2",
        },
      ]
    `);
  });
});
