import './App.css';
import { useMachine } from '@xstate/react';
import { createBrowserInspector } from '@statelyai/inspect';
import { timerMachine } from './timerMachine';

const inspector = createBrowserInspector();

function convertSecondsToTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const secondsLeft = seconds % 60;
  return {
    minutes,
    seconds: secondsLeft
  };
}

function padTime(minsOrSecs: number) {
  return minsOrSecs < 10 ? `0${minsOrSecs}` : minsOrSecs;
}

function App() {
  const [state, send] = useMachine(timerMachine, {
    inspect: inspector.inspect
  });
  const { minutes, seconds } = convertSecondsToTime(state.context.seconds);

  return (
    <div className="App">
      <h1>
        {padTime(minutes)}:{padTime(seconds)}
      </h1>
      <button
        onClick={() =>
          send({
            type: 'minute'
          })
        }
        disabled={!state.can({ type: 'minute' })}
      >
        min
      </button>
      <button
        onClick={() =>
          send({
            type: 'second'
          })
        }
        disabled={!state.can({ type: 'second' })}
      >
        sec
      </button>
      <button
        onClick={() =>
          send({
            type: 'reset'
          })
        }
        disabled={!state.can({ type: 'reset' })}
      >
        reset
      </button>
      <button
        onClick={() =>
          send({
            type: 'start'
          })
        }
        disabled={!state.can({ type: 'start' })}
      >
        start
      </button>
      <button
        onClick={() =>
          send({
            type: 'stop'
          })
        }
        disabled={!state.can({ type: 'stop' })}
      >
        stop
      </button>
    </div>
  );
}

export default App;
