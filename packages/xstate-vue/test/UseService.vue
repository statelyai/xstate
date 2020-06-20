<template>
  <div>
    <div data-testid="count">{{ state.context.count }}</div>
    <button data-testid="inc" @click="send('INC')">Increase</button>
  </div>
</template>

<script lang="ts">
import Vue, { PropType } from 'vue'
import { useService } from '../src';
import {
  Machine,
  assign,
  Interpreter,
  spawn,
  doneInvoke,
  State,
} from 'xstate';
import { watchEffect, ref, Ref } from '@vue/composition-api';

export default {
  props: {
    service: {
      type: Object as PropType<Interpreter<any>>,
    }
  },
  setup(props) {
    let { state, send } = useService(props.service);

    watchEffect(() => {
      let currentState = useService(props.service);
      state.value = currentState.state.value;
      send = currentState.send;
    });

    return { state, send };
  }
};
</script>
