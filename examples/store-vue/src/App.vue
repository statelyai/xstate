<script setup lang="ts">
import TodoList from './TodoList.vue';
import TodoSummary from './TodoSummary.vue';
</script>

<template>
  <main>
    <header>
      <h1>Todos</h1>
      <TodoSummary />
    </header>
    <TodoList />
  </main>
</template>
