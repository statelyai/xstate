<template>
  <div>
    <div data-testid="state">{{ snapshot }}</div>
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
import { interpret } from 'xstate/src';

const createSimpleActor = (value: number): ActorRef<any, number> =>
  interpret({
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
    const { snapshot } = useActor(actor);

    return { actor, snapshot, createSimpleActor };
  }
});
</script>
