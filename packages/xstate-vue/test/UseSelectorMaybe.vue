<template>
  <button data-testid="changeActor" @click="changeActorRef()"></button>
  <span>{{ value ?? 'nothing' }}</span>
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

    const actorRefRef = shallowRef<typeof actorRef1 | undefined>(undefined);
    const value = useSelector(actorRefRef, (state) => state?.context);

    return {
      value,
      changeActorRef: () => {
        if (actorRefRef.value === undefined) {
          actorRefRef.value = actorRef1;
        } else {
          actorRefRef.value = undefined;
        }
      }
    };
  }
});
</script>
