---
"@xstate/store": minor
---

Add `createSourceAtom` for read-only external snapshots. Direct and derived subscribers share one listener, released when the last consumer leaves. Plain reads do not subscribe; reconnecting refreshes the snapshot. The source adapter returns a `{ unsubscribe() }` subscription, matching existing XState subscriptions.

```ts
const isDark = createSourceAtom({
  getSnapshot: () => media.matches,
  subscribe: (notify) => {
    media.addEventListener('change', notify);
    return { unsubscribe: () => media.removeEventListener('change', notify) };
  }
});
```
