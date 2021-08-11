import React from 'react';
import './App.css';
import { useMachine } from '@xstate/react';
import { friendsMachine } from './friends.machine';
import { Friend } from './Friend';

function App() {
  const [state, send] = useMachine(friendsMachine);

  console.log(state);

  return (
    <div className="app">
      <h2>Friends</h2>
      <table className="friendsTable">
        <tbody>
          {state.context.friends.map((friend, index) => {
            return (
              <Friend
                key={friend.id}
                friendRef={friend}
                onRemove={() => send({ type: 'FRIEND.REMOVE', index })}
              />
            );
          })}
        </tbody>
      </table>
      <form
        className="newFriend"
        onSubmit={(e) => {
          e.preventDefault();
          send({
            type: 'FRIENDS.ADD',
            name: state.context.newFriendName
          });
        }}
      >
        <input
          value={state.context.newFriendName}
          onChange={(e) =>
            send({ type: 'NEW_FRIEND.CHANGE', name: e.target.value })
          }
          placeholder="New friend"
        />
        <button>Add friend</button>
      </form>
    </div>
  );
}

export default App;
