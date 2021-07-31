import React from 'react';
import './App.css';
import { useMachine } from '@xstate/react';
import { friendsMachine } from './friends.machine';
import { Friend } from './Friend';

function App() {
  const [state, send] = useMachine(friendsMachine);

  return (
    <div className="app">
      <h2>Friends</h2>
      <table className="friendsTable">
        <tbody>
          {state.context.friends.map((friend) => {
            return <Friend key={friend.id} friendRef={friend}></Friend>;
          })}
          <tr>
            <td colSpan={2} className="actions">
              <input
                value={state.context.newFriendName}
                onChange={(e) =>
                  send({ type: 'NEW_FRIEND.CHANGE', name: e.target.value })
                }
                placeholder="New friend"
              />
              <button
                onClick={() => {
                  send({
                    type: 'FRIENDS.ADD',
                    name: state.context.newFriendName
                  });
                }}
              >
                Add friend
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default App;
