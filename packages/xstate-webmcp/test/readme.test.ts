// Mirrors the examples in README.md and docs/webmcp.md.
import { createStore } from '@xstate/store';
import { createActor, createMachine } from 'xstate';
import { z } from 'zod';
import { createMockModelContext, createWebMCP } from '../src/index.ts';

const todoStore = createStore({
  schemas: {
    events: {
      'todo.add': z
        .object({ title: z.string().min(1) })
        .describe('Add a todo item.'),
      'todo.remove': z
        .object({ id: z.number() })
        .describe('Remove a todo item by id.')
    }
  },
  context: { nextId: 0, todos: [] as { id: number; title: string }[] },
  on: {
    'todo.add': (context, event) => ({
      nextId: context.nextId + 1,
      todos: [...context.todos, { id: context.nextId, title: event.title }]
    }),
    'todo.remove': (context, event) => ({
      ...context,
      todos: context.todos.filter((todo) => todo.id !== event.id)
    })
  }
});

const checkoutMachine = createMachine({
  schemas: {
    events: {
      'cart.add': z
        .object({ sku: z.string() })
        .describe('Add an item to the cart.'),
      'checkout.start': z.object({}).describe('Start checkout.'),
      cancel: z.object({}).describe('Cancel checkout.')
    }
  },
  context: { items: [] as string[] },
  initial: 'shopping',
  states: {
    shopping: {
      on: {
        'cart.add': ({ context, event }) => ({
          context: { items: [...context.items, event.sku] }
        }),
        'checkout.start': ({ context }) =>
          context.items.length > 0 ? { target: 'checkout' } : undefined
      }
    },
    checkout: {
      on: { cancel: { target: 'shopping' } }
    }
  }
});

describe('README examples', () => {
  it('quick start and testing', async () => {
    const modelContext = createMockModelContext();
    await createWebMCP(todoStore, { events: ['todo.*'] }).register({
      modelContext
    }).ready;

    expect(modelContext.getToolNames()).toEqual([
      'todo_add',
      'todo_remove',
      'get_state'
    ]);
    await modelContext.executeTool('todo_add', { title: 'Buy milk' });
    expect(todoStore.getSnapshot().context.todos).toEqual([
      { id: 0, title: 'Buy milk' }
    ]);

    // Ids are not reused after a removal.
    await modelContext.executeTool('todo_add', { title: 'Walk dog' });
    await modelContext.executeTool('todo_remove', { id: 0 });
    await modelContext.executeTool('todo_add', { title: 'Call mom' });
    await modelContext.executeTool('todo_remove', { id: 2 });
    expect(todoStore.getSnapshot().context.todos).toEqual([
      { id: 1, title: 'Walk dog' }
    ]);
  });

  it('overrides', () => {
    const webMCP = createWebMCP(todoStore, {
      events: ['todo.*'],
      prefix: 'todos',
      overrides: {
        'todo.remove': {
          name: 'delete',
          annotations: { consequentialHint: true }
        }
      }
    });

    expect(webMCP.tools.map((tool) => tool.name)).toEqual([
      'todos_todo_add',
      'todos_delete',
      'todos_get_state'
    ]);
  });

  it('machines', async () => {
    const actor = createActor(checkoutMachine).start();
    const modelContext = createMockModelContext();
    const webMCP = createWebMCP(actor, { events: '*' });

    await webMCP.register({ modelContext }).ready;
    expect(modelContext.getToolNames().sort()).toEqual([
      'cart_add',
      'checkout_start',
      'get_state'
    ]);

    await expect(modelContext.executeTool('checkout_start')).rejects.toThrow(
      'Tool "checkout_start" cannot run in the current state. Available tools: cart_add, checkout_start, get_state.'
    );

    await modelContext.executeTool('cart_add', { sku: 'apple' });
    await modelContext.executeTool('checkout_start');

    expect(modelContext.getToolNames().sort()).toEqual(['cancel', 'get_state']);
  });

  it('custom tools', async () => {
    const actor = createActor(checkoutMachine).start();
    const webMCP = createWebMCP(actor, {
      events: [],
      tools: ({ tool }) => ({
        quickCheckout: tool({
          description: 'Add the given items and start checkout.',
          input: z.object({ skus: z.array(z.string()).min(1) }),
          annotations: { consequentialHint: true },
          async execute({ skus }, { send, getSnapshot, waitFor }) {
            if (!getSnapshot().matches('shopping')) {
              throw new Error('Checkout has already started.');
            }
            for (const sku of skus) {
              send({ type: 'cart.add', sku });
            }
            send({ type: 'checkout.start' });
            const snapshot = await waitFor((s) => s.matches('checkout'));
            return { items: snapshot.context.items };
          }
        })
      })
    });

    await expect(
      webMCP.tools[1].execute({ skus: ['a', 'b'] })
    ).resolves.toEqual({ items: ['a', 'b'] });
    await expect(webMCP.tools[1].execute({ skus: ['c'] })).rejects.toThrow(
      'Checkout has already started.'
    );
  });
});
