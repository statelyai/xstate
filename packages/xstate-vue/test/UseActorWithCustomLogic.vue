<template>
  <button data-testid="count" @click="send({ type: 'INC' })">
    {{ snapshot.context }}
  </button>
</template>

<script lang="ts">
import { useActor } from '../src/index.ts';
import { createLogic } from 'xstate/actors';
import { defineComponent } from 'vue';

const reducer = (state: number, event: { type: 'INC' }): number => {
  if (event.type === 'INC') {
    return state + 1;
  }
  return state;
};

const logic = createLogic({
  context: 0,
  run: ({ context, event }) => ({
    context: reducer(context, event as { type: 'INC' })
  })
});

export default defineComponent({
  setup() {
    const { snapshot, send } = useActor(logic);

    return { snapshot, send };
  }
});
</script>
