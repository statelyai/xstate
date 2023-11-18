# @xstate/vue

This package contains utilities for using [XState](https://github.com/statelyai/xstate) with [Vue](https://github.com/vuejs/vue).

- [Read the full documentation in the XState docs](https://xstate.js.org/docs/packages/xstate-vue/).
- [Read our contribution guidelines](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md).

## :warning: Vue 2 Notice:

If you're using Vue 2.x, please see [the Vue recipe](https://xstate.js.org/docs/recipes/vue.html) instead, or use the [`xstate-vue2` package](https://github.com/ChrisShank/xstate-vue2) if you want to use the Vue Composition API.

## Quick start

1. Install `xstate` and `@xstate/vue`:

```bash
npm i xstate @xstate/vue
```

**Via CDN**

```html
<script src="https://unpkg.com/@xstate/vue/dist/xstate-vue.min.js"></script>
```

By using the global variable `XStateVue`

2. Import the `useMachine` composition function:

```vue
<script setup>
import { useMachine } from '@xstate/vue';
import { createMachine } from 'xstate';

const toggleMachine = createMachine({
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      on: { TOGGLE: 'inactive' }
    }
  }
});

const { state, send } = useMachine(toggleMachine);
</script>

<template>
  <button @click="send('TOGGLE')">
    {{
      state.value === 'inactive'
        ? 'Click to activate'
        : 'Active! Click to deactivate'
    }}
  </button>
</template>
```
