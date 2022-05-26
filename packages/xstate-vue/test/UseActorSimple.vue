<template>
  <div data-testid="state">{{ state }}</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { ActorRef } from 'xstate';
import { toActorRef } from 'xstate/actors';
import { useActor } from '../src';
const simpleActor: ActorRef<any, number> = toActorRef({
  send: () => {
    /* ... */
  },
  getSnapshot: () => 42,
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
