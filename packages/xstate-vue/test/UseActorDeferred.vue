<template>
  <div data-testid="actor-state">
    {{ actorState.value }}
  </div>
  <button @click="actorSend({ type: 'FINISH' })"></button>
</template>

<script lang="ts">
import { defineComponent, onMounted } from 'vue';
import { useActor } from '../src';

export default defineComponent({
  props: {
    actor: {
      type: Object
    }
  },
  setup(props) {
    const { state: actorState, send: actorSend } = useActor(props.actor as any);

    onMounted(() => {
      actorSend({ type: 'FINISH' });
    });

    return { actorState, actorSend };
  }
});
</script>
