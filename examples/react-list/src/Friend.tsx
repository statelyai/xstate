import React from 'react';
import { useActor } from '@xstate/react';
import { friendMachine } from './friend.machine';
import { ActorRefFrom } from 'xstate';

export const Friend: React.FC<{
  friendRef: ActorRefFrom<typeof friendMachine>;
  onRemove: () => void;
}> = ({ friendRef, onRemove }) => {
  const [state, send] = useActor(friendRef);
  const { name } = state.context;

  return (
    <tr
      style={{
        opacity: state.matches('saving') ? 0.5 : 1
      }}
    >
      <td width="100%">
        <strong>{name}</strong>
        <form
          className="friendForm"
          hidden={!state.hasTag('form')}
          onSubmit={(event) => {
            event.preventDefault();

            send('SAVE');
          }}
        >
          <label className="field" htmlFor="friend.name">
            <div className="label">Name</div>
            <input
              type="text"
              id="friend.name"
              value={state.context.name}
              onChange={(event) => {
                send({ type: 'SET_NAME', value: event.target.value });
              }}
            />
          </label>
        </form>
      </td>
      <td className="actionsCell">
        <div className="actions">
          {state.hasTag('form') && (
            <>
              <button
                disabled={state.hasTag('saving')}
                onClick={() => {
                  send('SAVE');
                }}
              >
                Save
              </button>
              <button onClick={() => send('CANCEL')} type="button">
                Cancel
              </button>
            </>
          )}
          {state.hasTag('read') && (
            <>
              <button onClick={() => send('EDIT')}>Edit</button>
              <button className="remove" onClick={onRemove}>
                Remove
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
};
