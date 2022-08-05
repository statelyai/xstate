<template>
  <div data-testid="state">{{ state }}</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { ActorRef, toActorRef } from 'xstate';
import { useActor } from '../src';
const simpleActor: ActorRef<any, number> & { latestValue: number } = toActorRef({
  send: () => {
    /* ... */
  },
  latestValue: 42,
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
    const { state } = useActor(simpleActor, (a) => a.latestValue);
    return { state };
  }
});
</script>

<style></style>
