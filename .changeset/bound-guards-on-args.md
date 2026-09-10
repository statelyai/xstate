---
'xstate': patch
---

Named guards surfaced on transition args are now pre-bound to the current transition args. Call them with only their params — the args object is supplied automatically:

```ts
const machine = createMachine({
  context: { count: 0 },
  guards: {
    isAbove: ({ context }, threshold: number) => context.count > threshold,
    isReady: ({ context }) => context.count >= 0
  },
  initial: 'a',
  states: {
    a: {
      on: {
        NEXT: ({ guards }) => {
          // Previously: guards.isAbove(args, 3)
          if (guards.isAbove(3) && guards.isReady()) {
            return { target: 'b' };
          }
        }
      }
    },
    b: {}
  }
});
```

The declaration contract is unchanged: guard sources still receive the transition args object first, followed by any params.
