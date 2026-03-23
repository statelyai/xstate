<template>
  <div data-testid="count">{{ count }}</div>
  <button data-testid="increment" @click="actorRef.send({ type: 'inc' })">
    Increment
  </button>
</template>

<script lang="ts">
import { Ref, defineComponent } from 'vue';
import { useActorRef, useSelector } from '@xstate/vue';

import { fromStore } from '../src/index.ts';

export default defineComponent({
  emits: ['rerender'],
  setup() {
    const actorRef = useActorRef(
      fromStore({
        context: {
          count: 0
        },
        on: {
          inc: (ctx) => ({ count: ctx.count + 1 })
        }
      })
    );
    const count = useSelector(actorRef, (s) => s.context.count);

    count satisfies Ref<number>;

    return { count, actorRef };
  }
});
</script>
