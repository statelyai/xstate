<script setup lang="ts">
import { useMachine } from '@xstate/vue';
import { createBrowserInspector } from '@statelyai/inspect';
import { counterMachine } from './counterMachine';

const inspector = createBrowserInspector();

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
