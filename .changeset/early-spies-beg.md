---
'@xstate/store': patch
---

- replace use-sync-external-store/shim with useSyncExternalStore from react
- do not memoize getSnapshot in uSES
- implement getServerSnapshot in uSES
- expect store to always be defined
- update react types to v18 and testing library to v16
