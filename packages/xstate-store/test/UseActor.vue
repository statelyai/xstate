<template>
  <div data-testid="count">{{ snapshot.context.count }}</div>
  <button data-testid="increment" @click="send({ type: 'inc' })">
    Increment
  </button>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { useActor } from '@xstate/vue';

import { fromStore } from '../src/index.ts';

export default defineComponent({
  emits: ['rerender'],
  setup() {
    const { snapshot, send } = useActor(
      fromStore({
        context: {
          count: 0
        },
        on: {
          inc: (ctx) => ({ count: ctx.count + 1 })
        }
      })
    );

    snapshot.value.context.count satisfies number;

    return { snapshot, send };
  }
});
</script>
