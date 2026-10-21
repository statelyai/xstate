---
'xstate': minor
'@xstate/codemod': minor
---

Add `@xstate/codemod` and the `xstate migrate` command for migrating v5 sources to v6:

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
