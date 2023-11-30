<template>
  <div data-testid="state">{{ state }}</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { createActor, ActorRef } from 'xstate';
import { useSelector } from '../src/index.ts';
const simpleActor: ActorRef<number, any> = createActor({
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
    const state = useSelector(simpleActor, (s) => s);
    return { state };
  }
});
</script>

<style></style>
