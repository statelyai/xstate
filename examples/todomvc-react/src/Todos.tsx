import React, { useEffect, useRef } from 'react';
import cn from 'classnames';
import { useHashChange } from './useHashChange';
import { Todo } from './Todo';
import { TodosFilter, TodoItem } from './todosMachine';
import { TodosContext } from './App';

function filterTodos(filter: TodosFilter, todos: TodoItem[]) {
  if (filter === 'active') {
    return todos.filter((todo) => !todo.completed);
  }

  if (filter === 'completed') {
    return todos.filter((todo) => todo.completed);
  }

  return todos;
}

export function Todos() {
  const { send } = TodosContext.useActorRef();
  const state = TodosContext.useSelector((s) => s);

  useHashChange(() => {
    send({
      type: 'filter.change',
      filter: (window.location.hash.slice(2) || 'all') as TodosFilter
    });
  });

  // Capture initial state of browser hash
  useEffect(() => {
    window.location.hash.slice(2) &&
      send({
        type: 'filter.change',
        filter: window.location.hash.slice(2) as TodosFilter
      });
  }, [send]);

  const { todo, todos, filter } = state.context;

  const numActiveTodos = todos.filter((todo) => !todo.completed).length;
  const allCompleted = todos.length > 0 && numActiveTodos === 0;
  const mark = !allCompleted ? 'completed' : 'active';
  const filteredTodos = filterTodos(filter, todos);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (todos.length === 0) {
      inputRef.current?.focus();
    }
  }, [todos]);

  return (
    <section className="todoapp" data-state={state.toStrings()}>
      <header className="header">
        <h1>todos</h1>
        <input
          ref={inputRef}
          className="new-todo"
          placeholder="What needs to be done?"
          autoFocus
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              send({ type: 'newTodo.commit', value: e.currentTarget.value });
            }
          }}
          onChange={(e) =>
            send({ type: 'newTodo.change', value: e.currentTarget.value })
          }
          value={todo}
        />
      </header>

      {!!todos.length && (
        <>
          <section className="main">
            <input
              id="toggle-all"
              className="toggle-all"
              type="checkbox"
              checked={allCompleted}
              onChange={() => {
                send({
                  type: 'todo.markAll',
                  mark: allCompleted ? 'active' : 'completed'
                });
              }}
            />
            <label htmlFor="toggle-all" title={`Mark all as ${mark}`}>
              Mark all as {mark}
            </label>
            <ul className="todo-list">
              {filteredTodos.map((todo) => (
                <Todo key={todo.id} todo={todo} />
              ))}
            </ul>
          </section>

          <footer className="footer">
            <span className="todo-count">
              <strong>{numActiveTodos}</strong> item
              {numActiveTodos === 1 ? '' : 's'} left
            </span>
            <ul className="filters">
              <li>
                <a
                  className={cn({
                    selected: filter === 'all'
                  })}
                  href="#/"
                >
                  All
                </a>
              </li>
              <li>
                <a
                  className={cn({
                    selected: filter === 'active'
                  })}
                  href="#/active"
                >
                  Active
                </a>
              </li>
              <li>
                <a
                  className={cn({
                    selected: filter === 'completed'
                  })}
                  href="#/completed"
                >
                  Completed
                </a>
              </li>
            </ul>
            {numActiveTodos < todos.length && (
              <button
                // onClick={(_) => send('CLEAR_COMPLETED')}
                onClick={() => send({ type: 'todos.clearCompleted' })}
                className="clear-completed"
              >
                Clear completed
              </button>
            )}
          </footer>
        </>
      )}
    </section>
  );
}
