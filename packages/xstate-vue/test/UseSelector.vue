<template>
  <div data-testid="count">{{ count }}</div>
  <button data-testid="other" @click="service.send('OTHER')">Other</button>
  <button data-testid="increment" @click="service.send('INCREMENT')">
    Increment
  </button>
</template>

<script lang="ts">
import { defineComponent, onRenderTracked } from 'vue';
import { assign, createMachine } from 'xstate';
import { useInterpret, useSelector } from '../src';

const machine = createMachine<{ count: number; other: number }>({
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
      actions: assign({ other: (ctx) => ctx.other + 1 })
    },
    INCREMENT: {
      actions: assign({ count: (ctx) => ctx.count + 1 })
    }
  }
});

export default defineComponent({
  emits: ['rerender'],
  setup(props, { emit }) {
    const service = useInterpret(machine);
    const count = useSelector(service, (state) => state.context.count);

    let rerenders = 0;

    onRenderTracked(() => {
      rerenders++;
      emit('rerender', rerenders);
    });
    return { service, count };
  }
});
</script>
