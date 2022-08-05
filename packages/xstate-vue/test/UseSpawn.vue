<template>
  <button data-testid="count" @click="send({ type: 'INC' })">
    {{ count }}
  </button>
</template>

<script lang="ts">
import { useActor, useSpawn } from '../src';
import { fromReducer } from 'xstate/src/behaviors';
import { defineComponent } from 'vue';

const reducer = (state: number, event: { type: 'INC' }): number => {
  if (event.type === 'INC') {
    return state + 1;
  }
  return state;
};

const behavior = fromReducer(reducer, 0);

export default defineComponent({
  setup() {
    const actorRef = useSpawn(behavior);
    const { state: count, send } = useActor(actorRef);

    return { count, send };
  }
});
</script>
