import { useEffect, useRef } from 'react';
import { useActorRef, useSelector } from '@xstate/react';
import cn from 'classnames';
import { setup, types } from 'xstate';
import { TodosContext } from './App';
import { TodoItem } from './todosMachine';

export const todoMachine = setup({
  schemas: {
    context: types<{
      initialTitle: string;
      title: string;
    }>(),
    events: {
      edit: types<{}>(),
      blur: types<{}>(),
      cancel: types<{}>(),
      change: types<{ value: string }>()
    },
    input: types<{ todo: TodoItem }>()
  }
}).createMachine({
  id: 'todo',
  initial: 'reading',
  context: ({ input }) => ({
    initialTitle: input.todo.title,
    title: input.todo.title
  }),
  states: {
    reading: {
      on: {
        edit: { target: 'editing' }
      }
    },
    editing: {
      // Remember the title to restore if the edit is cancelled
      entry: ({ context }) => ({
        context: { initialTitle: context.title }
      }),
      on: {
        blur: { target: 'reading' },
        cancel: ({ context }) => ({
          target: 'reading',
          context: { title: context.initialTitle }
        }),
        change: ({ event }) => ({
          context: { title: event.value }
        })
      }
    }
  }
});

export function Todo({ todo }: { todo: TodoItem }) {
  const todosActorRef = TodosContext.useActorRef();
  const todoActorRef = useActorRef(todoMachine, {
    input: { todo }
  });
  const { send } = todoActorRef;
  const { id, completed } = todo;
  const title = useSelector(todoActorRef, (s) => s.context.title);
  const isEditing = useSelector(todoActorRef, (s) => s.matches('editing'));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.select();
    }
  }, [isEditing]);

  function commit() {
    send({ type: 'blur' });
    todosActorRef.send({
      type: 'todo.commit',
      todo: {
        ...todo,
        title: todoActorRef.getSnapshot().context.title
      }
    });
  }

  return (
    <li
      className={cn({
        editing: isEditing,
        completed
      })}
      data-todo-state={completed ? 'completed' : 'active'}
      key={id}
    >
      <div className="view">
        <input
          className="toggle"
          type="checkbox"
          onChange={(ev) => {
            todosActorRef.send({
              type: 'todo.mark',
              id: todo.id,
              mark: ev.target.checked ? 'completed' : 'active'
            });
          }}
          checked={completed}
        />
        <label
          onDoubleClick={() => {
            send({ type: 'edit' });
          }}
        >
          {title}
        </label>{' '}
        <button
          className="destroy"
          onClick={() =>
            todosActorRef.send({
              type: 'todo.delete',
              id: todo.id
            })
          }
        />
      </div>
      <input
        className="edit"
        value={title}
        onBlur={commit}
        onChange={(ev) => {
          send({
            type: 'change',
            value: ev.target.value
          });
        }}
        onKeyPress={(ev) => {
          if (ev.key === 'Enter') {
            commit();
          }
        }}
        onKeyDown={(ev) => {
          if (ev.key === 'Escape') {
            send({ type: 'cancel' });
          }
        }}
        ref={inputRef}
      />
    </li>
  );
}
