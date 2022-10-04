import { StateValue } from 'xstate';
import { createTestModel } from '../src';
import { createTestMachine } from '../src/machine';
import { testUtils } from './testUtils';

type TagValue = [string, StateValue];

describe('tags', () => {
  it('should test tags', async () => {
    const testedStateValues: TagValue[] = [];
    const testModel = createTestModel(
      createTestMachine({
        initial: 'a',
        states: {
          a: {
            tags: 'test-1',
            on: {
              EVENT: 'b'
            }
          },
          b: {
            tags: 'test-2',
            initial: 'b1',
            states: {
              b1: {
                tags: 'test-3',
                on: { NEXT: 'b2' }
              },
              b2: {
                tags: 'test-1'
              }
            }
          }
        }
      })
    );

    await testUtils.testModel(testModel, {
      tags: {
        'test-1': (state) => {
          testedStateValues.push(['test-1', state.value]);
        },
        'test-2': (state) => {
          testedStateValues.push(['test-2', state.value]);
        },
        'test-3': (state) => {
          testedStateValues.push(['test-3', state.value]);
        }
      }
    });

    expect(testedStateValues).toMatchInlineSnapshot(`
      Array [
        Array [
          "test-1",
          "a",
        ],
        Array [
          "test-3",
          Object {
            "b": "b1",
          },
        ],
        Array [
          "test-2",
          Object {
            "b": "b1",
          },
        ],
        Array [
          "test-1",
          Object {
            "b": "b2",
          },
        ],
        Array [
          "test-2",
          Object {
            "b": "b2",
          },
        ],
      ]
    `);
  });
});
