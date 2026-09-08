import { types, createMachine } from 'xstate';
import type { TodoItem } from './todosMachine';

export const todoMachine = createMachine({
  schemas: {
    context: types<{ initialTitle: string; title: string }>(),
    input: types<{ todo: TodoItem }>(),
    events: {
      edit: types<{}>(),
      blur: types<{}>(),
      cancel: types<{}>(),
      change: types<{ value: string }>()
    }
  },
  actions: {
    focusInput: () => {},
    onCommit: (_params: { title: string }) => {}
  },
  initial: 'reading',
  context: ({ input }) => ({
    initialTitle: input.todo.title,
    title: input.todo.title
  }),
  states: {
    reading: { on: { edit: { target: 'editing' } } },
    editing: {
      entry: ({ context, actions }, enq) => {
        enq(actions.focusInput);
        return { context: { ...context, initialTitle: context.title } };
      },
      on: {
        blur: ({ context, actions }, enq) => {
          enq(actions.onCommit, { title: context.title });
          return { target: 'reading' };
        },
        cancel: ({ context }) => ({
          target: 'reading',
          context: { ...context, title: context.initialTitle }
        }),
        change: ({ context, event }) => ({
          context: { ...context, title: event.value }
        })
      }
    }
  }
});
