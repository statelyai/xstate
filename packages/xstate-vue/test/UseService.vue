<template>
  <div>
    <div data-testid="count">{{ state.context.count }}</div>
    <button data-testid="inc" @click="send('INC')">Increase</button>
  </div>
</template>

<script lang="ts">
import { PropType, toRefs } from 'vue';
import { useService } from '../src';
import { Interpreter } from 'xstate';
import { watchEffect } from 'vue';

export default {
  props: {
    service: {
      type: Object as PropType<Interpreter<any>>
    }
  },
  setup(props) {
    const { service } = toRefs(props);
    let { state, send } = useService(service);


    return { state, send };
  }
};
</script>
