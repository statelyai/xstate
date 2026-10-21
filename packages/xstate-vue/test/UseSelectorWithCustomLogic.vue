<template>
  <div data-testid="selected">{{ selected }}</div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { createActor, createStepLogic } from 'xstate';
import { useSelector } from '../src/index.ts';

const simpleActor = createActor(
  createStepLogic({
    context: 42,
    run: ({ context }) => ({ context })
  })
);

export default defineComponent({
  setup() {
    const selected = useSelector(simpleActor, (s) => s.context);
    return { selected };
  }
});
</script>

<style></style>
