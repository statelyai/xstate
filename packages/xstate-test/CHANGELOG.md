# @xstate/test

## 1.0.0-beta.4

### Patch Changes

- Updated dependencies [[`af032db12`](https://github.com/statelyai/xstate/commit/af032db12057415955b0bf0487edc48ba570408d)]:
  - @xstate/graph@2.0.0-beta.5

## 1.0.0-beta.3

### Patch Changes

- Updated dependencies [[`b4f12a517`](https://github.com/statelyai/xstate/commit/b4f12a517dcb2a70200de4fb33d0a5958ff22333)]:
  - @xstate/graph@2.0.0-beta.4

## 1.0.0-beta.2

### Patch Changes

- Updated dependencies [[`3d96d0f95`](https://github.com/statelyai/xstate/commit/3d96d0f95f7f2a7f7dd872d756a5eba1f61a072f)]:
  - @xstate/graph@2.0.0-beta.3

## 1.0.0-alpha.1

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

- Updated dependencies [[`59f3a8ece`](https://github.com/statelyai/xstate/commit/59f3a8ecee83ec838040de1920b527c8bf6a803e)]:
  - @xstate/graph@2.0.0-alpha.1

## 1.0.0-alpha.0

### Major Changes

- [#3036](https://github.com/statelyai/xstate/pull/3036) Thanks [@mattpocock](https://github.com/mattpocock), [@davidkpiano](https://github.com/davidkpiano)! - Substantially simplified how paths and plans work in `TestModel`. Changed `getShortestPlans` and `getSimplePlans` to `getShortestPaths` and `getSimplePaths`. These functions now return an array of paths, instead of an array of plans which contain paths.

  Also added `getPaths`, which defaults to `getShortestPaths`. This can be passed a `pathGenerator` to customize how paths are generated.

- [#3036](https://github.com/statelyai/xstate/pull/3036) Thanks [@mattpocock](https://github.com/mattpocock)! - Moved event cases out of `events`, and into their own attribute called `eventCases`:

  ```ts
  const model = createTestModel(machine, {
    eventCases: {
      CHOOSE_CURRENCY: [
        {
          currency: 'GBP'
        },
        {
          currency: 'USD'
        }
      ]
    }
  });

  model.getPaths().forEach((path) => {
    it(path.description, async () => {
      await path.test({
        events: {
          CHOOSE_CURRENCY: ({ event }) => {
            console.log(event.currency);
          }
        }
      });
    });
  });
  ```

  `eventCases` will also now always produce a new path, instead of only creating a path for the first case which matches.

- [#3036](https://github.com/statelyai/xstate/pull/3036) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Removed `.testCoverage()`, and instead made `getPlans`, `getShortestPlans` and `getSimplePlans` cover all states and transitions enabled by event cases by default.

- [#3036](https://github.com/statelyai/xstate/pull/3036) Thanks [@davidkpiano](https://github.com/davidkpiano)! - Added validation on `createTestModel` to ensure that you don't include invalid machine configuration in your test machine. Invalid machine configs include `invoke`, `after`, and any actions with a `delay`.

  Added `createTestMachine`, which provides a slimmed-down API for creating machines which removes these types from the config type signature.

- [#3036](https://github.com/statelyai/xstate/pull/3036) Thanks [@davidkpiano](https://github.com/davidkpiano)! - `getShortestPaths()` and `getPaths()` will now traverse all _transitions_ by default, not just all events.

  Take this machine:

  ```ts
  const machine = createTestMachine({
    initial: 'toggledOn',
    states: {
      toggledOn: {
        on: {
          TOGGLE: 'toggledOff'
        }
      },
      toggledOff: {
        on: {
          TOGGLE: 'toggledOn'
        }
      }
    }
  });
  ```

  In `@xstate/test` version 0.x, this would run this path by default:

  ```txt
  toggledOn -> TOGGLE -> toggledOff
  ```

  This is because it satisfies two conditions:

  1. Covers all states
  2. Covers all events

  But this a complete test - it doesn't test if going from `toggledOff` to `toggledOn` works.

  Now, we seek to cover all transitions by default. So the path would be:

  ```txt
  toggledOn -> TOGGLE -> toggledOff -> TOGGLE -> toggledOn
  ```

- [#3036](https://github.com/statelyai/xstate/pull/3036) Thanks [@mattpocock](https://github.com/mattpocock), [@davidkpiano](https://github.com/davidkpiano)! - Moved `events` from `createTestModel` to `path.test`.

  Old:

  ```ts
  const model = createTestModel(machine, {
    events: {}
  });
  ```

  New:

  ```ts
  const paths = model.getPaths().forEach((path) => {
    path.test({
      events: {}
    });
  });
  ```

  This allows for easier usage of per-test mocks and per-test context.

- [#3036](https://github.com/statelyai/xstate/pull/3036) Thanks [@mattpocock](https://github.com/mattpocock), [@davidkpiano](https://github.com/davidkpiano)! - Added `states` to `path.test()`:

  ```ts
  const paths = model.getPaths().forEach((path) => {
    path.test({
      states: {
        myState: () => {},
        'myState.deep': () => {}
      }
    });
  });
  ```

  This allows you to define your tests outside of your machine, keeping the machine itself easy to read.

### Minor Changes

- [#3036](https://github.com/statelyai/xstate/pull/3036) Thanks [@mattpocock](https://github.com/mattpocock), [@davidkpiano](https://github.com/davidkpiano)! - Added `path.testSync(...)` to allow for testing paths in sync-only environments, such as Cypress.

### Patch Changes

- Updated dependencies [[`ae673e443`](https://github.com/statelyai/xstate/commit/ae673e443aab1e42e26fbe16ea1e9dab784d99be), [`ae673e443`](https://github.com/statelyai/xstate/commit/ae673e443aab1e42e26fbe16ea1e9dab784d99be)]:
  - @xstate/graph@2.0.0-alpha.0

## 0.5.1

### Patch Changes

- [#2957](https://github.com/statelyai/xstate/pull/2957) [`8550ddda7`](https://github.com/statelyai/xstate/commit/8550ddda73e2ad291e19173d7fa8d13e3336fbb9) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The repository links have been updated from `github.com/davidkpiano` to `github.com/statelyai`.

- Updated dependencies [[`8550ddda7`](https://github.com/statelyai/xstate/commit/8550ddda73e2ad291e19173d7fa8d13e3336fbb9)]:
  - @xstate/graph@1.4.1

## 0.5.0

### Minor Changes

- [#2703](https://github.com/statelyai/xstate/pull/2703) [`d928cbb1f`](https://github.com/statelyai/xstate/commit/d928cbb1fe93b0d34a399ab65c8b2b1eeb3ca83d) Thanks [@Silverwolf90](https://github.com/Silverwolf90)! - Add getPlanFromEvents to generate a test plan with a single path from an explicitly defined sequence of events.

### Patch Changes

- Updated dependencies [[`6a0ff73bf`](https://github.com/statelyai/xstate/commit/6a0ff73bf8817dc401ef9b45c71dd7875dbc9f20)]:
  - @xstate/graph@1.4.0

## 0.4.2

### Patch Changes

- [`4105d923`](https://github.com/statelyai/xstate/commit/4105d923dfddd9ac3ffad33295edea38b0215c89) [#1930](https://github.com/statelyai/xstate/pull/1930) Thanks [@jimwheaton](https://github.com/jimwheaton)! - Fixes issue where 'final' state node names were not shown in test plan description

## 0.4.1

### Patch Changes

- [`ca8841a5`](https://github.com/statelyai/xstate/commit/ca8841a5da6560f2956b0dfa08eb05252ad1eca5) [#1273](https://github.com/statelyai/xstate/pull/1273) Thanks [@rpradal](https://github.com/rpradal)! - `TestPath` interface got exported to be publicly available.

## 0.4.0

### Minor Changes

- [`137b0cd`](https://github.com/statelyai/xstate/commit/137b0cdf71054d67f0c5ba2c11021436ec3739ed) [#1033](https://github.com/statelyai/xstate/pull/1033) Thanks [@ZempTime](https://github.com/ZempTime)! - Added ESM build of the package which can be loaded through modern web bundlers (instead of default CommonJS files).

### Patch Changes

- Updated dependencies [[`f3ff150`](https://github.com/statelyai/xstate/commit/f3ff150f7c50f402704d25cdc053b76836e447e3), [`6c47b66`](https://github.com/statelyai/xstate/commit/6c47b66c3289ff161dc96d9b246873f55c9e18f2), [`1a129f0`](https://github.com/statelyai/xstate/commit/1a129f0f35995981c160d756a570df76396bfdbd), [`e88aa18`](https://github.com/statelyai/xstate/commit/e88aa18431629e1061b74dfd4a961b910e274e0b), [`88b17b2`](https://github.com/statelyai/xstate/commit/88b17b2476ff9a0fbe810df9d00db32c2241cd6e), [`137b0cd`](https://github.com/statelyai/xstate/commit/137b0cdf71054d67f0c5ba2c11021436ec3739ed), [`d5f622f`](https://github.com/statelyai/xstate/commit/d5f622f68f4065a2615b5a4a1caae6b508b4840e)]:
  - xstate@4.9.0
  - @xstate/graph@1.1.0

## 0.3.0

### Minor Changes

- 1405754: Options for `testModel.getCoverage()` and `testModel.testCoverage()` can now be provided to filter which state nodes should be covered by the tests.

### Patch Changes

- 0741d7e: Added "types" to package.json
- Updated dependencies [dae8818]
  - xstate@4.7.6

## 0.2.1

### Patch Changes

- fc2a78c: Fix description text if no meta description is given
- Updated dependencies [6b3d767]
  - xstate@4.7.5
