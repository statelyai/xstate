<template>
  <div data-testid="state">{{ state }}</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { interpret, ActorRef } from 'xstate';
import { useActor } from '../src';
const simpleActor: ActorRef<any, number> = interpret({
  transition: s => s,
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
