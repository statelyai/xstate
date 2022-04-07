---
'@xstate/react': major
---

This package now accepts React 18 as a peer dep and the implementation has been rewritten to use [`use-sync-external-store`](https://www.npmjs.com/package/use-sync-external-store) package. This doesn't break compatibility with older versions of React since we are using the shim to keep compatibility with those older versions.
