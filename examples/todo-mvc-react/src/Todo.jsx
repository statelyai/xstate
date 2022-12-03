import React, { useEffect, useRef } from 'react';
import { useActor } from '@xstate/react';
import cn from 'classnames';

export function Todo({ todoRef }) {
  const [state, send] = useActor(todoRef);
  const inputRef = useRef(null);
  const { id, title, completed } = state.context;

  useEffect(() => {
    if (state.actions.find((action) => action.type === 'focusInput')) {
      inputRef.current && inputRef.current.select();
    }
  }, [state.actions, todoRef]);

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
          onChange={(_) => {
            send('TOGGLE_COMPLETE');
          }}
          value={completed}
          checked={completed}
        />
        <label
          onDoubleClick={(e) => {
            send('EDIT');
          }}
        >
          {title}
        </label>{' '}
        <button className="destroy" onClick={() => send('DELETE')} />
      </div>
      <input
        className="edit"
        value={title}
        onBlur={(_) => send('BLUR')}
        onChange={(e) => send({ type: 'CHANGE', value: e.target.value })}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            send('COMMIT');
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            send('CANCEL');
          }
        }}
        ref={inputRef}
      />
    </li>
  );
}
