<script setup lang="ts">
import { useMachine } from '@xstate/vue';
import { tempMachine } from './tempMachine';

const { snapshot, send } = useMachine(tempMachine);
</script>

<template>
  <div>
    <label for="fahrenheit">Fahrenheit</label>
    <input @input="(event) => send({ type: 'changeF', value: event.target.value })" type="text"
      :value="snapshot.context.fahrenheit" id="fahrenheit" size="10" />
    <label for="celsius">Celsius</label>
    <input @input="(event) => send({ type: 'changeC', value: event.target.value })" :value="snapshot.context.celsius"
      type="text" id="celsius" size="10" />
  </div>
</template>