<template>
  <div data-testid="count">{{ count }}</div>
  <button data-testid="other" @click="actorRef.send({ type: 'OTHER' })">
    Other
  </button>
  <button data-testid="increment" @click="actorRef.send({ type: 'INCREMENT' })">
    Increment
  </button>
</template>

<script lang="ts">
import { defineComponent, onRenderTracked } from 'vue';
import { assign, createMachine } from 'xstate';
import { useActorRef, useSelector } from '../src/index.ts';

const machine = createMachine({
  initial: 'active',
  context: {
    other: 0,
    count: 0
  },
  states: {
    active: {}
  },
  on: {
    OTHER: {
      actions: assign({ other: ({ context }) => context.other + 1 })
    },
    INCREMENT: {
      actions: assign({ count: ({ context }) => context.count + 1 })
    }
  }
});

export default defineComponent({
  emits: ['rerender'],
  setup(_props, { emit }) {
    const actorRef = useActorRef(machine);
    const count = useSelector(actorRef, (state) => state.context.count);

    let rerenders = 0;

    onRenderTracked(() => {
      rerenders++;
      emit('rerender', rerenders);
    });
    return { actorRef, count };
  }
});
</script>
