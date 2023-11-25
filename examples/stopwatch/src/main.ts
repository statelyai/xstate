import './style.css';

import { stopwatchMachine } from './stopwatchMachine';
import { interpret } from 'xstate';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <div class="card">
      <output id="output"></output>
      <button id="start" type="button">start</button>
      <button id="stop" type="button">stop</button>
      <button id="reset" type="button">reset</button>
    </div>
  </div>
`;

const stopwatchActor = interpret(stopwatchMachine).start();

const startButton = document.querySelector<HTMLButtonElement>('#start')!;
const stopButton = document.querySelector<HTMLButtonElement>('#stop')!;
const resetButton = document.querySelector<HTMLButtonElement>('#reset')!;
const outputEl = document.querySelector<HTMLDivElement>('#output')!;

stopwatchActor.subscribe((state) => {
  outputEl.innerHTML = state.context.elapsed.toString();
});

startButton.addEventListener('click', () => {
  stopwatchActor.send({ type: 'start' });
});

stopButton.addEventListener('click', () => {
  stopwatchActor.send({ type: 'stop' });
});

resetButton.addEventListener('click', () => {
  stopwatchActor.send({ type: 'reset' });
});
