# @xstate/test

This package contains utilities for facilitating [model-based testing](https://en.wikipedia.org/wiki/Model-based_testing) for any software.

- **Talk**: [Write Fewer Tests! From Automation to Autogeneration](https://slides.com/davidkhourshid/mbt) at React Rally 2019 ([🎥 Video](https://www.youtube.com/watch?v=tpNmPKjPSFQ))

## Quick Start

1. Install `xstate` and `@xstate/test`:

```bash
npm install xstate @xstate/test
```

2. Create the machine that will be used to model the system under test (SUT):

```js
import { Machine } from 'xstate';

const toggleMachine = Machine({
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

const toggleMachine = Machine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        /* ... */
      },
      meta: {
        test: async page => {
          await page.waitFor('input:checked');
        }
      }
    },
    active: {
      on: {
        /* ... */
      },
      meta: {
        test: async page => {
          await page.waitFor('input:not(:checked)');
        }
      }
    }
  }
});
```

4. Create the model:

```js
import { Machine } from 'xstate';
import { createModel } from '@xstate/test';

const toggleMachine = Machine(/* ... */);

const toggleModel = createModel(toggleMachine).withEvents({
  TOGGLE: {
    exec: async page => {
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

  testPlans.forEach(plan => {
    describe(plan.description, () => {
      plan.paths.forEach(path => {
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

## API

### `createModel(machine, options?)`

Creates an abstract testing model based on the `machine` passed in.

**Arguments**

| Argument   | Type             | Description                                    |
| ---------- | ---------------- | ---------------------------------------------- |
| `machine`  | StateMachine     | The machine used to create the abstract model. |
| `options?` | TestModelOptions | Options to customize the abstract model        |

**Methods**

`.withEvents(eventsMap)`

Provides testing details for each event. Each key in `eventsMap` is an object whose keys are event types and properties describe the execution and test cases for each event:

- `exec` (function): Function that executes the events. It is given two arguments:
  - `testContext` (any): any contextual testing data
  - `event` (EventObject): the event sent by the testing model
- `cases?` (EventObject[]): the sample event objects for this event type that can be sent by the testing model.

**Example**

```js
const toggleModel = createModel(toggleMachine).withEvents({
  TOGGLE: {
    exec: async page => {
      await page.click('input');
    }
  }
});
```

### `testModel.getShortestPathPlans(options?)`

Returns an array of testing plans based on the shortest paths from the test model's initial state to every other reachable state.

### `testModel.getSimplePathPlans(options?)`

Returns an array of testing plans based on the simple paths from the test model's initial state to every other reachable state.

### `testPlan.description`

The string description of the testing plan, describing the goal of reaching the `testPlan.state`.

### `testPlan.paths`

The testing paths to get from the test model's initial state to every other reachable state.

### `testPath.description`

The string description of the testing path, describing a sequence of events that will reach the `testPath.state`.

### `testPath.test(testContext)`

Executes each step in `testPath.segments` by:

1. Verifying that the SUT is in `segment.state`
2. Executing the event for `segment.event`

And finally, verifying that the SUT is in the target `testPath.state`.
