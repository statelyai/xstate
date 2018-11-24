import React, { useEffect } from 'react';
import cn from 'classnames';
import 'todomvc-app-css/index.css';
import { useMachine } from './useMachine';
import { Todo } from './Todo';
import { todosMachine } from './todosMachine';

function filterTodos(state, todos) {
  if (state.matches('all')) {
    return todos;
  }

  if (state.matches('active')) {
    return todos.filter(todo => !todo.completed);
  }

  if (state.matches('completed')) {
    return todos.filter(todo => todo.completed);
  }
}

const persistedTodosMachine = todosMachine.withConfig(
  {
    actions: {
      persist: ctx => {
        localStorage.setItem('todos-xstate', JSON.stringify(ctx.todos));
      }
    }
  },
  {
    todo: 'Learn state machines',
    todos: (() => {
      try {
        return JSON.parse(localStorage.getItem('todos-xstate')) || [];
      } catch (e) {
        return [];
      }
    })()
  }
);

export function Todos() {
  const [state, send] = useMachine(persistedTodosMachine);

  useEffect(() => {
    const handler = window.addEventListener('hashchange', e => {
      send(`SHOW.${window.location.hash.slice(2) || 'all'}`);
    });

    return window.removeEventListener('hashchange', handler);
  }, []);

  const { todos } = state.context;

  const mark = todos.some(todo => !todo.completed) ? 'completed' : 'active';
  const markEvent = `MARK.${mark}`;
  const filteredTodos = filterTodos(state, state.context.todos);
  const numActiveTodos = todos.filter(todo => !todo.completed).length;

  return (
    <section className="todoapp" data-state={state.toStrings()}>
      <header className="header">
        <h1>todos</h1>
        <input
          className="new-todo"
          placeholder="What needs to be done?"
          autoFocus
          onKeyPress={e => {
            if (e.key === 'Enter') {
              send({ type: 'NEWTODO.COMMIT', value: e.target.value });
            }
          }}
          onChange={e =>
            send({
              type: 'NEWTODO.CHANGE',
              value: e.target.value
            })
          }
          value={state.context.todo}
        />
      </header>
      <section className="main">
        <input
          id="toggle-all"
          className="toggle-all"
          type="checkbox"
          onChange={e => {
            send(markEvent);
          }}
        />
        <label htmlFor="toggle-all" title={`Mark all as ${mark}`}>
          Mark all as {mark}
        </label>
        <ul className="todo-list">
          {filteredTodos.map(todo => (
            <Todo
              key={todo.id}
              todo={todo}
              onChange={todo => send({ type: 'TODO.COMMIT', todo })}
              onDelete={id => send({ type: 'TODO.DELETE', id })}
            />
          ))}
        </ul>
      </section>
      {!!todos.length && (
        <footer className="footer">
          <span className="todo-count">
            <strong>{numActiveTodos}</strong> item
            {numActiveTodos === 1 ? '' : 's'} left
          </span>
          <ul className="filters">
            <li>
              <a
                className={cn({
                  selected: state.matches('all')
                })}
                href="#/"
              >
                All
              </a>
            </li>
            <li>
              <a
                className={cn({
                  selected: state.matches('active')
                })}
                href="#/active"
              >
                Active
              </a>
            </li>
            <li>
              <a
                className={cn({
                  selected: state.matches('completed')
                })}
                href="#/completed"
              >
                Completed
              </a>
            </li>
          </ul>
          {numActiveTodos < todos.length && (
            <button
              onClick={_ => send('CLEAR_COMPLETED')}
              className="clear-completed"
            >
              Clear completed
            </button>
          )}
        </footer>
      )}
    </section>
  );
}
