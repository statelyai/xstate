# @xstate/graph

## 3.0.4

### Patch Changes

- Updated dependencies [[`479c74b83fa77c57c48f54cf0e9dcfab5fe6cae5`](https://github.com/statelyai/xstate/commit/479c74b83fa77c57c48f54cf0e9dcfab5fe6cae5)]:
  - xstate@5.19.4

## 3.0.3

### Patch Changes

- Updated dependencies [[`b453b2d72ba12d0fe46a995f9ccced8000fd0cc9`](https://github.com/statelyai/xstate/commit/b453b2d72ba12d0fe46a995f9ccced8000fd0cc9)]:
  - xstate@5.19.3

## 3.0.2

### Patch Changes

- Updated dependencies [[`d99df1d8f4fe49145c9974465b65028bf19b365f`](https://github.com/statelyai/xstate/commit/d99df1d8f4fe49145c9974465b65028bf19b365f)]:
  - xstate@5.19.2

## 3.0.1

### Patch Changes

- Updated dependencies [[`bf6119a7310a878afbf4f5b01f5e24288f9a0f16`](https://github.com/statelyai/xstate/commit/bf6119a7310a878afbf4f5b01f5e24288f9a0f16)]:
  - xstate@5.19.1

## 3.0.0

### Patch Changes

- Updated dependencies [[`8c4b70652acaef2702f32435362e4755679a516d`](https://github.com/statelyai/xstate/commit/8c4b70652acaef2702f32435362e4755679a516d)]:
  - xstate@5.19.0

## 2.0.1

### Patch Changes

- Updated dependencies [[`25963966c394fc904dc9b701a420b6e204ebe7f7`](https://github.com/statelyai/xstate/commit/25963966c394fc904dc9b701a420b6e204ebe7f7)]:
  - xstate@5.18.2

## 2.0.0

### Major Changes

- [#4896](https://github.com/statelyai/xstate/pull/4896) [`7c6e2ea`](https://github.com/statelyai/xstate/commit/7c6e2ea) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Test model path generation now has the option to allow duplicate paths by setting `allowDuplicatePaths: true`:

  ```ts
  const paths = model.getSimplePaths({
    allowDuplicatePaths: true
  });
  // a
  // a -> b
  // a -> b -> c
  // a -> d
  // a -> d -> e
  ```

  By default, `allowDuplicatePaths` is set to `false`:

  ```ts
  const paths = model.getSimplePaths();
  // a -> b -> c
  // a -> d -> e
  ```

- [#4896](https://github.com/statelyai/xstate/pull/4896) [`7c6e2ea`](https://github.com/statelyai/xstate/commit/7c6e2ea) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `adjacencyMapToArray(…)` helper function has been introduced, which converts an adjacency map to an array of `{ state, event, nextState }` objects.

  ```ts
  import { getAdjacencyMap, adjacencyMapToArray } from '@xstate/graph';

  const machine = createMachine({
    initial: 'green',
    states: {
      green: {
        on: {
          TIMER: 'yellow'
        }
      },
      yellow: {
        on: {
          TIMER: 'red'
        }
      },
      red: {
        on: {
          TIMER: 'green'
        }
      }
    }
  });

  const arr = adjacencyMapToArray(getAdjacencyMap(machine));
  // [
  //   {
  //     "state": {value: "green", ... },
  //     "event": { type: "TIMER" },
  //     "nextState": { value: "yellow", ... }
  //   },
  //   {
  //     "state": {value: "yellow", ... },
  //     "event": { type: "TIMER" },
  //     "nextState": { value: "red", ... }
  //   },
  //   {
  //     "state": {value: "red", ... },
  //     "event": { type: "TIMER" },
  //     "nextState": { value: "green", ... }
  //   },
  //   {
  //     "state": {value: "green", ... },
  //     "event": { type: "TIMER" },
  //     "nextState": { value: "yellow", ... }
  //   },
  // ]
  ```

- [#4896](https://github.com/statelyai/xstate/pull/4896) [`7c6e2ea`](https://github.com/statelyai/xstate/commit/7c6e2ea) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `traversalLimit` option has been renamed to `limit`:

  ```diff
  model.getShortestPaths({
  - traversalLimit: 100
  + limit: 100
  });
  ```

- [#4233](https://github.com/statelyai/xstate/pull/4233) [`3d96d0f95`](https://github.com/statelyai/xstate/commit/3d96d0f95) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Remove `getMachineShortestPaths` and `getMachineSimplePaths`

  ```diff
  import {
  - getMachineShortestPaths,
  + getShortestPaths,
  - getMachineSimplePaths,
  + getSimplePaths
  } from '@xstate/graph';

  -const paths = getMachineShortestPaths(machine);
  +const paths = getShortestPaths(machine);

  -const paths = getMachineSimplePaths(machine);
  +const paths = getSimplePaths(machine);
  ```

- [#4238](https://github.com/statelyai/xstate/pull/4238) [`b4f12a517`](https://github.com/statelyai/xstate/commit/b4f12a517) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The steps in the paths returned from functions like `getShortestPaths(...)` and `getSimplePaths(...)` have the following changes:

  - The `step.event` property now represents the `event` object that resulted in the transition to the `step.state`, _not_ the event that comes before the next step.
  - The `path.steps` array now includes the target `path.state` as the last step.
    - Note: this means that `path.steps` always has at least one step.
  - The first `step` now has the `{ type: 'xstate.init' }` event

- [#4896](https://github.com/statelyai/xstate/pull/4896) [`7c6e2ea`](https://github.com/statelyai/xstate/commit/7c6e2ea) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `createTestMachine(…)` function has been removed. Use a normal `createMachine(…)` or `setup(…).createMachine(…)` function instead to create machines for path generation.

- [#4896](https://github.com/statelyai/xstate/pull/4896) [`7c6e2ea`](https://github.com/statelyai/xstate/commit/7c6e2ea) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `filter` and `stopCondition` option for path generation has been renamed to `stopWhen`, which is used to stop path generation when a condition is met. This is a breaking change, but it is a more accurate name for the option.

  ```diff
  const shortestPaths = getShortestPaths(machine, {
    events: [{ type: 'INC' }],
  - filter: (state) => state.context.count < 5
  - stopCondition: (state) => state.context.count < 5
  + stopWhen: (state) => state.context.count === 5
  });
  ```

- [#4896](https://github.com/statelyai/xstate/pull/4896) [`7c6e2ea`](https://github.com/statelyai/xstate/commit/7c6e2ea) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Path generation now supports `input` for actor logic:

  ```ts
  const model = createTestModel(
    setup({
      types: {
        input: {} as {
          name: string;
        },
        context: {} as {
          name: string;
        }
      }
    }).createMachine({
      context: (x) => ({
        name: x.input.name
      }),
      initial: 'checking',
      states: {
        checking: {
          always: [
            { guard: (x) => x.context.name.length > 3, target: 'longName' },
            { target: 'shortName' }
          ]
        },
        longName: {},
        shortName: {}
      }
    })
  );

  const path1 = model.getShortestPaths({
    input: { name: 'ed' }
  });

  expect(path1[0].steps.map((s) => s.state.value)).toEqual(['shortName']);

  const path2 = model.getShortestPaths({
    input: { name: 'edward' }
  });

  expect(path2[0].steps.map((s) => s.state.value)).toEqual(['longName']);
  ```

- [#4896](https://github.com/statelyai/xstate/pull/4896) [`7c6e2ea`](https://github.com/statelyai/xstate/commit/7c6e2ea) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The test model "sync" methods have been removed, including:

  - `testModel.testPathSync(…)`
  - `testModel.testStateSync(…)`
  - `testPath.testSync(…)`

  The `async` methods should always be used instead.

  ```diff
  model.getShortestPaths().forEach(async (path) => {
  - model.testPathSync(path, {
  + await model.testPath(path, {
      states: { /* ... */ },
      events: { /* ... */ },
    });
  })
  ```

### Minor Changes

- [#3727](https://github.com/statelyai/xstate/pull/3727) [`5fb3c683d`](https://github.com/statelyai/xstate/commit/5fb3c683d) Thanks [@Andarist](https://github.com/Andarist)! - `exports` field has been added to the `package.json` manifest. It limits what files can be imported from a package - it's no longer possible to import from files that are not considered to be a part of the public API.

### Patch Changes

- [#4896](https://github.com/statelyai/xstate/pull/4896) [`7c6e2ea`](https://github.com/statelyai/xstate/commit/7c6e2ea) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `@xstate/graph` package now includes everything from `@xstate/test`.

- [#4308](https://github.com/statelyai/xstate/pull/4308) [`af032db12`](https://github.com/statelyai/xstate/commit/af032db12) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Traversing state machines that have delayed transitions will now work as expected:

  ```ts
  const machine = createMachine({
    initial: 'a',
    states: {
      a: {
        after: {
          1000: 'b'
        }
      },
      b: {}
    }
  });

  const paths = getShortestPaths(machine); // works
  ```

## 2.0.0-beta.6

### Minor Changes

- [`58e945f70`](https://github.com/statelyai/xstate/commit/58e945f7097fbb8a16e13527a0808ffeabaa8a60) Thanks [@Andarist](https://github.com/Andarist)! - New version compatible with XState v5.

## 2.0.0-beta.5

### Patch Changes

- [#4308](https://github.com/statelyai/xstate/pull/4308) [`af032db12`](https://github.com/statelyai/xstate/commit/af032db12057415955b0bf0487edc48ba570408d) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Traversing state machines that have delayed transitions will now work as expected:

  ```ts
  const machine = createMachine({
    initial: 'a',
    states: {
      a: {
        after: {
          1000: 'b'
        }
      },
      b: {}
    }
  });

  const paths = getShortestPaths(machine); // works
  ```

## 2.0.0-beta.4

### Major Changes

- [#4238](https://github.com/statelyai/xstate/pull/4238) [`b4f12a517`](https://github.com/statelyai/xstate/commit/b4f12a517dcb2a70200de4fb33d0a5958ff22333) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The steps in the paths returned from functions like `getShortestPaths(...)` and `getSimplePaths(...)` have the following changes:

  - The `step.event` property now represents the `event` object that resulted in the transition to the `step.state`, _not_ the event that comes before the next step.
  - The `path.steps` array now includes the target `path.state` as the last step.
    - Note: this means that `path.steps` always has at least one step.
  - The first `step` now has the `{ type: 'xstate.init' }` event

## 2.0.0-beta.3

### Major Changes

- [#4233](https://github.com/statelyai/xstate/pull/4233) [`3d96d0f95`](https://github.com/statelyai/xstate/commit/3d96d0f95f7f2a7f7dd872d756a5eba1f61a072f) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Remove `getMachineShortestPaths` and `getMachineSimplePaths`

  ```diff
  import {
  - getMachineShortestPaths,
  + getShortestPaths,
  - getMachineSimplePaths,
  + getSimplePaths
  } from '@xstate/graph';

  -const paths = getMachineShortestPaths(machine);
  +const paths = getShortestPaths(machine);

  -const paths = getMachineSimplePaths(machine);
  +const paths = getSimplePaths(machine);
  ```

## 2.0.0-alpha.2

### Patch Changes

- [#3992](https://github.com/statelyai/xstate/pull/3992) [`fc076d82f`](https://github.com/statelyai/xstate/commit/fc076d82f4646c3285455c33200d84f804c17f36) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Fixed an internal import to not import from `xstate/src`

## 2.0.0-alpha.1

### Patch Changes

- [#3864](https://github.com/statelyai/xstate/pull/3864) [`59f3a8e`](https://github.com/statelyai/xstate/commit/59f3a8e) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Event cases are now specified as an array of event objects, instead of an object with event types as keys and event object payloads as values:

  ```diff
  const shortestPaths = getShortestPaths(someMachine, {
  - eventCases: {
  -   click: [{ x: 10, y: 10 }, { x: 20, y: 20 }]
  - }
  + events: [
  +   { type: 'click', x: 10, y: 10 },
  +   { type: 'click', x: 20, y: 20 }
  + ]
  });
  ```

## 2.0.0-alpha.0

### Major Changes

- [#3036](https://github.com/statelyai/xstate/pull/3036) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Renamed `getAdjacencyMap` to `getValueAdjacencyMap`.

- [#3036](https://github.com/statelyai/xstate/pull/3036) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Changed `getSimplePaths` to `getSimplePlans`, and `getShortestPaths` to `getShortestPlans`. Both of these functions can be passed a machine, and return `StatePlan[]`.

  Added functions `traverseSimplePlans`, `traverseShortestPlans`,`traverseShortestPlansFromTo`, `traverseSimplePlansTo` and `traverseSimplePlansFromTo`, which can be passed a `Behavior` and return `StatePlan[]`.

## 1.4.2

### Patch Changes

- [#3089](https://github.com/statelyai/xstate/pull/3089) [`862697e29`](https://github.com/statelyai/xstate/commit/862697e2990934d46050580d7e09c749d09d8426) Thanks [@Andarist](https://github.com/Andarist)! - Fixed compatibility with Skypack by exporting some shared utilities from root entry of XState and consuming them directly in other packages (this avoids accessing those things using deep imports and thus it avoids creating those compatibility problems).

## 1.4.1

### Patch Changes

- [#2957](https://github.com/statelyai/xstate/pull/2957) [`8550ddda7`](https://github.com/statelyai/xstate/commit/8550ddda73e2ad291e19173d7fa8d13e3336fbb9) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The repository links have been updated from `github.com/davidkpiano` to `github.com/statelyai`.

## 1.4.0

### Minor Changes

- [#2703](https://github.com/statelyai/xstate/pull/2703) [`6a0ff73bf`](https://github.com/statelyai/xstate/commit/6a0ff73bf8817dc401ef9b45c71dd7875dbc9f20) Thanks [@Silverwolf90](https://github.com/Silverwolf90)! - Add getPathFromEvents to generate a path from a sequence of events.

## 1.3.0

### Minor Changes

- [`111a7d13`](https://github.com/statelyai/xstate/commit/111a7d138db909e969629a3c237b952850c008ca) [#1663](https://github.com/statelyai/xstate/pull/1663) Thanks [@davidkpiano](https://github.com/statelyai)! - Options passed into graph functions (e.g., `getShortestPaths(machine, options)`) can now resolve `.events` based on the `state`:

  ```js
  const countMachine = createMachine({
    initial: 'active',
    context: {
      count: 0
    },
    states: {
      active: {
        on: {
          ADD: {
            actions: assign({
              count: (context, event) => {
                return context.count + event.value;
              }
            })
          }
        }
      }
    }
  });

  const shortestPaths = getShortestPaths(countMachine, {
    events: {
      ADD: (state) => {
        // contrived example: if `context.count` is >= 10, increment by 10
        return state.context.count >= 10
          ? [{ type: 'ADD', value: 10 }]
          : [{ type: 'ADD', value: 1 }];
      }
    }
  });

  // The keys to the shortest paths will look like:
  // "active" | { count: 0 }
  // "active" | { count: 1 }
  // "active" | { count: 2 }
  // ...
  // "active" | { count: 10 }
  // "active" | { count: 20 }
  // "active" | { count: 30 }
  ```

## 1.2.0

### Minor Changes

- [`142f54e1`](https://github.com/statelyai/xstate/commit/142f54e1238919a53c73a40723c415b0044774bb) [#1366](https://github.com/statelyai/xstate/pull/1366) Thanks [@davidkpiano](https://github.com/statelyai)! - The `toDirectedGraph(...)` function was added, which converts a `machine` into an object that can be used in many different graph-based and visualization tools:

  ```js
  import { toDirectedGraph } from '@xstate/graph';

  const machine = createMachine({/* ... */});

  const digraph = toDirectedGraph(machine);

  // returns an object with this structure:
  {
    id: '...',
    stateNode: /* StateNode */,
    children: [
      { id: '...', children: [/* ... */], edges: [/* ... */] },
      { id: '...', /* ... */ },
      // ...
    ],
    edges: [
      { source: /* ... */, target: /* ... */, transition: /* ... */ }
      // ...
    ]
  }
  ```

## 1.1.0

### Minor Changes

- [`137b0cd`](https://github.com/statelyai/xstate/commit/137b0cdf71054d67f0c5ba2c11021436ec3739ed) [#1033](https://github.com/statelyai/xstate/pull/1033) Thanks [@ZempTime](https://github.com/ZempTime)! - Added ESM build of the package which can be loaded through modern web bundlers (instead of default CommonJS files).

### Patch Changes

- Updated dependencies [[`f3ff150`](https://github.com/statelyai/xstate/commit/f3ff150f7c50f402704d25cdc053b76836e447e3), [`6c47b66`](https://github.com/statelyai/xstate/commit/6c47b66c3289ff161dc96d9b246873f55c9e18f2), [`1a129f0`](https://github.com/statelyai/xstate/commit/1a129f0f35995981c160d756a570df76396bfdbd), [`e88aa18`](https://github.com/statelyai/xstate/commit/e88aa18431629e1061b74dfd4a961b910e274e0b), [`88b17b2`](https://github.com/statelyai/xstate/commit/88b17b2476ff9a0fbe810df9d00db32c2241cd6e), [`d5f622f`](https://github.com/statelyai/xstate/commit/d5f622f68f4065a2615b5a4a1caae6b508b4840e)]:
  - xstate@4.9.0
