<template>
  <div data-testid="state">{{ snapshot }}</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { interpret, ActorRef } from 'xstate';

import { useSelector } from '../src/index.ts';
const simpleActor: ActorRef<any, number> = interpret({
  transition: (s) => s,
  getSnapshot: () => 42,
  getInitialState: () => 42,
  subscribe: () => {
    return {
      unsubscribe: () => {
        /* ... */
      }
    };
  }
});

export default defineComponent({
  setup() {
    const snapshot = useSelector(simpleActor, s => s);
    return { snapshot };
  }
});
</script>

<style></style>
