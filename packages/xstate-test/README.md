# @xstate/test

This package contains utilities for facilitating [model-based testing](https://en.wikipedia.org/wiki/Model-based_testing) for any software.

- [Read the full documentation in the XState docs](https://xstate.js.org/docs/packages/xstate-test/).
- [Read our contribution guidelines](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md).

## Talk

[Write Fewer Tests! From Automation to Autogeneration](https://slides.com/davidkhourshid/mbt) at React Rally 2019 ([🎥 Video](https://www.youtube.com/watch?v=tpNmPKjPSFQ))

## Quick Start

1. Install `xstate` and `@xstate/test`:

```bash
npm install xstate @xstate/test
```

2. Create the machine that will be used to model the system under test (SUT):

```js
import { createMachine } from 'xstate';

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        TOGGLE: 'active'
      }
    },
    active: {
      on: {
        TOGGLE: 'inactive'
      }
    }
  }
});
```

3. Add assertions for each state in the machine (in this example, using [Puppeteer](https://github.com/GoogleChrome/puppeteer)):

```js
// ...

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        /* ... */
      },
      meta: {
        test: async (page) => {
          await page.waitFor('input:checked');
        }
      }
    },
    active: {
      on: {
        /* ... */
      },
      meta: {
        test: async (page) => {
          await page.waitFor('input:not(:checked)');
        }
      }
    }
  }
});
```

4. Create the model:

```js
import { createMachine } from 'xstate';
import { createModel } from '@xstate/test';

const toggleMachine = createMachine(/* ... */);

const toggleModel = createModel(toggleMachine).withEvents({
  TOGGLE: {
    exec: async (page) => {
      await page.click('input');
    }
  }
});
```

5. Create test plans and run the tests with coverage:

```js
// ...

describe('toggle', () => {
  const testPlans = toggleModel.getShortestPathPlans();

  testPlans.forEach((plan) => {
    describe(plan.description, () => {
      plan.paths.forEach((path) => {
        it(path.description, async () => {
          // do any setup, then...

          await path.test(page);
        });
      });
    });
  });

  it('should have full coverage', () => {
    return toggleModel.testCoverage();
  });
});
```
