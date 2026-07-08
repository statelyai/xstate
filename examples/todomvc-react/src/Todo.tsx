import React, { useRef } from 'react';
import { useActorRef, useSelector } from '@xstate/react';
import cn from 'classnames';
import { createMachine } from 'xstate';
import { TodosContext } from './App';
import { TodoItem } from './todosMachine';

export const todoMachine = createMachine({
  types: {
    context: {} as {
      initialTitle: string;
      title: string;
    },
    events: {} as
      | {
          type: 'edit';
        }
      | {
          type: 'blur';
        }
      | {
          type: 'cancel';
        }
      | {
          type: 'change';
          value: string;
        },
    input: {} as {
      todo: TodoItem;
    }
  },
  actions: {
    focusInput: () => {},
    onCommit: () => {}
  },
  id: 'todo',
  initial: 'reading',
  context: ({ input }) => ({
    initialTitle: input.todo.title,
    title: input.todo.title
  }),
  states: {
    reading: {
      on: {
        edit: 'editing'
      }
    },
    editing: {
      entry: (args, enq) => {
        enq((actionArgs) => args.actions['focusInput'](actionArgs as any));
        return {
          context: {
            ...args.context,
            initialTitle: (({ context }) => context.title)({
              context: args.context,
              event: args.event
            })
          }
        };
      },
      on: {
        blur: ({ context, event, guards, actions }, enq) => {
          enq((actionArgs) => actions['onCommit'](actionArgs as any));
          return { target: 'reading' };
        },
        cancel: ({ context, event, guards, actions }, enq) => {
          return {
            target: 'reading',
            context: {
              ...context,
              title: (({ context }) => context.initialTitle)({
                context: context,
                event: event
              })
            }
          };
        },
        change: ({ context, event, guards, actions }, enq) => {
          return {
            context: {
              ...context,
              title: (({ event }) => event.value)({
                context: context,
                event: event
              })
            }
          };
        }
      }
    }
  }
});

export function Todo({ todo }: { todo: TodoItem }) {
  const todosActorRef = TodosContext.useActorRef();
  const todoActorRef = useActorRef(
    todoMachine.provide({
      actions: {
        onCommit: ({ context }) => {
          todosActorRef.send({
            type: 'todo.commit',
            todo: {
              ...todo,
              title: context.title
            }
          });
        },
        focusInput: () => {
          setTimeout(() => {
            inputRef.current && inputRef.current.select();
          });
        }
      }
    }),
    {
      input: { todo }
    }
  );
  const { send } = todoActorRef;
  const { id, completed } = todo;
  const title = useSelector(todoActorRef, (s) => s.context.title);
  const isEditing = useSelector(todoActorRef, (s) => s.matches('editing'));
  const inputRef = useRef<HTMLInputElement>(null);

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
        onBlur={() => send({ type: 'blur' })}
        onChange={(ev) => {
          send({
            type: 'change',
            value: ev.target.value
          });
        }}
        onKeyPress={(ev) => {
          if (ev.key === 'Enter') {
            send({ type: 'blur' });
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
