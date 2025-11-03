---
'xstate': minor
---

Add `setup.extend()` method to incrementally extend machine setup configurations with additional actions, guards, and delays. This enables composable and reusable machine setups where extended actions, guards, and delays can reference base actions, guards, and delays and support chaining multiple extensions:

```ts
import { setup, not, and } from 'xstate';

const baseSetup = setup({
  guards: {
    isAuthenticated: () => true,
    hasPermission: () => false
  }
});

const extendedSetup = baseSetup.extend({
  guards: {
    // Type-safe guard references
    isUnauthenticated: not('isAuthenticated'),
    canAccess: and(['isAuthenticated', 'hasPermission'])
  }
});

// Both base and extended guards are available
extendedSetup.createMachine({
  on: {
    LOGIN: {
      guard: 'isAuthenticated',
      target: 'authenticated'
    },
    LOGOUT: {
      guard: 'isUnauthenticated',
      target: 'unauthenticated'
    }
  }
});
```
