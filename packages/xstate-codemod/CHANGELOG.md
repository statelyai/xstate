# @xstate/codemod

## 0.1.0-alpha.1

### Patch Changes

- 69b6663: Generate valid event payload schemas across member separators and preserve escaped event names. Migration helpers now use runtime imports safely with namespace imports, type-only imports, aliases, and local binding collisions. Reject syntactically invalid migration output before saving it.

## 0.1.0-alpha.0

### Minor Changes

- d000747: Add `@xstate/codemod` and the `xstate migrate` command for migrating v5 sources to v6:

  ```sh
  npx xstate migrate "src/**/*.ts"
  # or preview without writing:
  npx xstate migrate "src/**/*.ts" --dry
  ```

  Automated transforms:
  - renames `interpret` → `createActor`, `Interpreter` → `Actor`, `fromCallback`/`fromObservable`/`fromEventObservable` → `createCallbackLogic`/`createObservableLogic`/`createEventObservableLogic`
  - wraps string transition targets into object form (`on: { EVT: 'a' }` → `on: { EVT: { target: 'a' } }`), including `after`, `always`, and invoke `onDone`/`onError`
  - converts `types: {} as {...}` to `schemas` with `types<T>()`, including inline event unions to the `schemas.events` map

  Usages that need structural rewrites (`assign`, `raise`, `sendTo`, `enqueueActions`, `fromPromise`, guard combinators, …) are detected and reported with file:line and a v6 replacement hint instead of being transformed.
