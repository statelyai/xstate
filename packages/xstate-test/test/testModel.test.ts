import { TestModel } from '../src';

describe('custom test models', () => {
  it('tests any behavior', async () => {
    const model = new TestModel(
      {
        initialState: 15,
        transition: (value, event) => {
          if (event.type === 'even') {
            return value / 2;
          } else {
            return value * 3 + 1;
          }
        }
      },
      {
        getEvents: (state) => {
          if (state % 2 === 0) {
            return [{ type: 'even' }];
          }
          return [{ type: 'odd' }];
        }
      }
    );

    const plans = model.getShortestPlansTo((state) => state === 1);

    expect(plans.length).toBeGreaterThan(0);
  });

  it('tests states for any behavior', async () => {
    const testedStateKeys: string[] = [];

    const model = new TestModel(
      {
        initialState: 15,
        transition: (value, event) => {
          if (event.type === 'even') {
            return value / 2;
          } else {
            return value * 3 + 1;
          }
        }
      },
      {
        getEvents: (state) => {
          if (state % 2 === 0) {
            return [{ type: 'even' }];
          }
          return [{ type: 'odd' }];
        },
        states: {
          even: (state) => {
            testedStateKeys.push('even');
            expect(state % 2).toBe(0);
          },
          odd: (state) => {
            testedStateKeys.push('odd');
            expect(state % 2).toBe(1);
          }
        },
        stateMatcher: (state, key) => {
          if (key === 'even') {
            return state % 2 === 0;
          }
          if (key === 'odd') {
            return state % 2 === 1;
          }
          return false;
        }
      }
    );

    const plans = model.getShortestPlansTo((state) => state === 1);

    await model.testPlans(plans);

    expect(testedStateKeys).toContain('even');
    expect(testedStateKeys).toContain('odd');
  });
});
