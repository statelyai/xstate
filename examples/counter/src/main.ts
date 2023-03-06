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
    <p class="read-the-docs">
      Click on the Vite and TypeScript logos to learn more
    </p>
  </div>
`;

const counterActor = interpret(counterMachine).start();

const incrementButton =
  document.querySelector<HTMLButtonElement>('#increment')!;
const decrementButton =
  document.querySelector<HTMLButtonElement>('#decrement')!;
const outputEl = document.querySelector<HTMLDivElement>('#output')!;

counterActor.subscribe((state) => {
  outputEl.innerHTML = `Count is ${state.context.count}`;
});

incrementButton?.addEventListener('click', () => {
  counterActor.send({ type: 'increment' });
});

decrementButton?.addEventListener('click', () => {
  counterActor.send({ type: 'decrement' });
});

// setupCounter(document.querySelector<HTMLButtonElement>('#counter')!);
