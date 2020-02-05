<template>
  <div>
    <div data-testid="count">{{ state.context.count }}</div>
    <button data-testid="inc" @click="send('INC')">Increase</button>
  </div>
</template>

<script lang="ts">
import { useService } from '../src';
import {
  Machine,
  assign,
  Interpreter,
  spawn,
  doneInvoke,
  State,
  Service
} from 'xstate';
import { watch, ref } from '@vue/composition-api';

export default {
  props: ['service'],
  setup(props): { service: Service } {
    let { state, send } = useService(props.service);

    watch(() => {
      let currentState = useService(props.service);
      state.value = currentState.state.value;
      send = currentState.send;
    });
    return { state, send };
  }
};
</script>
