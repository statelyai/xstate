import React from 'react';
import { useSelector } from '@xstate/react';
import { friendMachine } from './friendMachine';
import { ActorRefFrom } from 'xstate';

export const Friend: React.FC<{
  friendRef: ActorRefFrom<typeof friendMachine>;
  onRemove: () => void;
}> = ({ friendRef, onRemove }) => {
  const selection = useSelector(friendRef, (snapshot) => ({
    context: snapshot?.context,
    // not working:
    // hasTag: snapshot?.hasTag,
    // matches: snapshot?.matches,
    value: snapshot?.value,
    tags: snapshot?.tags
  }));
  const {
    context,
    value,
    tags,
  } = selection;

  const { name } = context;

  return (
    <tr
      style={{
        opacity: value === 'saving' ? 0.5 : 1
      }}
    >
      <td width="100%">
        <strong>{name}</strong>
        <form
          className="friendForm"
          hidden={!tags.has('form')}
          onSubmit={(event) => {
            event.preventDefault();
            friendRef.send({ type: 'SAVE' });
          }}
        >
          <label className="field" htmlFor="friend.name">
            <div className="label">Name</div>
            <input
              type="text"
              id="friend.name"
              value={name}
              onChange={(event) => {
                friendRef.send({ type: 'SET_NAME', value: event.target.value });
              }}
            />
          </label>
        </form>
      </td>
      <td className="actionsCell">
        <div className="actions">
          {tags.has('form') && (
            <>
              <button
                disabled={tags.has('saving')}
                onClick={() => {
                  friendRef.send({ type: 'SAVE' });
                }}
              >
                Save
              </button>
              <button onClick={() => friendRef.send({ type: 'CANCEL' })} type="button">
                Cancel
              </button>
            </>
          )}
          {tags.has('read') && (
            <>
              <button onClick={() => friendRef.send({ type: 'EDIT' })}>Edit</button>
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
