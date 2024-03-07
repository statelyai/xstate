<script setup lang="ts">
import { useMachine } from '@xstate/vue'
import { counterMachine } from './counterMachine';

const { snapshot, send } = useMachine(counterMachine)
</script>

<template>
    <main class="case center-children">
      <span>{{ snapshot.context.count }}</span>
      <button @click="send({ type: 'increase' })">
        +
      </button>
    </main>
</template>