---
'xstate': patch
---

`createAsyncLogic` no longer rejects a `run` that returns a literal matching `schemas.output`. Previously a parameterless `run` widened `{ kind: 'a' }` to `{ kind: string }`, so the call failed with "not assignable to type 'never'", including inside `machine.provide({ actors })`. A `run` that does not match `schemas.output` now reports the output mismatch.

```ts
type Outcome = { kind: 'a' } | { kind: 'b'; n: number };

const load = createAsyncLogic({
  schemas: { input: types<{ id: string }>(), output: types<Outcome>() },
  run: async () => ({ kind: 'a' }) // OK, output is `Outcome`
});
```

A parameterless `run` now keeps literal return types whenever `schemas` is provided, including input-only and error-only schemas. Without `schemas`, outputs still widen (`{ ok: true }` is `{ ok: boolean }`).
