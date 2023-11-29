<template>
  <button data-testid="changeActor" @click="changeActorRef()"></button>
  <span>{{ value }}</span>
</template>

<script lang="ts">
import { defineComponent, shallowRef } from 'vue';
import { fromTransition } from 'xstate';
import { useActorRef, useSelector } from '../src/index.ts';

export default defineComponent({
  setup() {
    const actorRef1 = useActorRef(fromTransition((s) => s, 'foo'));
    const actorRef2 = useActorRef(fromTransition((s) => s, 'bar'));
    
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
