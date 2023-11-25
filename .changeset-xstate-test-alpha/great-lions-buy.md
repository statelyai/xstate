---
'@xstate/test': major
---

pr: #3036

author: @mattpocock
author: @davidkpiano

Substantially simplified how paths and plans work in `TestModel`. Changed `getShortestPlans` and `getSimplePlans` to `getShortestPaths` and `getSimplePaths`. These functions now return an array of paths, instead of an array of plans which contain paths.

Also added `getPaths`, which defaults to `getShortestPaths`. This can be passed a `pathGenerator` to customize how paths are generated.
