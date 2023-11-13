<template>
  <div data-testid="state">{{ state.context }}</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { createActor, ActorRef, Snapshot, AnyActorLogic } from 'xstate';
import { useSelector } from '../src/index.ts';
const simpleActor: ActorRef<any, Snapshot<undefined> & { context: number }> =
  createActor({
    transition: (s) => s,
    getInitialState: () => {
      return {
        status: 'active',
        output: undefined,
        error: undefined,
        context: 42
      };
    },
    getPersistedState: () => null as any
  } satisfies AnyActorLogic);

export default defineComponent({
  setup() {
    const state = useSelector(simpleActor, s => s);
    return { state };
  }
});
</script>

<style></style>
