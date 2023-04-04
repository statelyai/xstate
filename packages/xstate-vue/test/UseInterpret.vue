<template>
  <button @click="service.send({ type: 'TOGGLE' })" data-testid="button">
    {{ state === 'inactive' ? 'Turn on' : 'Turn off' }}
  </button>
</template>

<script lang="ts">
import { useInterpret } from '../src/index.ts';
import { createMachine } from 'xstate';

import { defineComponent, ref } from 'vue';
const machine = createMachine({
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        TOGGLE: 'active'
      }
    },
    active: {
      on: {
        TOGGLE: 'inactive'
      }
    }
  }
});

export default defineComponent({
  setup() {
    const service = useInterpret(machine, {}, (nextState) => {
      state.value = nextState.value;
    });
    const state = ref(service.getSnapshot().value);

    return { service, state };
  }
});
</script>
