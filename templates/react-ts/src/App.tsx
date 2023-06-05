import { useReducer, useState } from 'react';
import './App.css';
import { assign, createMachine, raise } from 'xstate';
import { useInterpret, useMachine, useSelector } from '@xstate/react';

const machine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QDMyQEYEMDGBrAxNgDYD2sYA2gAwC6ioADmQJYAuzJAdvSAB6JUANCACeAgL7jhqDDlwA6BgCcSAWwat8MiFjzyoJEhGp0kIJrDYduZ-ggAsADgCc8gMwBWZ24DsH4WIIAEwAjFTubpFR0ZH2ktJoOnKKKuqa2roKWMa0PBZWXDx2Ho4+8s4+AGwelUH+oohuVJXyjiF18SAZycgkSqr4sACu6KpsJnks7IW2iM4eQa1Ujl6+9YGOjvIhPvaenh4+K27Vnd16vf34mRNm+dM2oMWVbu5+AYht8h5niZnylwG5wUQwYEEwrEouTuU2sRUQhxaoSo3neDQQAFpHK99h4QjUOlIun9ksQyJB8Eo4KxMEpWLdGLCZk8EYsgic3EE2nUPghOSF5HUKtVaj9OpwjHAeMDJpYHvDMR5wj4gtUfFR2t5nPYPG5eRiduFjnjHPZ7EFnFQfD5frI9Mo1BpZQVHnxEFzXuq3O11o1mvIqG5LaLbUkLn1VM75bMEJVKgKRTz0ZaA9iYjE4kTgfJWAALTCcXDwGFyuEx5wV+R+IPNJOBZERdMZ0P-MnkCBRssszGLFVqjUWoM671BXn4+xV1UEsWSIA */
    id: 'feedback',
    initial: 'prompt',
    context: {
      feedback: '',
      seconds: 3
    },
    states: {
      prompt: {
        entry: 'track',
        on: {
          'feedback.good': 'thanks',
          'feedback.bad': {
            target: 'form',
            actions: assign({
              seconds: 1
            })
          }
        }
      },

      form: {
        on: {
          submit: {
            cond: {
              type: 'formValid',
              params: {
                minLength: 5
              }
            },
            target: 'thanks'
          },
          back: 'prompt',
          'feedback.update': {
            actions: 'updateFeedback'
          }
        }
      },

      thanks: {},

      closed: {
        on: {
          restart: 'prompt'
        }
      }
    },
    on: {
      close: '.closed'
    }
  },
  {
    actions: {
      track: (context, event, { action }) => {
        console.log('tracking', event, action);
      },
      updateFeedback: assign({
        feedback: (_context, event) => event.value
      })
    },
    delays: {
      SOME_DELAY: (context) => context.seconds * 1000
    },
    guards: {
      formValid: (context, event, { cond }) =>
        context.feedback.length > cond.params.minLength
    }
  }
);

function ClosedScreen(props) {
  const { actor } = props;

  return (
    <div>
      <em>Feedback form closed (NEW COMPONENT).</em>
      <br />
      <button
        onClick={() => {
          actor.send({ type: 'restart' });
        }}
      >
        Provide more feedback
      </button>
    </div>
  );
}

function FormScreen(props) {
  const { actor } = props;
  const feedback = useSelector(actor, (state) => state.context.feedback);
  const canSubmit = useSelector(actor, (state) =>
    state.can({
      type: 'submit'
    })
  );

  return (
    <form
      className="step"
      onSubmit={(ev) => {
        ev.preventDefault();
        actor.send({ type: 'submit' });
      }}
    >
      <h2>What can we do better?</h2>
      <textarea
        name="feedback"
        rows={4}
        placeholder="So many things..."
        onChange={(ev) => {
          actor.send({
            type: 'feedback.update',
            value: ev.target.value
          });
        }}
      />
      <div>{feedback}</div>
      <button className="button" disabled={!canSubmit}>
        Submit
      </button>
      <button
        className="button"
        type="button"
        onClick={() => {
          actor.send({ type: 'back' });
        }}
      >
        Back
      </button>
    </form>
  );
}

function Feedback() {
  const actor = useInterpret(machine); // V5: useActorRef()
  const state = useSelector(actor, (state) => state);
  const isClosed = useSelector(actor, (state) => state.matches('closed'));

  if (isClosed) {
    return <ClosedScreen actor={actor} />;
  }

  return (
    <div className="feedback">
      <button
        className="close-button"
        onClick={() => {
          actor.send({ type: 'close' });
        }}
      >
        Close
      </button>
      {state.matches('prompt') && (
        <div className="step">
          <h2>How was your experience?</h2>
          <button
            className="button"
            onClick={() => {
              actor.send({ type: 'feedback.good' });
            }}
          >
            Good
          </button>
          <button
            className="button"
            onClick={() => {
              actor.send({ type: 'feedback.bad' });
            }}
          >
            Bad
          </button>
        </div>
      )}

      {state.matches('thanks') && (
        <div className="step">
          <h2>Thanks for your feedback.</h2>
          {state.context.feedback.length > 0 && (
            <p>"{state.context.feedback}"</p>
          )}
        </div>
      )}

      {state.matches('form') && <FormScreen actor={actor} />}
    </div>
  );
}

function App() {
  return <Feedback />;
}

export default App;
