<script setup lang="ts">
import { useSelector } from '@xstate/store-vue';
import { todoStore } from './todoStore';

// A separate component subscribing to the same store with its own selector.
const remaining = useSelector(
  todoStore,
  (state) => state.context.todos.filter((todo) => !todo.done).length
);
</script>

<template>
  <p class="summary">{{ remaining }} remaining</p>
</template>
