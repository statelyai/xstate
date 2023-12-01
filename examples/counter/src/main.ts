import './style.css';

import { counterMachine } from './counterMachine';
import { interpret } from 'xstate';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <div class="card">
      <output id="output"></output>
      <button id="increment" type="button">Increment</button>
      <button id="decrement" type="button">Decrement</button>
    </div>
  </div>
`;

const incrementButton =
  document.querySelector<HTMLButtonElement>('#increment')!;
const decrementButton =
  document.querySelector<HTMLButtonElement>('#decrement')!;
const outputEl = document.querySelector<HTMLDivElement>('#output')!;

function render(count: number): void {
  outputEl.innerHTML = `Count is ${count}`;
}

const counterActor = interpret(counterMachine);

counterActor.subscribe((state) => {
  render(state.context.count);
});

counterActor.start();

incrementButton?.addEventListener('click', () => {
  counterActor.send({ type: 'increment' });
});

decrementButton?.addEventListener('click', () => {
  counterActor.send({ type: 'decrement' });
});

// setupCounter(document.querySelector<HTMLButtonElement>('#counter')!);
