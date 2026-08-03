---
title: Framework bindings
description: Use XState Store with a UI framework.
---

XState Store includes bindings for React, Vue and Solid.

```tsx
import { useSelector } from '@xstate/store-react';

const count = useSelector(store, (snapshot) => snapshot.context.count);
```

Use the matching package entry point for the framework:

- `@xstate/store-react`
- `@xstate/store-vue`
- `@xstate/store-svelte`
- `@xstate/store-solid`
- `@xstate/store-preact`
- `@xstate/store-angular`

Create the store outside a component when components should share it. Create it inside an application provider when each application instance needs separate state.
