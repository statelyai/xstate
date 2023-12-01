<template>
  <button @click="send({ type: 'TOGGLE' })">
    {{ snapshot.value === 'inactive' ? 'Turn on' : 'Turn off' }}
  </button>
</template>

<script lang="ts">
import { useMachine } from '../src/index.ts';
import { createMachine } from 'xstate';
import { defineComponent } from 'vue';

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

export default defineComponent({
  setup() {
    const { snapshot, send } = useMachine(toggleMachine);
    return { snapshot, send };
  }
});
</script>
