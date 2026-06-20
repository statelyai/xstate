# @xstate/codemod

## 0.1.0-alpha.1

### Minor Changes

- [#44](https://github.com/balrog-typescript/xstate/pull/44) [`021cc56`](https://github.com/statelyai/xstate/commit/021cc563e75d2e4d130c34e2d274565c2df6ec76) Thanks [@pull](https://github.com/apps/pull)! - Machine JSON revival now preserves more of the serialized machine definition, including delayed transitions, state timeouts, state tags, state output, invoke input, invoke completion transitions, invoke timeouts, and implementation maps passed to `createMachineFromConfig`.

  ```ts
  const machine = createMachineFromConfig(
    {
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: 'loadUser',
            input: { userId: '42' },
            onDone: { target: 'done' },
            timeout: 5000,
            onTimeout: { target: 'timedOut' }
          }
        },
        done: {},
        timedOut: {}
      }
    },
    {
      actors: { loadUser }
    }
  );
  ```

  The migration codemod now reports manual review notes for known non-rename migrations such as `fromPromise(...)`, `return assign(...)`, object-form actions/guards, and legacy `types: {}` schema declarations.

## 0.1.0-alpha.0

### Minor Changes

- [#44](https://github.com/balrog-typescript/xstate/pull/44) [`46692e3`](https://github.com/statelyai/xstate/commit/46692e3c51ed6c830a01361ef74653949d5259d6) Thanks [@pull](https://github.com/apps/pull)! - Add `xstate migrate` — a built-in codemod CLI for upgrading XState code, no extra install required.

  ```sh
  npx xstate migrate ./src           # apply
  npx xstate migrate ./src --dry-run # preview
  ```

  `xstate migrate` delegates to `@xstate/codemod` (fetched on demand by `npx`, so `xstate` itself keeps zero runtime dependencies). The first release automates the **Tier A renames** — 100% behavior-preserving identifier swaps — and flags anything that needs manual review:
  - `interpret` → `createActor`, `Interpreter` → `Actor`
  - `fromCallback`/`fromObservable`/`fromEventObservable`/`fromTransition` → `create*Logic`

  Only identifiers actually imported from `xstate` (and `@xstate/react|vue|svelte|solid`) are renamed, so same-named local symbols are left untouched. `fromPromise` is intentionally **not** auto-renamed — it became config-based `createAsyncLogic({ run })`, a shape change that's reported for manual migration. The inline-function transforms (`assign`/guard/`actions` → functions) and `schemas` migration are not yet automated.
