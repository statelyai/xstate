import { createStore } from './store';
import { persist } from './persist';
import type { StoreConfig } from './types';

// Example 1: Basic usage with default JSON serializer
const basicConfig: StoreConfig<
  { count: number },
  { increment: {}; decrement: {}; reset: {} },
  {}
> = {
  context: { count: 0 },
  on: {
    increment: (context) => ({ count: context.count + 1 }),
    decrement: (context) => ({ count: context.count - 1 }),
    reset: () => ({ count: 0 })
  }
};

const _basicStore = createStore(persist(basicConfig, { name: 'my-state' }));

// Example 2: Custom serializer (Base64 encoding)
const customSerializer = {
  serialize: (value: any) => btoa(JSON.stringify(value)),
  deserialize: (value: string) => JSON.parse(atob(value))
};

const encryptedConfig: StoreConfig<
  { secret: string },
  { updateSecret: { secret: string } },
  {}
> = {
  context: { secret: 'initial' },
  on: {
    updateSecret: (_context, event) => ({ secret: event.secret })
  }
};

const _encryptedStore = createStore(
  persist(encryptedConfig, {
    name: 'encrypted-state',
    serializer: customSerializer
  })
);

// Example 3: Complex state with nested objects
interface Todo {
  id: number;
  text: string;
  completed: boolean;
}

const todoConfig: StoreConfig<
  { todos: Todo[]; filter: 'all' | 'active' | 'completed'; nextId: number },
  {
    addTodo: { text: string };
    toggleTodo: { id: number };
    setFilter: { filter: 'all' | 'active' | 'completed' };
  },
  {}
> = {
  context: {
    todos: [],
    filter: 'all',
    nextId: 1
  },
  on: {
    addTodo: (context, event) => ({
      ...context,
      todos: [
        ...context.todos,
        { id: context.nextId, text: event.text, completed: false }
      ],
      nextId: context.nextId + 1
    }),
    toggleTodo: (context, event) => ({
      ...context,
      todos: context.todos.map((todo) =>
        todo.id === event.id ? { ...todo, completed: !todo.completed } : todo
      )
    }),
    setFilter: (context, event) => ({
      ...context,
      filter: event.filter
    })
  }
};

const _todoStore = createStore(persist(todoConfig, { name: 'todo-app' }));

// Usage examples:
// basicStore.send({ type: 'increment' });
// encryptedStore.send({ type: 'updateSecret', secret: 'new-secret' });
// todoStore.send({ type: 'addTodo', text: 'Learn XState' });
