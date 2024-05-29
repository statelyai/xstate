---
'@xstate/graph': major
---

pr: #4233
author: davidkpiano
commit: 3d96d0f95

Remove `getMachineShortestPaths` and `getMachineSimplePaths`

```diff
import {
- getMachineShortestPaths,
+ getShortestPaths,
- getMachineSimplePaths,
+ getSimplePaths
} from '@xstate/graph';

-const paths = getMachineShortestPaths(machine);
+const paths = getShortestPaths(machine);

-const paths = getMachineSimplePaths(machine);
+const paths = getSimplePaths(machine);
```
