<template>
  <button data-testid="changeActor" @click="changeActorRef()"></button>
  <span>{{ value }}</span>
</template>

<script lang="ts">
import { defineComponent, shallowRef } from 'vue';
import { createLogic } from 'xstate';
import { useActorRef, useSelector } from '../src/index.ts';

export default defineComponent({
  setup() {
    const actorRef1 = useActorRef(
      createLogic({
        context: 'foo',
        run: () => undefined
      })
    );
    const actorRef2 = useActorRef(
      createLogic({
        context: 'bar',
        run: () => undefined
      })
    );

    const actorRefRef = shallowRef(actorRef1);
    const value = useSelector(actorRefRef, (state) => state.context);

    return {
      value,
      changeActorRef: () => {
        if (actorRefRef.value === actorRef1) {
          actorRefRef.value = actorRef2;
        } else {
          actorRefRef.value = actorRef1;
        }
      }
    };
  }
});
</script>
