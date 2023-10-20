<template>
  <div data-testid="state">{{ state.context }}</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { createActor, ActorRef, Snapshot } from 'xstate';
import { useActor } from '../src/index.ts';
const simpleActor: ActorRef<any, Snapshot<undefined> & { context: number }> =
  createActor({
    transition: (s) => s,
    getInitialState: () => {
      return {
        status: 'active',
        output: undefined,
        error: undefined,
        context: 42
      };
    },
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
