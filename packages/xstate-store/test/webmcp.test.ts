import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createStore } from '../src/index.ts';
import {
  attachWebMCP,
  matchesStoreEventDescriptor,
  type WebMCPModelContext,
  type WebMCPTool
} from '../src/webmcp.ts';

function createTodosStore() {
  return createStore({
    context: { count: 0, todos: [] as string[] },
    schemas: {
      events: {
        todo: z.object({}).describe('Perform the todo root action.'),
        'todo.add': z
          .object({ title: z.string().min(1).describe('The todo text.') })
          .describe('Add a todo item.'),
        'todo.rename': z
          .object({
            index: z.number().int().nonnegative().describe('The todo index.'),
            title: z.string().min(1).describe('The replacement todo text.')
          })
          .describe('Rename a todo item.'),
        'settings.reset': z.object({}).describe('Reset the settings.'),
        'internal.audit': z.object({}).describe('Run the internal audit.')
      }
    },
    on: {
      todo: (context) => ({ ...context, count: context.count + 1 }),
      'todo.add': (context, event: { title: string }) => ({
        ...context,
        todos: [...context.todos, event.title]
      }),
      'todo.rename': (context, event: { index: number; title: string }) => ({
        ...context,
        todos: context.todos.map((todo, index) =>
          index === event.index ? event.title : todo
        )
      }),
      'settings.reset': (context) => ({ ...context, count: 0 }),
      'internal.audit': (context) => context
    }
  });
}

function createModelContext() {
  const tools: WebMCPTool[] = [];
  const signals: AbortSignal[] = [];
  const modelContext: WebMCPModelContext = {
    registerTool: vi.fn(async (tool, options) => {
      tools.push(tool);
      if (options?.signal) {
        signals.push(options.signal);
      }
    })
  };

  return { modelContext, signals, tools };
}

describe('WebMCP event descriptors', () => {
  it('matches exact, full, and trailing-token wildcard descriptors', () => {
    expect(matchesStoreEventDescriptor('todo.add', 'todo.add')).toBe(true);
    expect(matchesStoreEventDescriptor('todo.add', 'todo.*')).toBe(true);
    expect(matchesStoreEventDescriptor('todo.add.bulk', 'todo.*')).toBe(true);
    expect(matchesStoreEventDescriptor('todo', 'todo.*')).toBe(true);
    expect(matchesStoreEventDescriptor('settings.reset', '*')).toBe(true);
    expect(matchesStoreEventDescriptor('settings.reset', 'todo.*')).toBe(false);
    expect(matchesStoreEventDescriptor('todo.add', 'todo*')).toBe(false);
    expect(matchesStoreEventDescriptor('todo.add', 'todo.*.bulk')).toBe(false);
  });

  it('expands a prefix descriptor into concrete tools', () => {
    const store = createTodosStore();
    const attachment = attachWebMCP(store, { events: 'todo.*' });

    expect(attachment.tools.map((tool) => tool.name)).toEqual([
      'todo',
      'todo.add',
      'todo.rename'
    ]);
  });

  it('expands the full wildcard only when explicitly requested', () => {
    const store = createTodosStore();
    const attachment = attachWebMCP(store, { events: '*' });

    expect(attachment.tools.map((tool) => tool.name)).toEqual([
      'todo',
      'todo.add',
      'todo.rename',
      'settings.reset',
      'internal.audit'
    ]);
  });

  it('deduplicates overlapping descriptors', () => {
    const store = createTodosStore();
    const attachment = attachWebMCP(store, {
      events: ['*', 'todo.*', 'todo.add']
    });

    expect(attachment.tools).toHaveLength(5);
  });

  it('rejects unknown exact and invalid wildcard descriptors', () => {
    const store = createTodosStore();

    expect(() =>
      attachWebMCP(store, { events: 'todo.missing' as never })
    ).toThrow('No matching event schema exists');
    expect(() => attachWebMCP(store, { events: 'todo*' as never })).toThrow(
      'Wildcards must be the entire descriptor or the final token'
    );
    expect(() =>
      attachWebMCP(store, { events: 'todo.*.bulk' as never })
    ).toThrow('Wildcards must be the entire descriptor or the final token');
  });
});

describe('WebMCP attachment', () => {
  it('derives the input schema and validates input before dispatching', async () => {
    const store = createTodosStore();
    const attachment = attachWebMCP(store, { events: 'todo.add' });
    const tool = attachment.tools[0];

    expect(tool.inputSchema).toMatchObject({
      type: 'object',
      description: 'Add a todo item.',
      properties: {
        title: {
          type: 'string',
          description: 'The todo text.'
        }
      },
      required: ['title']
    });

    await expect(tool.execute({ title: 'Write tests' })).resolves.toEqual({
      ok: true
    });
    expect(store.getSnapshot().context.todos).toEqual(['Write tests']);

    await expect(tool.execute({ title: '' })).rejects.toMatchObject({
      name: 'WebMCPInputError',
      eventType: 'todo.add'
    });
    expect(store.getSnapshot().context.todos).toEqual(['Write tests']);
  });

  it('supports an explicit JSON Schema converter', () => {
    const store = createTodosStore();
    const toJSONSchema = vi.fn(() => ({
      type: 'object',
      description: 'Converted todo action.',
      properties: { title: { type: 'string' } }
    }));

    const attachment = attachWebMCP(store, {
      events: 'todo.add',
      toJSONSchema
    });

    expect(toJSONSchema).toHaveBeenCalledOnce();
    expect(attachment.tools[0].description).toBe('Converted todo action.');
  });

  it('registers tools idempotently and aborts registration on stop', async () => {
    const store = createTodosStore();
    const { modelContext, signals, tools } = createModelContext();
    const attachment = attachWebMCP(store, {
      events: 'todo.*',
      modelContext
    });

    const firstStart = attachment.start();
    expect(attachment.start()).toBe(firstStart);
    await firstStart;

    expect(attachment.status).toBe('ready');
    expect(modelContext.registerTool).toHaveBeenCalledTimes(3);
    expect(tools).toHaveLength(3);
    expect(signals).toHaveLength(3);
    expect(signals.every((signal) => !signal.aborted)).toBe(true);

    attachment.stop();
    expect(attachment.status).toBe('idle');
    expect(signals.every((signal) => signal.aborted)).toBe(true);
  });

  it('reports unsupported environments without throwing', async () => {
    const store = createTodosStore();
    const attachment = attachWebMCP(store, { events: 'todo' });

    await attachment.start();

    expect(attachment.status).toBe('unsupported');
  });

  it('reports registration errors through the attachment status', async () => {
    const store = createTodosStore();
    const error = new Error('registration failed');
    const modelContext: WebMCPModelContext = {
      registerTool: vi.fn(async () => {
        throw error;
      })
    };
    const attachment = attachWebMCP(store, {
      events: 'todo',
      modelContext
    });

    await attachment.start();

    expect(attachment.status).toBe('error');
    expect(attachment.error).toBe(error);
  });
});
