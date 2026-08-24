---
'xstate': major
---

Remove the deprecated `interpret` function and `Interpreter` type. Use `createActor(...)` and `Actor` (or `ActorRefFrom<...>`) instead.

```diff
- import { interpret, type Interpreter } from 'xstate';
- const actor = interpret(machine);
+ import { createActor, type Actor } from 'xstate';
+ const actor = createActor(machine);
```

(`xstate migrate` renames these automatically.)
