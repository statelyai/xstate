import './App.css';
import { feedbackMachine } from './feedbackMachine';
import { useMachine } from '@xstate/react';

function FeedbackForm(props: { onSubmit: (feedback: string) => void }) {
  return (
    <form
      className="step"
      onSubmit={(ev) => {
        ev.preventDefault();

        const form = ev.target as HTMLFormElement;
        const feedback = form.elements.feedback as HTMLTextAreaElement;

        props.onSubmit(feedback.value);
      }}
    >
      <h2>What can we do better?</h2>
      <textarea name="feedback" rows={4} placeholder="So many things..." />
      <button className="button">Submit</button>
    </form>
  );
}

function Feedback() {
  const [state, send] = useMachine(feedbackMachine);

  if (state.matches('closed')) {
    return <em>Feedback form closed.</em>;
  }

  return (
    <div className="feedback">
      <button
        className="close-button"
        onClick={() => {
          send({ type: 'close' });
        }}
      >
        Close
      </button>
      {state.matches('prompt') && (
        <div className="step">
          <h2>How was your experience?</h2>
          <button className="button" onClick={() => send('feedback.good')}>
            Good
          </button>
          <button className="button" onClick={() => send('feedback.bad')}>
            Bad
          </button>
        </div>
      )}
      {state.matches('thanks') && (
        <div className="step">
          <h2>Thanks for your feedback.</h2>
          <p>"{state.context.feedback}"</p>
        </div>
      )}

      {state.matches('form') && (
        <FeedbackForm
          onSubmit={(feedback) => {
            send({ type: 'submit', feedback });
          }}
        />
      )}
    </div>
  );
}

function App() {
  return <Feedback />;
}

export default App;
