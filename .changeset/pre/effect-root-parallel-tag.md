---
'@xstate/effect': major
---

`taggedState(...)` tags a root parallel state with the machine `id` instead of `'(machine)'`, or with `''` when the machine has no id. `TaggedState` and `StateTag` type the tag the same way.

```ts
const release = createMachine({ id: 'release', type: 'parallel', states: { review: {}, build: {} } });

Match.type<TaggedState<typeof release>>().pipe(
  Match.tag('release', () => 'in progress'), // was Match.tag('(machine)', ...)
  Match.exhaustive
);
```
