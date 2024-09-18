---
'@xstate/store': minor
---

The `shallowEqual` comparator has been added for selector comparison:

```tsx
import { shallowEqual } from '@xstate/store';
import { useSelector } from '@xstate/store/react';

import { store } from './store';

function MyComponent() {
  const state = useSelector(
    store,
    (s) => {
      return s.items.filter(/* ... */);
    },
    shallowEqual
  );

  // ...
}
```
