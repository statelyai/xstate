---
'xstate': minor
---

Add a `filterEvents` option to `xstate/graph` traversal helpers and
`createTestModel(...)` to control which events should be explored from each
state.

This makes it possible to opt into enabled-only traversal for machine snapshots,
such as when you only want to explore events that currently pass guards:

```ts
import { createTestModel } from 'xstate/graph';

const model = createTestModel(machine);

const paths = model.getSimplePaths({
  filterEvents: (state, event) => state.can(event)
});
```
