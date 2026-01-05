---
'@xstate/store-angular': major
'@xstate/store-preact': major
'@xstate/store-svelte': major
'@xstate/store-react': major
'@xstate/store-solid': major
'@xstate/store-vue': major
---

Added new framework adapter packages for `@xstate/store`:

- `@xstate/store-react` - React hook (`useSelector`, `useStore`, `useAtom`, `createStoreHook`)
- `@xstate/store-solid` - Solid.js hook (`useSelector`)
- `@xstate/store-vue` - Vue composable (`useSelector`)
- `@xstate/store-svelte` - Svelte store (`useSelector`)
- `@xstate/store-preact` - Preact hook (`useSelector`)
- `@xstate/store-angular` - Angular signal (`injectStore`)

All packages re-export `@xstate/store` for convenience.

Also deprecated:

- `@xstate/store/react` (use `@xstate/store-react` instead)
- `@xstate/store/solid` (use `@xstate/store-solid` instead)
