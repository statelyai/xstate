<template>
  <div data-testid="state">{{ state }}</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { createActor, ActorRef } from 'xstate';
import { useActor } from '../src/index.ts';
const simpleActor: ActorRef<any, number> = createActor({
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
    const { state } = useActor(simpleActor);
    return { state };
  }
});
</script>

<style></style>
