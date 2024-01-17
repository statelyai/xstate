<template>
  <div data-testid="selected">{{ selected }}</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { createActor, fromTransition } from 'xstate';
import { useSelector } from '../src/index.ts';

const simpleActor = createActor(fromTransition((s) => s, 42));

export default defineComponent({
  setup() {
    const selected  = useSelector(simpleActor, (s) => s.context);
    return { selected };
  }
});
</script>

<style></style>
