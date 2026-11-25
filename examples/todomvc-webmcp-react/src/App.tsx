import { useEffect, useState } from 'react';
import cn from 'classnames';
import { useSelector } from '@xstate/react';
import { AgentPanel } from './AgentPanel';
import { modelContext, todosActor, webMCP } from './todos';
import type { TodoItem, TodosFilter } from './todosMachine';

const filters: TodosFilter[] = ['all', 'active', 'completed'];

function readHashFilter(): TodosFilter {
  const filter = window.location.hash.slice(2);
  return filters.includes(filter as TodosFilter)
    ? (filter as TodosFilter)
    : 'all';
}

function visibleTodos(todos: TodoItem[], filter: TodosFilter) {
  if (filter === 'all') return todos;
  return todos.filter((todo) => todo.completed === (filter === 'completed'));
}

export function App() {
  const { todos, filter } = useSelector(todosActor, (s) => s.context);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<{ id: string; title: string }>();
  const send = todosActor.send;

  useEffect(() => {
    const onHashChange = () =>
      send({ type: 'filter.change', filter: readHashFilter() });
    onHashChange();
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [send]);

  // Agents can change the filter too; keep the URL in sync.
  useEffect(() => {
    if (readHashFilter() !== filter) {
      window.location.hash = filter === 'all' ? '/' : `/${filter}`;
    }
  }, [filter]);

  const activeCount = todos.filter((todo) => !todo.completed).length;
  const allCompleted = todos.length > 0 && activeCount === 0;

  function commitEdit() {
    if (editing) {
      send({ type: 'todo.edit', ...editing });
      setEditing(undefined);
    }
  }

  return (
    <>
      <section className="todoapp">
        <header className="header">
          <h1>todos</h1>
          <input
            className="new-todo"
            placeholder="What needs to be done?"
            autoFocus
            value={draft}
            onChange={(ev) => setDraft(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' && draft.trim()) {
                send({ type: 'todo.add', title: draft.trim() });
                setDraft('');
              }
            }}
          />
        </header>

        {todos.length > 0 && (
          <>
            <section className="main">
              <input
                id="toggle-all"
                className="toggle-all"
                type="checkbox"
                checked={allCompleted}
                onChange={() =>
                  send({
                    type: 'todo.markAll',
                    mark: allCompleted ? 'active' : 'completed'
                  })
                }
              />
              <label htmlFor="toggle-all">Mark all as complete</label>
              <ul className="todo-list">
                {visibleTodos(todos, filter).map((todo) => (
                  <li
                    key={todo.id}
                    className={cn({
                      completed: todo.completed,
                      editing: editing?.id === todo.id
                    })}
                  >
                    <div className="view">
                      <input
                        className="toggle"
                        type="checkbox"
                        checked={todo.completed}
                        onChange={(ev) =>
                          send({
                            type: 'todo.mark',
                            id: todo.id,
                            mark: ev.target.checked ? 'completed' : 'active'
                          })
                        }
                      />
                      <label
                        onDoubleClick={() =>
                          setEditing({ id: todo.id, title: todo.title })
                        }
                      >
                        {todo.title}
                      </label>
                      <button
                        className="destroy"
                        onClick={() =>
                          send({ type: 'todo.delete', id: todo.id })
                        }
                      />
                    </div>
                    {editing?.id === todo.id && (
                      <input
                        className="edit"
                        autoFocus
                        value={editing.title}
                        onChange={(ev) =>
                          setEditing({ id: todo.id, title: ev.target.value })
                        }
                        onBlur={commitEdit}
                        onKeyDown={(ev) => {
                          if (ev.key === 'Enter') commitEdit();
                          if (ev.key === 'Escape') setEditing(undefined);
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <footer className="footer">
              <span className="todo-count">
                <strong>{activeCount}</strong>{' '}
                {activeCount === 1 ? 'item' : 'items'} left
              </span>
              <ul className="filters">
                {filters.map((name) => (
                  <li key={name}>
                    <a
                      className={cn({ selected: filter === name })}
                      href={name === 'all' ? '#/' : `#/${name}`}
                    >
                      {name[0].toUpperCase() + name.slice(1)}
                    </a>
                  </li>
                ))}
              </ul>
              {activeCount < todos.length && (
                <button
                  className="clear-completed"
                  onClick={() => send({ type: 'todos.clearCompleted' })}
                >
                  Clear completed
                </button>
              )}
            </footer>
          </>
        )}
      </section>

      <AgentPanel webMCP={webMCP} modelContext={modelContext} />
    </>
  );
}
