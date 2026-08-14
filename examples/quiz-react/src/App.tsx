import { useMachine } from '@xstate/react';
import { createInspector } from '@statelyai/sdk';
import { questions, quizMachine, secondsLeft } from './quizMachine';
import './App.css';

const inspector = createInspector();

function App() {
  const [state, send] = useMachine(quizMachine, {
    inspect: inspector.inspect
  });
  const { index, score, answers } = state.context;

  if (state.matches('results')) {
    return (
      <section id="app">
        <h1>Results</h1>
        <p>
          {score} / {questions.length} correct
        </p>
        <ol className="summary">
          {questions.map((question, questionIndex) => {
            const choice = answers[questionIndex];
            return (
              <li key={question.prompt}>
                <span>{question.prompt}</span>
                <small>
                  {choice === null || choice === undefined
                    ? 'skipped'
                    : question.choices[choice]}
                  {choice === question.answer ? ' ✓' : ' ✗'}
                </small>
              </li>
            );
          })}
        </ol>
        <button onClick={() => send({ type: 'restart' })}>Start over</button>
      </section>
    );
  }

  const question = questions[index]!;

  return (
    <section id="app">
      <header>
        <span>
          Question {index + 1} of {questions.length}
        </span>
        <span className="timer">{secondsLeft(state.context)}s</span>
      </header>
      <h1>{question.prompt}</h1>
      <ul className="choices">
        {question.choices.map((choice, choiceIndex) => (
          <li key={choice}>
            <button
              onClick={() => send({ type: 'answer', choice: choiceIndex })}
            >
              {choice}
            </button>
          </li>
        ))}
      </ul>
      <button className="skip" onClick={() => send({ type: 'skip' })}>
        Skip
      </button>
    </section>
  );
}

export default App;
