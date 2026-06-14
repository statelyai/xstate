---
'@xstate/codemod': minor
'xstate': minor
---

Add `xstate migrate` — a built-in codemod CLI for upgrading XState code, no extra install required.

```sh
npx xstate migrate ./src           # apply
npx xstate migrate ./src --dry-run # preview
```

`xstate migrate` delegates to `@xstate/codemod` (fetched on demand by `npx`, so `xstate` itself keeps zero runtime dependencies). The first release automates the **Tier A renames** — 100% behavior-preserving identifier swaps — and flags anything that needs manual review:

- `interpret` → `createActor`, `Interpreter` → `Actor`
- `fromCallback`/`fromObservable`/`fromEventObservable`/`fromTransition` → `create*Logic`

Only identifiers actually imported from `xstate` (and `@xstate/react|vue|svelte|solid`) are renamed, so same-named local symbols are left untouched. `fromPromise` is intentionally **not** auto-renamed — it became config-based `createAsyncLogic({ run })`, a shape change that's reported for manual migration. The inline-function transforms (`assign`/guard/`actions` → functions) and `schemas` migration are not yet automated.
