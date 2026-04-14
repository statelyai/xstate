---
'xstate': minor
---

V6: Allow mutating `context` directly inside transition, entry, and exit functions.

The `context` argument to transition functions is now a copy-on-write draft. Mutating it produces a new immutable context for the next snapshot, while leaving unmutated subtrees referentially equal to the previous snapshot's context (preserving selector equality in framework integrations).

```ts
on: {
  INC: ({ context }) => {
    context.count++;
  };
}
```

The previous explicit-return form continues to work and takes precedence when both are used:

```ts
on: {
  INC: ({ context }) => ({
    context: { ...context, count: context.count + 1 }
  });
}
```

Mutation of plain objects and arrays is supported. Class instances, `Map`/`Set`, and `ActorRef` values in context are passed through as-is and are not draftable.
