<template>
  <button @click="send({ type: 'TOGGLE' })">
    {{ state.value === 'inactive' ? 'Turn on' : 'Turn off' }}
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
    const { state, send } = useMachine(toggleMachine);
    return { state, send };
  }
});
</script>
