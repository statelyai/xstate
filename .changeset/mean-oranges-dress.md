---
'xstate': minor
---

The new `TagsFrom` helper type extracts the type of `tags` from a state machine when typegen is enabled:

```ts
const machine = createMachine({
  // `tags` attached to machine via typegen
  tsTypes: {} as import('./machine.typegen').Typegen0,
  tags: ['a', 'b'],
  states: {
    idle: { tags: 'c' }
  },
});

type Tags = TagsFrom<typeof machine>; // 'a' | 'b' | 'c'
```

If typegen is not enabled, `TagsFrom` returns `string`:

```ts
const machine = createMachine({
  tags: ['a', 'b'],
  states: {
    idle: { tags: 'c' }
  }
});

type Tags = TagsFrom<typeof machine>; // string
```
