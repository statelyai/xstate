<template>
  <div>
    <div data-testid="count">{{ current.context.count }}</div>
    <button data-testid="inc" @click="send('INC')">Increase</button>
  </div>
</template>

<script lang="ts">
import { useService } from '../src/useService';
import { Machine, assign, Interpreter, spawn, doneInvoke, State, Service } from 'xstate';
import { watch, ref } from '@vue/composition-api';

export default {
  props: ['service'],
  setup(props): { service: Service } {
    let { current, send } = useService(props.service);

    watch(() => {
      let state = useService(props.service)
      current.value = state.current.value
      send = state.send
    })
    return { current, send };
  }
};
</script>
