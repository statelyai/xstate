<template>
  <button @click="send('TOGGLE')">
    {{ state.value === 'inactive' ? 'Turn on' : 'Turn off' }}
  </button>
</template>

<script lang="ts">
import { useMachine } from '../src';
import { Machine } from 'xstate';

const toggleMachine = Machine({
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

export default {
  setup() {
    const { state, send } = useMachine(toggleMachine);
    console.log(state)
    return { state, send };
  }
};
</script>
