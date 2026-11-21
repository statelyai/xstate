# @xstate/vue

This package contains utilities for using [XState](https://github.com/statelyai/xstate) with [Vue](https://github.com/vuejs/vue).

- [Read the full documentation in the XState docs](https://stately.ai/docs/xstate-vue).
- [Read our contribution guidelines](https://github.com/statelyai/xstate/blob/main/CONTRIBUTING.md).

## :warning: Vue 2 Notice:

If you're using Vue 2.x, please see [the Vue recipe](https://xstate.js.org/docs/recipes/vue.html) instead, or use the [`xstate-vue2` package](https://github.com/ChrisShank/xstate-vue2) if you want to use the Vue Composition API.

## Requirements

<!-- supported Vue versions from package.json#peerDependencies.vue -->

Vue 3.2 or later is required. Actors stop when their owning effect scope is disposed. See [Share actors](docs/shared-actors.md) for sharing an actor across components.

## Quick start

1. Install `xstate` and `@xstate/vue`:

```bash
npm i xstate@beta @xstate/vue@beta
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
      on: { TOGGLE: { target: 'active' } }
    },
    active: {
      on: { TOGGLE: { target: 'inactive' } }
    }
  }
});

const { snapshot, send } = useMachine(toggleMachine);
</script>

<template>
  <button @click="send({ type: 'TOGGLE' })">
    {{
      snapshot.value === 'inactive'
        ? 'Click to activate'
        : 'Active! Click to deactivate'
    }}
  </button>
</template>
```

## Bind form inputs to context

Treat the snapshot from `useMachine` as read-only. Binding `v-model` directly to a nested context field bypasses the actor, so a computed guard result can stay stale until the actor publishes another snapshot.

Bind the input to a writable Vue `computed` property. Its setter sends an event. The transition returns updated context for the guard to read. This example uses Zod for its schemas (`npm i zod`).

```vue
<script setup lang="ts">
import { useMachine } from '@xstate/vue';
import { computed } from 'vue';
import { setup } from 'xstate';
import { z } from 'zod';

const formMachine = setup({
  schemas: {
    context: z.object({ formData: z.object({ name: z.string() }) }),
    events: {
      'name.changed': z.object({ value: z.string() }),
      'form.submitted': z.object({})
    }
  }
}).createMachine({
  context: { formData: { name: '' } },
  initial: 'editing',
  states: {
    editing: {
      on: {
        'name.changed': ({ context, event }) => ({
          context: {
            formData: { ...context.formData, name: event.value }
          }
        }),
        'form.submitted': ({ context }) => {
          if (!context.formData.name.trim()) return;
          return { target: 'submitted' };
        }
      }
    },
    submitted: { type: 'final' }
  }
});

const { snapshot, send } = useMachine(formMachine);
const name = computed({
  get: () => snapshot.value.context.formData.name,
  set: (value) => send({ type: 'name.changed', value })
});
const canSubmit = computed(() => snapshot.value.can({ type: 'form.submitted' }));
</script>

<template>
  <form @submit.prevent="send({ type: 'form.submitted' })">
    <label>Name <input v-model="name" /></label>
    <button type="submit" :disabled="!canSubmit">Submit</button>
    <p v-if="snapshot.matches('submitted')">Submitted</p>
  </form>
</template>
```
