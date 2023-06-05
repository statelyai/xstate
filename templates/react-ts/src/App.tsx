import { useReducer, useState } from 'react';
import './App.css';
import {
  assign,
  createMachine,
  fromPromise,
  interpret,
  raise,
  sendTo
} from 'xstate';
import { useActorRef, useActor, useSelector } from '@xstate/react';

const machine = createMachine(
  {
    /** @xstate-layout N4IgpgJg5mDOIC5QDMyQEYEMDGBrAxNgDYD2sYA2gAwC6ioADmQJYAuzJAdvSAB6IAWAEwAaEAE9EADgCMAOgEBOZcqEBWAOwyqQ4QF89Y1Bhy45DAE4kAtg1b5jELHjlQSJCNTpIQTWGw5uH34EIRlFOQ1ZdQA2GSkNKkU1UQlEGQEqKjkhKgBmGULFGIE1TRiDIzQnU3MrW3tHZzMsT1oePwCuHhDCgTk8xSkBATyYhKSUmTFJBCk1PMj87SihRUHhypAm2uQSC2t8CC4wOVhWTFZTnZc9g68OlnZu4MQUmfSYjSElgsmqeIxNQCLY3Mx3Q7NB4+TrPIKgXpSbJCeYyGK6PKJZKpWYCL4KDRAzTlAQaRQyUHVZpyCEOKm1ACuDAgl0o7RhT0CPUQMRiESoUW0ahig1KhI+CDyozkWVlQhRGUUZMpJlu+2sckgAU4UHwsAZ6GsbGhjE5LwR0hKOQWiioCxGMSo8wlwvkuQKugEhU9KpqaoOmog2t1+sNxpk3lN-jh3IQaioMQUmioXo2KI0AglfI0cmSBRWeTyYQyvupELOBqNrHYOqOJzkzE4ADcSLhrvT-RrQ1Wa1AEI2W9hLoEvCbfGb4XxEFQJVRS7t1RWw9XG7qoeyo11JyFSWoFAnZDIhJilFIpBKhYslMp5hpC8WQYZth3wYvu2xe-heOdWXJMMgrgsAAKeMsgASjpVVXwDd8Vx1MdYS5V4EBnNIUPnFxiDISB8AsOALgsVgEInWNdETbR1ltL55TPGIJVkORQKyXIshKEUDCfTgPDgHgwUeaMkItBAAFpiglYSZA0NQMLMSwbDsfit1jTQs0xOQpAVNFBmUJQNBkml1UUmNkOEgRzzQ4SEkY-Tyy1XsjMEqcEFKKQk0SVMhnTTM0KUK8FiPEZvVGZIbMXOzVzkBlOAgMBAKNThIAc80nJtAYylJeZyQ0vkXSRXN-M9ILHyqKCDIDcKdTkJtMCIZgICS7c3jvORJLUJEsk0FzvNmEUIlKfMpO+eVCVC8qg17BtmxquqGtjO9FnCDItM8hJup5IYkz+I9EkdDTRq7SsP1XWbkKUeQtDMhYpBWjMJWUbIVCGTR7z6fbNQsKwLBOoTUNmGQpX6PNCgFF6SyfMEyoO5crnqjkBOSndyTclN-putaEAC1ygYLItXvBl85FYAALTBOFweA4aU5C0UTL54mJa6MhTDQLy+LGFiddz5TyKR9Kw8hYc3YyhIyRYNNkKRC0lp04jyeifllZjZTYtYOL0IA */
    id: 'feedback',
    initial: 'prompt',
    types: {} as {
      context: {
        feedback: string;
        response?: any;
      };
      events:
        | {
            type: 'feedback.good';
          }
        | {
            type: 'feedback.bad';
          }
        | {
            type: 'feedback.update';
            feedback: string;
          }
        | {
            type: 'back';
          }
        | {
            type: 'submit';
          };
    },
    context: ({ input }) => ({
      feedback: input.feedbackTemplate ?? '',
      response: undefined
    }),
    invoke: {
      src: 'toaster',
      systemId: 'globalToaster'
    },
    states: {
      prompt: {
        entry: 'track',
        on: {
          'feedback.good': {
            target: 'thanks'
          },
          'feedback.bad': {
            target: 'form'
          }
        }
      },

      form: {
        on: {
          back: 'prompt',

          'feedback.update': {
            actions: 'updateFeedback'
          }
        },

        states: {
          editing: {
            on: {
              submit: [
                {
                  guard: {
                    type: 'formValid',
                    params: {
                      minLength: 5
                    }
                  },
                  target: 'submitting'
                },
                '.invalid'
              ]
            },

            states: {
              undetermined: {},
              valid: {},
              invalid: {}
            },

            initial: 'undetermined'
          },

          submitting: {
            invoke: {
              src: 'submitFeedback',
              input: ({ context }) => ({
                feedback: context.feedback
              }),
              onDone: {
                target: 'submitted',
                actions: assign({
                  response: ({ event }) => event.output
                })
              }
            },

            after: {
              5000: {
                target: 'error'
              }
            },

            on: {
              // forbidden transition
              back: {}
            }
          },

          error: {},

          submitted: {
            type: 'final'
          }
        },

        initial: 'editing',
        onDone: 'thanks'
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
      track: ({ event, action }) => {
        console.log('tracking', event, action);
      },
      updateFeedback: assign({
        feedback: ({ event }) => event.value
      })
    },
    guards: {
      formValid: ({ context, guard }) =>
        context.feedback.length > guard.params.minLength
    },
    actors: {
      submitFeedback: fromPromise(async ({ input }) => {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        return {
          status: 'success',
          feedback: input.feedback
        };
      })
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
        defaultValue={feedback}
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
  const actor = useActorRef(machine, {
    input: {
      feedbackTemplate: 'I am very mad because...'
    }
  });
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
      {state.matches({ form: 'error' }) && <em>Sorry, API took too long.</em>}
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
            <pre>{JSON.stringify(state.context.response, null, 2)}</pre>
          )}
        </div>
      )}

      {state.matches('form') && <FormScreen actor={actor} />}
      <pre
        style={{
          fontSize: '2rem'
        }}
      >
        {JSON.stringify(state.value, null, 2)}
      </pre>
    </div>
  );
}

function App() {
  return <Feedback />;
}

export default App;
