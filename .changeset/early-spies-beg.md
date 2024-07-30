---
'@xstate/store': major
---

- Replace `use-sync-external-store/shim` with `useSyncExternalStore` from React.
- Do not memoize `getSnapshot` in `useSyncExternalStore`.
- Implement `getServerSnapshot` in `useSyncExternalStore`.
- Expect `store` to always be defined in `useSelector`
- Update React types to v18 and testing library to v16.
