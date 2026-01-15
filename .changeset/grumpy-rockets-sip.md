---
'@xstate/store': minor
---

Added new framework adapter packages for `@xstate/store` and deprecated:

- `@xstate/store/react` (use `@xstate/store-react` instead)
- `@xstate/store/solid` (use `@xstate/store-solid` instead)

```diff
- import { useSelector } from '@xstate/store/react';
+ import { useSelector } from '@xstate/store-react';
```

```diff
- import { useSelector } from '@xstate/store/solid';
+ import { useSelector } from '@xstate/store-solid';
```
