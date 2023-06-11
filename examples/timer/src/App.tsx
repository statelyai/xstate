import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';
import { useMachine } from '@xstate/react';
import { timerMachine } from './timerMachine';

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
  const [state, send] = useMachine(timerMachine);
  const { minutes, seconds } = convertSecondsToTime(state.context.seconds);
  const can = state.can.bind(state);

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
        disabled={!can('minute')}
      >
        min
      </button>
      <button
        onClick={() =>
          send({
            type: 'second'
          })
        }
        disabled={!can('second')}
      >
        sec
      </button>
      <button
        onClick={() =>
          send({
            type: 'reset'
          })
        }
        disabled={!can('reset')}
      >
        reset
      </button>
      <button
        onClick={() =>
          send({
            type: 'start'
          })
        }
        disabled={!can('start')}
      >
        start
      </button>
      <button
        onClick={() =>
          send({
            type: 'stop'
          })
        }
        disabled={!can('stop')}
      >
        stop
      </button>
    </div>
  );
}

export default App;
