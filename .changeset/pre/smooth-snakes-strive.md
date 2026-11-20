---
'@xstate/test': minor
---

Import from `@xstate/test/paths` to generate and run deterministic test paths or replay fixtures without installing fast-check.

```ts
import { testPaths } from '@xstate/test/paths';

await testPaths(machine, { pathGenerator: 'shortest', sut });
```
