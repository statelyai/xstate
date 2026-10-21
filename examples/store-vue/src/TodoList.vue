<script setup lang="ts">
import { ref } from 'vue';
import { useSelector } from '@xstate/store-vue';
import { todoStore, type Filter } from './todoStore';

const draft = ref('');

// `useSelector` returns a readonly ref. Deriving the visible list inside the
// selector keeps the filtered view out of the store's context.
const visible = useSelector(todoStore, (state) =>
  state.context.todos.filter((todo) =>
    state.context.filter === 'all'
      ? true
      : state.context.filter === 'done'
        ? todo.done
        : !todo.done
  )
);
const filter = useSelector(todoStore, (state) => state.context.filter);

const filters: Filter[] = ['all', 'active', 'done'];

function add() {
  if (draft.value.trim() === '') return;

  todoStore.send({ type: 'add', text: draft.value.trim() });
  draft.value = '';
}
</script>

<template>
  <section>
    <form @submit.prevent="add">
      <input v-model="draft" placeholder="What needs doing?" />
      <button type="submit">Add</button>
    </form>

    <nav>
      <button
        v-for="option in filters"
        :key="option"
        :class="{ active: filter === option }"
        @click="todoStore.send({ type: 'setFilter', filter: option })"
      >
        {{ option }}
      </button>
    </nav>

    <ul>
      <li v-for="todo in visible" :key="todo.id">
        <label>
          <input
            type="checkbox"
            :checked="todo.done"
            @change="todoStore.send({ type: 'toggle', id: todo.id })"
          />
          <span :class="{ done: todo.done }">{{ todo.text }}</span>
        </label>
      </li>
    </ul>

    <button @click="todoStore.send({ type: 'clearDone' })">
      Clear completed
    </button>
  </section>
</template>
