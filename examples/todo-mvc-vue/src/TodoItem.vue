<template>
  <li
    class="todo"
    :class="{
      editing: state.matches('editing'),
      completed
    }"
    :data-todo-state="completed ? 'completed' : 'active'"
  >
    <div class="view">
      <input
        class="toggle"
        type="checkbox"
        @change="send('TOGGLE_COMPLETE')"
        :checked="completed"
      />
      <label @dblclick="send('EDIT')">{{ title }}</label>
      <button class="destroy" @click="send('DELETE')"></button>
    </div>
    <input
      class="edit"
      type="text"
      :value="title"
      @blur="send('BLUR')"
      @input="send({ type: 'CHANGE', value: $event.target.value })"
      @keypress.enter="send('COMMIT')"
      @keydown.escape="send('CANCEL')"
      ref="inputRef"
    />
  </li>
</template>

<script setup lang="ts">
import { useActor } from '@xstate/vue';
import { defineProps, computed, watch, ref, nextTick } from 'vue';

const props = defineProps({
  todoRef: { type: Object, required: true }
});

const { state, send } = useActor(props.todoRef);
const inputRef = ref(null);

watch(
  () => state.value.actions,
  async (actions) => {
    if (actions.find((action) => action.type === 'focusInput')) {
      if (inputRef.value) {
        await nextTick();
        inputRef.value.select();
      }
    }
  }
);

const title = computed(() => state.value.context.title);
const id = computed(() => state.value.context.id);
const completed = computed(() => state.value.context.completed);
</script>
