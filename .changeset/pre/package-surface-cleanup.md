---
'xstate': minor
---

### Removed

- `createFSM` and the `FSM*` types are no longer exported from the root `xstate` entry. Import them from `xstate/fsm`.
- The empty `xstate/actions`, `xstate/guards`, `xstate/invoke`, and `xstate/dev` folders are no longer published.

### Changed

- `xstate/graph`: `getStateNodes(stateNode)` is renamed to `getDescendantStateNodes(stateNode)` so it no longer shares a name with the root `getStateNodes(stateNode, stateValue)`.

```ts
import { createFSM } from 'xstate/fsm';
import { getDescendantStateNodes } from 'xstate/graph';
```
