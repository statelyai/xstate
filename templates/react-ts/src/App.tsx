import { useState } from 'react';
import './App.css';

function Feedback() {
  const [state, setState] = useState('prompt');
  const isClosed = false;
  const feedback = '';

  if (isClosed) {
    return (
      <div>
        <em>Feedback form closed.</em>
        <br />
        <button
          onClick={() => {
            // Send event...
          }}
        >
          Provide more feedback
        </button>
      </div>
    );
  }

  return (
    <div className="feedback">
      <button
        className="close-button"
        onClick={() => {
          // Send event...
        }}
      >
        Close
      </button>
      {state === 'prompt' && (
        <div className="step">
          <h2>How was your experience?</h2>
          <button
            className="button"
            onClick={() => {
              // Send event...
            }}
          >
            Good
          </button>
          <button
            className="button"
            onClick={() => {
              // Send event...
            }}
          >
            Bad
          </button>
        </div>
      )}

      {state === 'thanks' && (
        <div className="step">
          <h2>Thanks for your feedback.</h2>
          {feedback.length > 0 && <p>"{feedback}"</p>}
        </div>
      )}

      {state === 'form' && (
        <form
          className="step"
          onSubmit={(ev) => {
            ev.preventDefault();
            // Send event...
          }}
        >
          <h2>What can we do better?</h2>
          <textarea
            name="feedback"
            rows={4}
            placeholder="So many things..."
            onChange={() => {
              // Send event...
            }}
          />
          <button className="button" disabled={false}>
            Submit
          </button>
          <button
            className="button"
            type="button"
            onClick={() => {
              // Send event...
            }}
          >
            Back
          </button>
        </form>
      )}
    </div>
  );
}

function App() {
  return <Feedback />;
}

export default App;
