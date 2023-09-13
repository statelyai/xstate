import './style.css';

import { toggleMachine } from './toggleMachine';
import { interpret } from 'xstate';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <div class="card">
      <output id="output"></output>
      <button id="toggle" type="button">Toggle</button>
    </div>
  </div>
`;

const toggleActor = interpret(toggleMachine).start();

const toggleButton = document.querySelector<HTMLButtonElement>('#toggle')!;
const outputEl = document.querySelector<HTMLDivElement>('#output')!;

toggleActor.subscribe((snapshot) => {
  outputEl.innerHTML = snapshot.value === 'active' ? 'Active' : 'Inactive';
});

toggleButton?.addEventListener('click', () => {
  toggleActor.send({ type: 'toggle' });
});
