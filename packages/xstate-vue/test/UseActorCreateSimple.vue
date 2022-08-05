<template>
  <div>
    <div data-testid="state">{{ state }}</div>
    <button
      data-testid="button"
      @click="actor = createSimpleActor(100)"
    ></button>
  </div>
</template>

<script lang="ts">
import { ActorRef, toActorRef } from 'xstate';
import { defineComponent, shallowRef } from 'vue';

import { useActor } from '../src';

const createSimpleActor = (
  value: number
): ActorRef<any, number> & { latestValue: number } => toActorRef({
  send: () => {
    /* ... */
  },
  latestValue: value,
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
    const actor = shallowRef(createSimpleActor(42));
    const { state } = useActor(actor, (a) => a.latestValue);

    return { actor, state, createSimpleActor };
  }
});
</script>
