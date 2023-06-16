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
import { interpret } from 'xstate';
import type { ActorRef } from 'xstate';
import { defineComponent, shallowRef } from 'vue';

import { useSelector } from '../src/index.ts';

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
    const snapshot = useSelector(actor, s => s);

    return { actor, snapshot, createSimpleActor };
  }
});
</script>
