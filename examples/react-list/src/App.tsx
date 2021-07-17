import React from 'react';
import './App.css';
import { useMachine, useActor } from '@xstate/react';
import { friendsMachine } from './friends.machine';
import { friendMachine } from './friend.machine';
import { ActorRefFrom } from 'xstate';

const Friend: React.FC<{ friendRef: ActorRefFrom<typeof friendMachine> }> = ({
  friendRef
}) => {
  const [state, send] = useActor(friendRef);
  const { name, email } = state.context;

  console.log(state);

  return (
    <tr
      style={{
        opacity: state.matches('saving') ? 0.5 : 1
      }}
    >
      <td>
        <strong>{name}</strong>
        <form hidden={!state.hasTag('form')}>
          <label htmlFor="friend.name">
            <div>Name</div>
            <input
              type="text"
              id="friend.name"
              defaultValue={state.context.name}
              onBlur={(e) => {
                send({ type: 'SET_NAME', value: e.target.value });
              }}
            />
          </label>
          <label htmlFor="friend.url">
            <div>URL</div>
            <input
              type="text"
              id="friend.url"
              onBlur={(e) => {
                send({ type: 'SET_URL', value: e.target.value });
              }}
            />
          </label>
          <button onClick={() => send('SAVE')} type="button">
            Save
          </button>
        </form>
      </td>
      <td>
        <strong onClick={() => send('EDIT')}>{state._sessionid}</strong>
      </td>
    </tr>
  );
};

function App() {
  const [state, send] = useMachine(friendsMachine);

  return (
    <div className="app">
      <h1>XState React Template</h1>
      <h2>Fork this template!</h2>
      <button
        onClick={() => {
          const name = prompt("What is your friend's name?");
          send({ type: 'FRIENDS.ADD', name });
        }}
      >
        Add friend
      </button>
      <table className="friendsTable">
        <thead>
          <tr>
            <th>Friend</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {state.context.friends.map((friend) => {
            return <Friend key={friend.id} friendRef={friend}></Friend>;
          })}
        </tbody>
      </table>
    </div>
  );
}

export default App;
