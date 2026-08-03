---
title: Input and restored snapshots
description: Start Solid actors with input or persisted state.
---

Pass actor options as the second helper argument.

```ts
const [snapshot, send] = useActor(machine, {
  input: { userId },
  snapshot: persistedSnapshot
});
```

Input creates new initial state. A persisted snapshot restores earlier state.
