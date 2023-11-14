<template>
  <div>
    <div data-testid="state">{{ state.context }}</div>
    <button data-testid="button" @click="actor = createSimpleActor(100)"></button>
  </div>
</template>

<script lang="ts">
import { ActorRef, Snapshot } from 'xstate';
import { defineComponent, shallowRef } from 'vue';

import { useSelector } from '../src/index.ts';
import { createActor } from 'xstate';

const createSimpleActor = (
  value: number
): ActorRef<any, Snapshot<undefined> & { context: number }> =>
  createActor({
    transition: (s) => s,
    getInitialState: () => ({
      status: 'active',
      output: undefined,
      error: undefined,
      context: value
    }),
    getPersistedState: () => null as any
  });

export default defineComponent({
  setup() {
    const actor = shallowRef(createSimpleActor(42));
    const state = useSelector(actor, s => s)

    return { actor, state, createSimpleActor };
  }
});
</script>
