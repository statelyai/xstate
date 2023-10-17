import { fromTransition } from 'xstate';
import { TestModel } from '../src/index.ts';
import { testUtils } from './testUtils';

describe('custom test models', () => {
  it('tests any logic', async () => {
    const transition = fromTransition((value, event) => {
      if (event.type === 'even') {
        return value / 2;
      } else {
        return value * 3 + 1;
      }
    }, 15);

    const model = new TestModel(transition, {
      events: (state) => {
        if (state.context % 2 === 0) {
          return [{ type: 'even' }];
        }
        return [{ type: 'odd' }];
      }
    });

    const paths = model.getShortestPaths({
      toState: (state) => state.context === 1
    });

    expect(paths.length).toBeGreaterThan(0);
  });

  it('tests states for any logic', async () => {
    const testedStateKeys: string[] = [];

    const transition = fromTransition((value, event) => {
      if (event.type === 'even') {
        return value / 2;
      } else {
        return value * 3 + 1;
      }
    }, 15);

    const model = new TestModel(transition, {
      events: (state) => {
        if (state.context % 2 === 0) {
          return [{ type: 'even' }];
        }
        return [{ type: 'odd' }];
      },
      stateMatcher: (state, key) => {
        if (key === 'even') {
          return state.context % 2 === 0;
        }
        if (key === 'odd') {
          return state.context % 2 === 1;
        }
        return false;
      }
    });

    const paths = model.getShortestPaths({
      toState: (state) => state.context === 1
    });

    await testUtils.testPaths(paths, {
      states: {
        even: (state) => {
          testedStateKeys.push('even');
          expect(state.context % 2).toBe(0);
        },
        odd: (state) => {
          testedStateKeys.push('odd');
          expect(state.context % 2).toBe(1);
        }
      }
    });

    expect(testedStateKeys).toContain('even');
    expect(testedStateKeys).toContain('odd');
  });
});
