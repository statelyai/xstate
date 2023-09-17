import { useActor, useMachine } from '@xstate/react';
import { useEffect } from 'react';
import { AnyActorLogic, assign, createMachine } from 'xstate';

const checklistMachine = createMachine({
  context: {
    buttonClicked: false,
    favoriteSelected: false,
    emailEntered: false
  },
  on: {
    clickButton: {
      actions: assign({
        buttonClicked: true
      })
    },
    selectFavorite: {
      actions: assign({
        favoriteSelected: true
      })
    },
    enterEmail: {
      actions: assign({
        emailEntered: true
      })
    }
  }
});

export function Checklist() {
  const [state, send] = useActor(checklistMachine, {
    state: JSON.parse(localStorage.getItem('state') || 'null')
  });

  useEffect(() => {
    localStorage.setItem('state', JSON.stringify(state));
  }, [state]);

  return (
    <div>
      <h1>Checklist</h1>
      <div>
        <h2
          style={{
            // strike through if completed
            textDecoration: state.context.buttonClicked
              ? 'line-through'
              : 'none'
          }}
        >
          Click button
        </h2>
        <button
          data-testid="click-button"
          onClick={() => send({ type: 'clickButton' })}
        />
      </div>
      <div>
        <h2
          style={{
            // strike through if completed
            textDecoration: state.context.favoriteSelected
              ? 'line-through'
              : 'none'
          }}
        >
          Select favorite
        </h2>
        <button
          data-testid="select-favorite"
          onClick={() => send({ type: 'selectFavorite' })}
        />
      </div>
      <div>
        <h2
          style={{
            // strike through if completed
            textDecoration: state.context.emailEntered ? 'line-through' : 'none'
          }}
        >
          Enter email
        </h2>
        <input
          data-testid="email-input"
          onChange={(e) => send({ type: 'enterEmail', email: e.target.value })}
        />
      </div>
    </div>
  );
}
