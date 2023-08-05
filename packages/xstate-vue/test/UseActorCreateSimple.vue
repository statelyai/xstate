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
import { ActorRef } from 'xstate';
import { defineComponent, shallowRef } from 'vue';

import { useActor } from '../src/index.ts';
import { createActor } from 'xstate';

const createSimpleActor = (value: number): ActorRef<any, number> =>
  createActor({
    transition: (s) => s,
    getSnapshot: () => value,
    getInitialState: () => value,
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
    const { state } = useActor(actor);

    return { actor, state, createSimpleActor };
  }
});
</script>
