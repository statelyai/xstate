<template>
  <div data-testid="count">{{ count }}</div>
  <button data-testid="increment" @click="store.send({ type: 'inc' })">
    Increment
  </button>
</template>

<script lang="ts">
import { Ref, defineComponent } from 'vue';
import { useSelector } from '@xstate/vue';

import { createStore } from '../src/index.ts';

export default defineComponent({
  emits: ['rerender'],
  setup() {
    const store = createStore({
      context: {
        count: 0
      },
      on: {
        inc: (ctx) => ({ count: ctx.count + 1 })
      }
    });
    const count = useSelector(store, (state) => state.context.count);

    count satisfies Ref<number>;

    return { store, count };
  }
});
</script>
