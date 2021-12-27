# @xstate/graph

This package contains graph algorithms and utilities for XState machines.

- [Read the full documentation in the XState docs](https://xstate.js.org/docs/packages/xstate-graph/).
- [Read our contribution guidelines](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md).

## Quick start

1. Install `xstate` and `@xstate/graph`:

```bash
npm install xstate @xstate/graph
```

2. Import the graph utilities. Example:

```js
import { createMachine } from 'xstate';
import { getSimplePaths } from '@xstate/graph';

const machine = createMachine(/* ... */);
const paths = getSimplePaths(machine);
```
