import { createStore } from '@xstate/store';
import { createInspector } from '@statelyai/sdk';

const inspector = createInspector();

export type Todo = { id: string; text: string; done: boolean };
export type Filter = 'all' | 'active' | 'done';

/** One store, imported by every component that needs the todo list. */
export const todoStore = createStore({
  context: {
    todos: [] as Todo[],
    filter: 'all' as Filter
  },
  on: {
    add: (context, event: { text: string }) => ({
      ...context,
      todos: [
        ...context.todos,
        { id: crypto.randomUUID(), text: event.text, done: false }
      ]
    }),
    toggle: (context, event: { id: string }) => ({
      ...context,
      todos: context.todos.map((todo) =>
        todo.id === event.id ? { ...todo, done: !todo.done } : todo
      )
    }),
    setFilter: (context, event: { filter: Filter }) => ({
      ...context,
      filter: event.filter
    }),
    clearDone: (context) => ({
      ...context,
      todos: context.todos.filter((todo) => !todo.done)
    })
  }
});

todoStore.inspect(inspector.inspect);
