---
'xstate': minor
---

Add `mapState(snapshot, mapper)` to map a snapshot to values based on active state(s).

```ts
import { mapState } from 'xstate';

const results = mapState(snapshot, {
  states: {
    loading: { map: () => 'Loading...' },
    success: { map: (snap) => snap.context.data },
    error: { map: (snap) => snap.context.error.message }
  }
});

console.log(results);
// E.g. if snapshot.value === 'loading', then:
// [
//   { stateNode: { key: 'loading' }, result: 'Loading...' }
// ]
```
