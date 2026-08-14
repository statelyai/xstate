<script setup lang="ts">
import { useMachine } from '@xstate/vue';
import { createBrowserInspector } from '@statelyai/inspect';
import { tempMachine } from './tempMachine';

const inspector = createBrowserInspector();

const { snapshot, send } = useMachine(tempMachine, {
  inspect: inspector.inspect
});

function value(event: Event) {
  return (event.target as HTMLInputElement).value;
}
</script>

<template>
  <div class="case">
    <div>
      <input
        id="celsius"
        type="text"
        placeholder="..."
        :value="snapshot.context.celsius"
        @input="(event) => send({ type: 'changeC', value: value(event) })"
      />
      <label for="celsius">°C</label>
    </div>
    <div>
      <input
        id="fahrenheit"
        type="text"
        placeholder="..."
        :value="snapshot.context.fahrenheit"
        @input="(event) => send({ type: 'changeF', value: value(event) })"
      />
      <label for="fahrenheit">°F</label>
    </div>
  </div>
</template>
