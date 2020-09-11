# @xstate/graph

## 1.2.0

### Minor Changes

- [`142f54e1`](https://github.com/davidkpiano/xstate/commit/142f54e1238919a53c73a40723c415b0044774bb) [#1366](https://github.com/davidkpiano/xstate/pull/1366) Thanks [@davidkpiano](https://github.com/davidkpiano)! - The `toDirectedGraph(...)` function was added, which converts a `machine` into an object that can be used in many different graph-based and visualization tools:

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

- [`137b0cd`](https://github.com/davidkpiano/xstate/commit/137b0cdf71054d67f0c5ba2c11021436ec3739ed) [#1033](https://github.com/davidkpiano/xstate/pull/1033) Thanks [@ZempTime](https://github.com/ZempTime)! - Added ESM build of the package which can be loaded through modern web bundlers (instead of default CommonJS files).

### Patch Changes

- Updated dependencies [[`f3ff150`](https://github.com/davidkpiano/xstate/commit/f3ff150f7c50f402704d25cdc053b76836e447e3), [`6c47b66`](https://github.com/davidkpiano/xstate/commit/6c47b66c3289ff161dc96d9b246873f55c9e18f2), [`1a129f0`](https://github.com/davidkpiano/xstate/commit/1a129f0f35995981c160d756a570df76396bfdbd), [`e88aa18`](https://github.com/davidkpiano/xstate/commit/e88aa18431629e1061b74dfd4a961b910e274e0b), [`88b17b2`](https://github.com/davidkpiano/xstate/commit/88b17b2476ff9a0fbe810df9d00db32c2241cd6e), [`d5f622f`](https://github.com/davidkpiano/xstate/commit/d5f622f68f4065a2615b5a4a1caae6b508b4840e)]:
  - xstate@4.9.0
