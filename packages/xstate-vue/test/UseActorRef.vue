<template>
  <button @click="actor.send({ type: 'TOGGLE' })" data-testid="button">
    {{ state === 'inactive' ? 'Turn on' : 'Turn off' }}
  </button>
</template>

<script lang="ts">
import { useActorRef } from '../src/index.ts';
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
    const actor = useActorRef(machine, {}, (nextState) => {
      state.value = nextState.value;
    });
    const state = ref(actor.getSnapshot().value);

    return { actor, state };
  }
});
</script>
