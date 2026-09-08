import { expect, it, vi, afterEach } from 'vitest';
import { createActor } from 'xstate';
import { todoMachine } from './todoMachine';
import { todosMachine } from './todosMachine';
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
it('adds, edits, marks, filters, clears and deletes todos without mutating old state', () => {
  const actor = createActor(todosMachine).start();
  const initial = actor.getSnapshot();
  actor.send({ type: 'newTodo.commit', value: ' ' });
  expect(actor.getSnapshot()).toBe(initial);
  actor.send({ type: 'newTodo.commit', value: 'Write tests' });
  const todo = actor.getSnapshot().context.todos[1];
  actor.send({ type: 'todo.commit', todo: { ...todo, title: 'Review tests' } });
  actor.send({ type: 'todo.mark', id: todo.id, mark: 'completed' });
  actor.send({ type: 'filter.change', filter: 'completed' });
  expect(actor.getSnapshot().context.filter).toBe('completed');
  actor.send({ type: 'todos.clearCompleted' });
  expect(actor.getSnapshot().context.todos).toEqual(initial.context.todos);
  actor.send({
    type: 'todo.commit',
    todo: { ...initial.context.todos[0], title: '' }
  });
  expect(actor.getSnapshot().context.todos).toEqual([]);
  expect(initial.context.todos).toHaveLength(1);
  actor.stop();
});
it('commits an edited title once, and cancel restores the prior title', () => {
  const commit = vi.fn();
  const focus = vi.fn();
  const actor = createActor(
    todoMachine.provide({ actions: { onCommit: commit, focusInput: focus } }),
    { input: { todo: { id: '1', title: 'Old', completed: false } } }
  ).start();
  actor.send({ type: 'edit' });
  actor.send({ type: 'change', value: 'New' });
  actor.send({ type: 'cancel' });
  expect(actor.getSnapshot().context.title).toBe('Old');
  expect(commit).not.toHaveBeenCalled();
  actor.send({ type: 'edit' });
  actor.send({ type: 'change', value: 'New' });
  actor.send({ type: 'blur' });
  actor.send({ type: 'blur' });
  expect(commit).toHaveBeenCalledExactlyOnceWith({ title: 'New' });
  expect(focus).toHaveBeenCalledTimes(2);
  actor.stop();
});
