---
'@xstate/store': minor
---

Introduce `useSelector` composable for Vue.

The Vue integration provides a `useSelector` hook that subscribes to store changes and returns a reactive ref, enabling efficient component updates when selected values change.

**Example:**

```vue
<script setup lang="ts">
import { createStore } from '@xstate/store';
import { useSelector } from '@xstate/store/vue';

// Create a store
const store = createStore({
  context: { count: 0, name: 'David' },
  on: {
    inc: (context) => ({
      ...context,
      count: context.count + 1
    })
  }
});

// Use the `useSelector` hook to subscribe to the store
const count = useSelector(store, (state) => state.context.count);
</script>

<template>
  <div>
    <p>Count: {{ count }}</p>
    <button @click="store.trigger.inc">Increment</button>
  </div>
</template>
```
