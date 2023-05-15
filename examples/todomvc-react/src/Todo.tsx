import React, { useEffect, useRef, useState } from 'react';
import { useActor, useMachine } from '@xstate/react';
import cn from 'classnames';
import { assign, createMachine } from 'xstate';
import { TodosContext } from './App';
import { TodoItem } from './todosMachine';

export const todoMachine = createMachine({
  id: 'todo',
  initial: 'reading',
  types: {} as {
    context: {
      initialTitle: string;
      title: string;
    };
    events:
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
        };
  },
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
      entry: 'focusInput',
      on: {
        blur: {
          target: 'reading',
          actions: 'onCommit'
        },
        cancel: {
          target: 'reading',
          actions: assign({
            title: ({ context }) => context.initialTitle
          })
        },
        change: {
          actions: assign({
            title: ({ event }) => event.value
          })
        }
      }
    }
  }
});

export function Todo({ todo }: { todo: TodoItem }) {
  const todosActorRef = TodosContext.useActorRef();
  const [state, send] = useMachine(
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
  const inputRef = useRef<HTMLInputElement>(null);
  const { id, completed } = todo;
  const { title } = state.context;

  return (
    <li
      className={cn({
        editing: state.matches('editing'),
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
              // mark completed if checked, active if unchecked
              id: todo.id,
              mark: ev.target.checked ? 'completed' : 'active'
            });
          }}
          checked={completed}
        />
        <label
          onDoubleClick={(e) => {
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
        onBlur={(_) => send({ type: 'blur' })}
        onChange={(ev) => {
          send({
            type: 'change',
            value: ev.target.value
          });
        }}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            send({ type: 'blur' });
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            send({ type: 'cancel' });
          }
        }}
        ref={inputRef}
      />
    </li>
  );
}
