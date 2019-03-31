<template>
  <div class="hello">
    <button v-on:click="$send('TOGGLE')">Increment</button>
    <h2>{{ $state.value }} {{ $state.context.count }}</h2>
  </div>
</template>

<script>
import { Machine, assign, send } from 'xstate';

export default {
  name: 'HelloWorld',
  machine: Machine({
    initial: 'inactive',
    context: { count: 0 },
    states: {
      inactive: {
        on: { TOGGLE: 'active' }
      },
      active: {
        onEntry: assign({
          count: ctx => ctx.count + 1
        }),
        on: { TOGGLE: 'inactive' }
      }
    }
  })
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
</style>
