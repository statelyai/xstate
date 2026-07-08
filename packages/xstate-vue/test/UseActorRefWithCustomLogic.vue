<template>
  <button data-testid="count" @click="send({ type: 'INC' })">
    {{ count.context }}
  </button>
</template>

<script lang="ts">
import { useSelector, useActorRef } from '../src/index.ts';
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
    const actorRef = useActorRef(logic);
    const count = useSelector(actorRef, (s) => s);

    return { count, send: actorRef.send };
  }
});
</script>
