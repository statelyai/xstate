<template>
  <div id="app">
    <h1>XState Vue 3 Template</h1>
    <h2>Fork this template!</h2>
    <button @click="send('TOGGLE')">
      Click me ({{ state.matches("active") ? "✅" : "❌" }})
    </button>
    <code>
      Toggled
      <strong>{{ state.context.count }}</strong> times
    </code>
  </div>
</template>


<script lang="ts">
import { defineComponent } from 'vue'
import { assign, createMachine } from 'xstate';
import { useMachine } from '@xstate/vue';

const toggleMachine = createMachine({
  id: "toggle",
  initial: "inactive",
  context: {
    count: 0,
  },
  states: {
    inactive: {
      on: { TOGGLE: "active" },
    },
    active: {
      entry: assign({ count: (ctx) => ctx.count + 1 }),
      on: { TOGGLE: "inactive" },
    },
  },
});


export default defineComponent({
  name: 'App',
  setup() {
    const { state, send } = useMachine(toggleMachine);
    return {
      state,
      send,
    };
  }
})
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
