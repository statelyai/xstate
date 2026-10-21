---
'xstate': patch
---

Named guards are now plain predicate functions. A guard receives only the arguments you pass it — the transition args object is no longer injected first. Pass values from `context` or the event explicitly:

```ts
const machine = createMachine({
  context: { count: 0 },
  guards: {
    // Previously: isAbove: (args, threshold) => args.context.count > threshold
    isAbove: (count: number, threshold: number) => count > threshold,
    isEnabled: () => true
  },
  initial: 'a',
  states: {
    a: {
      on: {
        NEXT: ({ context, guards }) => {
          if (guards.isAbove(context.count, 3) && guards.isEnabled()) {
            return { target: 'b' };
          }
        }
      }
    },
    b: {}
  }
});
```

Exception: guards referenced declaratively from serialized JSON or SCXML machines (`guard: { type, params }`) are invoked by the runtime and still receive the transition args object first, then `params` — the runtime is the caller there and has nothing else to pass.
