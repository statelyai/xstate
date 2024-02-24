<script setup lang="ts">
import { useMachine } from '@xstate/vue';
import { tempMachine } from './tempMachine';

const { snapshot, send } = useMachine(tempMachine);
</script>

<template>
  <div class="case">
    <div>
      <input placeholder="..."
        @input="(event) => send({ type: 'changeC', value: (event!.target as HTMLInputElement)!.value })"
        :value="snapshot.context.celsius" type="text" id="celsius" />
      <label for="celsius">°C</label>
    </div>
    <div>
      <input placeholder="..."
        @input="(event) => send({ type: 'changeF', value: (event!.target as HTMLInputElement)!.value })" type="text"
        :value="snapshot.context.fahrenheit" id="fahrenheit" />
      <label for="fahrenheit">°F</label>
    </div>
  </div>
</template>