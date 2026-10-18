---
'xstate': major
---

Children invoked with inline logic no longer get a synthetic source name (`xstate.invoke.<index>.<stateId>`). Their persisted entries omit `src`, and restoring resolves them through the invoke definition with the same id among the restored active states. Restoring fails with a descriptive error when no active state, or more than one, invokes that id. Children invoked with a registered name (`src: 'fetchUser'`) keep persisting that key, and remote children still require one.

```ts
const machine = createMachine({
  id: 'shop',
  initial: 'loading',
  states: {
    loading: { invoke: { id: 'fetch', src: fetchUser } }
  }
});

createActor(machine).start().getPersistedSnapshot().children.fetch;
// { address: 'shop/fetch', snapshot: {...} }, with no `src`
```

Snapshots persisted by earlier alphas that carry `src: 'xstate.invoke.…'` no longer restore; remove that `src` or migrate them with `machineVersions`.
