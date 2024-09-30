---
'xstate': minor
---

Added support for synchronizers in XState, allowing state persistence and synchronization across different storage mechanisms.

- Introduced `Synchronizer` interface for implementing custom synchronization logic
- Added `sync` option to `createActor` for attaching synchronizers to actors

```ts
import { createActor } from 'xstate';
import { someMachine } from './someMachine';
import { createLocalStorageSync } from './localStorageSynchronizer';

const actor = createActor(someMachine, {
  sync: createLocalStorageSync('someKey')
});
```
