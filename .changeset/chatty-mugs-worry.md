---
"@xstate/store": minor
---

Add `createSourceAtom` for read-only external snapshots. Direct and derived subscribers share one listener, released when the last consumer leaves. Plain reads do not subscribe; reconnecting refreshes the snapshot.

```ts
const isDark = createSourceAtom({
  getSnapshot: () => media.matches,
  subscribe: (notify) => {
    media.addEventListener('change', notify);
    return () => media.removeEventListener('change', notify);
  }
});
```
