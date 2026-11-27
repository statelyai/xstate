import { createStore } from '@xstate/store';
import { createActor, createMachine } from 'xstate';
import { z } from 'zod';
import { createWebMCP, type StandardSchemaV1 } from '../src/index.ts';

const store = createStore({
  schemas: {
    events: {
      'todo.add': z.object({ title: z.string() }).describe('Add a todo.'),
      'todo.remove': z.object({ id: z.number() }).describe('Remove a todo.')
    }
  },
  context: { todos: [] as string[] },
  on: {
    'todo.add': (context, event) => ({
      todos: [...context.todos, event.title]
    }),
    'todo.remove': (context) => context
  }
});

const actor = createActor(
  createMachine({
    schemas: {
      events: {
        next: z.object({ value: z.string() }).describe('Go to the next step.')
      }
    },
    context: { value: '' },
    initial: 'a',
    states: {
      a: {
        on: {
          next: ({ event }) => ({
            target: 'b',
            context: { value: event.value }
          })
        }
      },
      b: {}
    }
  })
).start();

describe('createWebMCP types', () => {
  it('accepts stores and machine actors', () => {
    createWebMCP(store, { events: 'todo.add' });
    createWebMCP(actor, { events: 'next' });
  });

  it('checks event descriptors', () => {
    if (false as boolean) {
      createWebMCP(store, { events: ['todo.add', 'todo.*', '*'] });
      // @ts-expect-error unknown event
      createWebMCP(store, { events: 'todo.edit' });
      // @ts-expect-error mid-token wildcard
      createWebMCP(store, { events: 'todo*' });
      // @ts-expect-error unknown event
      createWebMCP(actor, { events: 'back' });
    }
  });

  it('checks override keys', () => {
    if (false as boolean) {
      createWebMCP(store, {
        events: '*',
        overrides: { 'todo.add': { description: 'Add.' } }
      });
      createWebMCP(store, {
        events: '*',
        // @ts-expect-error unknown event
        overrides: { 'todo.edit': { description: 'Edit.' } }
      });
    }
  });

  it('types the toolName mapper', () => {
    createWebMCP(store, {
      events: '*',
      toolName: (eventType, schema) => {
        expectTypeOf(eventType).toEqualTypeOf<'todo.add' | 'todo.remove'>();
        expectTypeOf(schema).toEqualTypeOf<StandardSchemaV1>();
        return eventType.replace('.', '_');
      }
    });
  });

  it('types the output snapshot', () => {
    createWebMCP(store, {
      events: '*',
      output: (snapshot) => {
        expectTypeOf(snapshot.context.todos).toEqualTypeOf<string[]>();
        return snapshot.context;
      }
    });
    createWebMCP(actor, {
      events: '*',
      output: (snapshot) => {
        expectTypeOf(snapshot.context.value).toEqualTypeOf<string>();
        return snapshot.value;
      }
    });
  });

  it('types custom tool input and context', () => {
    createWebMCP(store, {
      events: [],
      tools: ({ tool }) => ({
        add: tool({
          description: 'Add todos.',
          input: z.object({ titles: z.array(z.string()) }),
          async execute(input, { send, getSnapshot, waitFor }) {
            expectTypeOf(input).toEqualTypeOf<{ titles: string[] }>();
            send({ type: 'todo.add', title: 'a' });
            // @ts-expect-error missing payload
            send({ type: 'todo.add' });
            // @ts-expect-error unknown event
            send({ type: 'todo.edit' });
            expectTypeOf(getSnapshot().context.todos).toEqualTypeOf<string[]>();
            const snapshot = await waitFor((s) => s.context.todos.length > 0);
            expectTypeOf(snapshot.context.todos).toEqualTypeOf<string[]>();
          }
        }),
        noInput: tool({
          description: 'No input.',
          execute(input) {
            expectTypeOf(input).toEqualTypeOf<Record<string, never>>();
          }
        })
      })
    });
    createWebMCP(actor, {
      events: [],
      tools: ({ tool }) => ({
        go: tool({
          description: 'Go.',
          execute(_input, { send, waitFor }) {
            send({ type: 'next', value: 'x' });
            // @ts-expect-error wrong payload type
            send({ type: 'next', value: 1 });
            return waitFor((s) => s.matches('b'));
          }
        })
      })
    });
  });
});
