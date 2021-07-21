<template>
  <div data-testid="name">{{ name }}</div>
  <button
    data-testid="sendUpper"
    @click="service.send({ type: 'CHANGE', value: 'DAVID' })"
  ></button>
  <button
    data-testid="sendOther"
    @click="service.send({ type: 'CHANGE', value: 'other' })"
  ></button>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { assign, createMachine } from 'xstate';
import { useInterpret, useSelector } from '../src';

const machine = createMachine<{ name: string }>({
  initial: 'active',
  context: {
    name: 'david'
  },
  states: {
    active: {}
  },
  on: {
    CHANGE: {
      actions: assign({ name: (_, e) => e.value })
    }
  }
});

export default defineComponent({
  setup() {
    const service = useInterpret(machine);
    const name = useSelector(
      service,
      (state) => state.context.name,
      (a, b) => a.toUpperCase() === b.toUpperCase()
    );
    return { service, name };
  }
});
</script>
