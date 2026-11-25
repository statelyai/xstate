import { createStore } from '@xstate/store';
import { z } from 'zod';
import {
  createMockModelContext,
  createWebMCP,
  toToolName,
  WebMCPInputError
} from '../src/index.ts';

function createTodoStore() {
  return createStore({
    schemas: {
      events: {
        'todo.add': z
          .object({ title: z.string().min(1) })
          .describe('Add a todo item.'),
        'todo.remove': z
          .object({ id: z.number() })
          .describe('Remove a todo item by id.'),
        'filter.set': z
          .object({ filter: z.enum(['all', 'done']) })
          .describe('Set the visible filter.')
      }
    },
    context: {
      todos: [] as { id: number; title: string }[],
      filter: 'all' as 'all' | 'done'
    },
    on: {
      'todo.add': (context, event) => ({
        ...context,
        todos: [
          ...context.todos,
          { id: context.todos.length, title: event.title }
        ]
      }),
      'todo.remove': (context, event) => ({
        ...context,
        todos: context.todos.filter((todo) => todo.id !== event.id)
      }),
      'filter.set': (context, event) => ({ ...context, filter: event.filter })
    }
  });
}

describe('store tools', () => {
  it('creates a tool per exposed event with JSON Schema input', () => {
    const store = createTodoStore();
    const webMCP = createWebMCP(store, { events: ['todo.*'] });

    expect(webMCP.tools.map((tool) => tool.name)).toEqual([
      'todo_add',
      'todo_remove',
      'get_state'
    ]);
    expect(webMCP.tools[0]).toMatchObject({
      name: 'todo_add',
      description: 'Add a todo item.',
      inputSchema: {
        type: 'object',
        properties: { title: { type: 'string', minLength: 1 } },
        required: ['title']
      }
    });
    expect(webMCP.tools[0].inputSchema).not.toHaveProperty('$schema');
  });

  it('sends the event when a tool executes', async () => {
    const store = createTodoStore();
    const modelContext = createMockModelContext();
    const webMCP = createWebMCP(store, {
      events: 'todo.add',
      output: (snapshot) => ({ count: snapshot.context.todos.length })
    });

    await webMCP.register({ modelContext }).ready;

    await expect(
      modelContext.executeTool('todo_add', { title: 'Buy milk' })
    ).resolves.toEqual({ count: 1 });
    expect(store.getSnapshot().context.todos).toEqual([
      { id: 0, title: 'Buy milk' }
    ]);
    await expect(modelContext.executeTool('get_state')).resolves.toEqual({
      count: 1
    });
  });

  it('rejects invalid input without sending', async () => {
    const store = createTodoStore();
    const modelContext = createMockModelContext();
    const webMCP = createWebMCP(store, { events: 'todo.add' });

    await webMCP.register({ modelContext }).ready;

    const result = modelContext.executeTool('todo_add', { title: '' });
    await expect(result).rejects.toBeInstanceOf(WebMCPInputError);
    await expect(result).rejects.toThrow(/Invalid input for tool "todo_add"/);
    expect(store.getSnapshot().context.todos).toEqual([]);
  });

  it('returns status without context by default', async () => {
    const store = createTodoStore();
    const webMCP = createWebMCP(store, { events: 'todo.add' });

    await expect(
      webMCP.tools[0].execute({ title: 'Buy milk' })
    ).resolves.toEqual({ status: 'active' });
  });

  it('applies prefix and overrides', () => {
    const store = createTodoStore();
    const webMCP = createWebMCP(store, {
      events: ['todo.remove'],
      prefix: 'todos',
      stateTool: { name: 'read' },
      overrides: {
        'todo.remove': {
          name: 'delete',
          description: 'Delete a todo.',
          annotations: { consequentialHint: true }
        }
      }
    });

    expect(webMCP.tools).toMatchObject([
      {
        name: 'todos_delete',
        description: 'Delete a todo.',
        annotations: { consequentialHint: true }
      },
      { name: 'todos_read', annotations: { readOnlyHint: true } }
    ]);
  });

  it('omits the state tool when disabled', () => {
    const webMCP = createWebMCP(createTodoStore(), {
      events: '*',
      stateTool: false
    });

    expect(webMCP.tools.map((tool) => tool.name)).toEqual([
      'todo_add',
      'todo_remove',
      'filter_set'
    ]);
  });

  it('throws for an event without a schema or description', () => {
    const store = createStore({
      schemas: {
        events: { inc: z.object({}) }
      },
      context: { count: 0 },
      on: {
        inc: (context) => ({ count: context.count + 1 })
      }
    });

    expect(() => createWebMCP(store, { events: 'inc' })).toThrow(
      /Event "inc" needs a description/
    );
    expect(() =>
      // @ts-expect-error `nope` is not an event
      createWebMCP(store, { events: 'nope' })
    ).toThrow(/Cannot expose event "nope": it has no event schema/);
    expect(() =>
      createWebMCP(store, {
        events: 'inc',
        overrides: { inc: { description: 'Increment.' } }
      })
    ).not.toThrow();
  });

  it('rejects invalid wildcards and tool names', () => {
    const store = createTodoStore();

    expect(() =>
      // @ts-expect-error mid-token wildcard
      createWebMCP(store, { events: 'todo*' })
    ).toThrow(/Invalid event descriptor/);
    expect(() =>
      createWebMCP(store, { events: 'todo.add', prefix: 'my app' })
    ).toThrow(/Invalid tool name "my app_todo_add"/);
    expect(() =>
      createWebMCP(store, {
        events: 'todo.add',
        overrides: { 'todo.add': { name: 'get_state' } }
      })
    ).toThrow(
      'Duplicate tool name "get_state" for event "todo.add" and the state tool.'
    );
  });

  it('maps event types to tool names', () => {
    expect(toToolName('checkout.confirm')).toBe('checkout_confirm');
    expect(toToolName('cart/item:add')).toBe('cart_item_add');

    const webMCP = createWebMCP(createTodoStore(), {
      events: 'todo.*',
      toolName: (eventType) => `send_${toToolName(eventType)}`
    });

    expect(webMCP.tools.map((tool) => tool.name)).toEqual([
      'send_todo_add',
      'send_todo_remove',
      'get_state'
    ]);
  });

  it('throws when two event types map to the same tool name', () => {
    const store = createStore({
      schemas: {
        events: {
          'todo.add': z.object({}).describe('Add a todo.'),
          todo_add: z.object({}).describe('Also add a todo.')
        }
      },
      context: {},
      on: { 'todo.add': (context) => context, todo_add: (context) => context }
    });

    expect(() => createWebMCP(store, { events: '*' })).toThrow(
      'Duplicate tool name "todo_add" for event "todo.add" and event "todo_add".'
    );
  });

  it('runs custom tools with typed input and waitFor', async () => {
    const store = createTodoStore();
    const modelContext = createMockModelContext();
    const webMCP = createWebMCP(store, {
      events: [],
      tools: ({ tool }) => ({
        addMany: tool({
          description: 'Add several todos.',
          input: z.object({ titles: z.array(z.string()) }),
          async execute({ titles }, { send, waitFor }) {
            for (const title of titles) {
              send({ type: 'todo.add', title });
            }
            const snapshot = await waitFor(
              (s) => s.context.todos.length >= titles.length
            );
            return { ids: snapshot.context.todos.map((todo) => todo.id) };
          }
        })
      })
    });

    await webMCP.register({ modelContext }).ready;

    expect(modelContext.getToolNames()).toEqual(['get_state', 'addMany']);
    expect(webMCP.tools[1].inputSchema).toMatchObject({
      type: 'object',
      properties: { titles: { type: 'array' } }
    });
    await expect(
      modelContext.executeTool('addMany', { titles: ['a', 'b'] })
    ).resolves.toEqual({ ids: [0, 1] });
    await expect(
      modelContext.executeTool('addMany', { titles: 'a' })
    ).rejects.toBeInstanceOf(WebMCPInputError);
  });

  it('rejects waitFor when the call is aborted', async () => {
    const store = createTodoStore();
    const webMCP = createWebMCP(store, {
      events: [],
      stateTool: false,
      tools: ({ tool }) => ({
        waitForever: tool({
          description: 'Wait for a todo that never arrives.',
          execute: (_input, { waitFor }) =>
            waitFor((s) => s.context.todos.length > 10)
        })
      })
    });
    const controller = new AbortController();
    const result = webMCP.tools[0].execute({}, { signal: controller.signal });

    controller.abort(new Error('cancelled'));

    await expect(result).rejects.toThrow('cancelled');
  });

  it('rejects waitFor after a timeout', async () => {
    const store = createTodoStore();
    const webMCP = createWebMCP(store, {
      events: [],
      stateTool: false,
      tools: ({ tool }) => ({
        slow: tool({
          description: 'Wait briefly.',
          execute: (_input, { waitFor }) =>
            waitFor((s) => s.context.todos.length > 0, { timeout: 5 })
        })
      })
    });

    await expect(webMCP.tools[0].execute({})).rejects.toThrow(
      'waitFor timed out after 5ms.'
    );
  });

  it('requires custom tools to use the tool helper', () => {
    expect(() =>
      createWebMCP(createTodoStore(), {
        events: [],
        tools: () => ({ bad: {} as never })
      })
    ).toThrow(/must be created with the `tool` helper/);
  });
});

describe('registration', () => {
  it('unregisters every tool', async () => {
    const modelContext = createMockModelContext();
    const webMCP = createWebMCP(createTodoStore(), { events: 'todo.*' });
    const registration = webMCP.register({ modelContext });

    await registration.ready;
    expect(registration.status).toBe('registered');
    expect(modelContext.getToolNames()).toEqual([
      'todo_add',
      'todo_remove',
      'get_state'
    ]);

    registration.unregister();

    expect(registration.status).toBe('unregistered');
    expect(modelContext.getToolNames()).toEqual([]);
  });

  it('unregisters when the signal aborts', async () => {
    const modelContext = createMockModelContext();
    const controller = new AbortController();
    const registration = createWebMCP(createTodoStore(), {
      events: 'todo.add'
    }).register({ modelContext, signal: controller.signal });

    await registration.ready;
    controller.abort();

    expect(registration.status).toBe('unregistered');
    expect(modelContext.getToolNames()).toEqual([]);
  });

  it('registers nothing with an already aborted signal', async () => {
    const modelContext = createMockModelContext();
    const registration = createWebMCP(createTodoStore(), {
      events: 'todo.add'
    }).register({ modelContext, signal: AbortSignal.abort() });

    await registration.ready;

    expect(registration.status).toBe('unregistered');
    expect(modelContext.getToolNames()).toEqual([]);
  });

  it('reports unsupported without a model context', async () => {
    const registration = createWebMCP(createTodoStore(), {
      events: 'todo.add'
    }).register();

    await registration.ready;

    expect(registration.status).toBe('unsupported');
  });

  it('uses document.modelContext by default', async () => {
    const modelContext = createMockModelContext();
    vi.stubGlobal('document', { modelContext });

    try {
      await createWebMCP(createTodoStore(), { events: 'todo.add' }).register()
        .ready;
      expect(modelContext.getToolNames()).toEqual(['todo_add', 'get_state']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('rejects ready when registration fails', async () => {
    const modelContext = createMockModelContext();
    await modelContext.registerTool({
      name: 'get_state',
      description: 'Taken.',
      inputSchema: {},
      execute: async () => null
    });

    await expect(
      createWebMCP(createTodoStore(), { events: 'todo.add' }).register({
        modelContext
      }).ready
    ).rejects.toThrow(/already registered/);
  });
});
