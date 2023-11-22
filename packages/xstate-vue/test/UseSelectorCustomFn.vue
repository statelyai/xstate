<template>
  <div data-testid="name">{{ name }}</div>
  <button
    data-testid="sendUpper"
    @click="actorRef.send({ type: 'CHANGE', value: 'DAVID' })"
  ></button>
  <button
    data-testid="sendOther"
    @click="actorRef.send({ type: 'CHANGE', value: 'other' })"
  ></button>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { assign, createMachine } from 'xstate';
import { useActorRef, useSelector } from '../src/index.ts';

const machine = createMachine({
  initial: 'active',
  context: {
    name: 'david'
  },
  states: {
    active: {}
  },
  on: {
    CHANGE: {
      actions: assign({ name: ({ event }) => event.value })
    }
  }
});

export default defineComponent({
  setup() {
    const actorRef = useActorRef(machine);
    const name = useSelector(
      actorRef,
      (state) => state.context.name,
      (a, b) => a.toUpperCase() === b.toUpperCase()
    );
    return { actorRef, name };
  }
});
</script>
