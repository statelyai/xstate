---
title: Input and restored snapshots
description: Start React actors with input or persisted state.
---

Pass actor options as the second hook argument.

```tsx
const [snapshot, send] = useActor(machine, {
  input: { userId },
  snapshot: persistedSnapshot
});
```

Actor input creates new initial state. A persisted snapshot restores earlier state. Do not pass both when the restored snapshot already contains the needed data.

Use input to start a profile actor for one `userId`. Use a restored snapshot to resume a checkout after a refresh.

The same options are available on an actor context provider.

```tsx
<AppActor.Provider options={{ input: { userId } }}>
  <Page />
</AppActor.Provider>
```
