<template>
  <button @click="service.send('TOGGLE')" data-testid="button">
    {{ state === 'inactive' ? 'Turn on' : 'Turn off' }}
  </button>
</template>

<script lang="ts">
import { useInterpret } from '../src';
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
    const state = ref();
    const service = useInterpret(machine, {}, (nextState) => {
      state.value = nextState.value;
    });

    return { service, state };
  }
});
</script>
