<template>
  <div>
    <div data-testid="count">{{ state.context.count }}</div>
    <button data-testid="inc" @click="send('INC')">Increase</button>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, toRefs, Ref } from 'vue';
import { useService } from '../src';
import { Interpreter } from 'xstate';

export default defineComponent({
  props: {
    service: {
      type: Object as PropType<Interpreter<any>>
    }
  },
  setup(props) {
    const serviceRef = toRefs(props).service as Ref<typeof props.service>;
    let { state, send } = useService(serviceRef);

    return { state, send };
  }
});
</script>
