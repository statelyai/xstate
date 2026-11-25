import { createMockModelContext } from '@xstate/webmcp';
import { createActor } from 'xstate';
import { expect, it } from 'vitest';
import { todosMachine } from './todosMachine';
import { createTodosWebMCP } from './webmcp';

it('exposes the todo events and a combined tool to agents', async () => {
  const actor = createActor(todosMachine).start();
  const modelContext = createMockModelContext();

  await createTodosWebMCP(actor).register({ modelContext }).ready;

  expect(modelContext.getToolNames()).toEqual([
    'todo_add',
    'todo_edit',
    'todo_mark',
    'todo_markAll',
    'todo_delete',
    'todos_clearCompleted',
    'filter_change',
    'get_state',
    'add_todos'
  ]);

  await modelContext.executeTool('add_todos', { titles: ['Milk', 'Eggs'] });
  await modelContext.executeTool('todo_mark', { id: '2', mark: 'completed' });

  await expect(
    modelContext.executeTool('filter_change', { filter: 'completed' })
  ).resolves.toEqual({
    filter: 'completed',
    todos: [
      { id: '1', title: 'Learn state machines', completed: false },
      { id: '2', title: 'Milk', completed: true },
      { id: '3', title: 'Eggs', completed: false }
    ]
  });

  await expect(
    modelContext.executeTool('todo_add', { title: '   ' })
  ).rejects.toThrow(/Invalid input for tool "todo_add"/);
});
