<template>
  <section class="todoapp" :data-state="state.toStrings()">
    <header class="header">
      <h1>Todos</h1>
      <input
        class="new-todo"
        autofocus
        type="text"
        placeholder="What needs to be done?"
        @keypress.enter="
          send({ type: 'NEWTODO.COMMIT', value: $event.target.value })
        "
        @input="send({ type: 'NEWTODO.CHANGE', value: $event.target.value })"
        :value="todo"
      />
    </header>
    <section class="main">
      <input
        id="toggle-all"
        class="toggle-all"
        type="checkbox"
        :checked="allCompleted"
        @change="send(markEvent)"
      />
      <label for="toggle-all" :title="`Mark all as ${mark}`"
        >Mark all as {{ mark }}</label
      >
      <ul class="todo-list">
        <TodoItem
          v-for="todoItem in filteredTodos"
          :key="todoItem.id"
          :todo-ref="todoItem.ref"
        ></TodoItem>
      </ul>
      <footer class="footer" v-show="todos.length">
        <span class="todo-count">
          <strong>
            {{ numActiveTodos }} item{{ numActiveTodos === 1 ? '' : 's' }}
            left
          </strong>
        </span>
        <ul class="filters">
          <li>
            <a
              href="#/"
              :class="{
                selected: filter === 'all'
              }"
              >All</a
            >
          </li>
          <li>
            <a
              href="#/active"
              :class="{
                selected: filter === 'active'
              }"
              >Active</a
            >
          </li>
          <li>
            <a
              href="#/completed"
              :class="{
                selected: filter === 'completed'
              }"
              >Completed</a
            >
          </li>
        </ul>
        <button
          v-show="numActiveTodos < todos.length"
          class="clear-completed"
          @click="send('CLEAR_COMPLETED')"
        >
          Clear completed
        </button>
      </footer>
    </section>
  </section>
</template>
<script setup lang="ts">
import TodoItem from './TodoItem.vue';
import { todosMachine } from './todos.machine';
import { useMachine } from '@xstate/vue';
import { computed } from 'vue';

import { useHashChange } from './useHashChange';

function filterTodos(filter, todos) {
  if (filter === 'active') {
    return todos.filter((todo) => !todo.completed);
  }
  if (filter === 'completed') {
    return todos.filter((todo) => todo.completed);
  }
  return todos;
}

const { state, send } = useMachine(todosMachine, { devTools: true });

const todos = computed(() => state.value.context.todos);
const todo = computed(() => state.value.context.todo);
const filter = computed(() => state.value.context.filter);

useHashChange(() =>
  send({ type: 'SHOW', filter: window.location.hash.slice(2) || 'all' })
);

const numActiveTodos = computed(
  () => todos.value.filter((todo) => !todo.completed).length
);
const allCompleted = computed(
  () => todos.value.length > 0 && numActiveTodos.value === 0
);
const mark = computed(() => (!allCompleted.value ? 'completed' : 'active'));
const markEvent = computed(() => `MARK.${mark.value}`);
const filteredTodos = computed(() => filterTodos(filter.value, todos.value));
</script>
