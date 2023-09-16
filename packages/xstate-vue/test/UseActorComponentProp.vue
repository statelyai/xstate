<template>
  <div>
    <div data-testid="actor-state">
      {{ actorState.value }}
    </div>
    <button @click="actorSend({ type: 'FINISH' })"></button>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, PropType } from 'vue';
import { useSelector } from '../src/index.ts';
import { ActorRefFrom, AnyStateMachine } from 'xstate';

export default defineComponent({
  props: {
    actor: {
      type: Object as PropType<ActorRefFrom<AnyStateMachine>>
    }
  },
  setup(props) {
    // const { state: actorState, send: actorSend } = useActor(props.actor!);
    const actorState = useSelector(props.actor!, (s) => s);

    onMounted(() => {
      props.actor!.send({ type: 'FINISH' });
    });

    return { actorState, actorSend: props.actor!.send };
  }
});
</script>
