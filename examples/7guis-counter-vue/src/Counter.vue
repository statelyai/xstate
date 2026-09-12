<script setup lang="ts">
import { useMachine } from '@xstate/vue';
import { createInspector } from '@statelyai/sdk';
import { counterMachine } from './counterMachine';

const inspector = createInspector();

const { snapshot, send } = useMachine(counterMachine, {
  inspect: inspector.inspect
});
</script>

<template>
  <main class="case center-children">
    <span>{{ snapshot.context.count }}</span>
    <button @click="send({ type: 'increase' })">+</button>
  </main>
</template>
