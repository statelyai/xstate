---
"@xstate/store": minor
---

Add `createSourceAtom` for read-only external snapshots. Direct and derived subscribers share one listener, released when the last consumer leaves. Plain reads do not subscribe; reconnecting refreshes the snapshot. The source adapter can return a cleanup function or a `{ unsubscribe() }` subscription. Public atom subscriptions always return `{ unsubscribe() }`, matching existing XState subscriptions.

Failed activation remains eligible for a later atom operation. Errors delivering an async atom result are exposed through its `error` state.

```ts
const isDark = createSourceAtom({
  getSnapshot: () => media.matches,
  subscribe: (notify) => {
    media.addEventListener('change', notify);
    return () => media.removeEventListener('change', notify);
  }
});
```
