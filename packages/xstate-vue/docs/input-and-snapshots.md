---
title: Input and restored snapshots
description: Start Vue actors with input or persisted state.
---

Pass actor options as the second composable argument.

```ts
const { snapshot, send } = useActor(machine, {
  input: { userId },
  snapshot: persistedSnapshot
});
```

Input creates new initial state. A persisted snapshot restores earlier state.

Use input to start a profile actor for one `userId`. Use a restored snapshot to resume a checkout after a refresh.
