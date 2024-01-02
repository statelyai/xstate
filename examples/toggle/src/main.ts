import './style.css';

import { toggleMachine } from './toggleMachine';
import { createActor } from 'xstate';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <div class="card">
      <output id="output"></output>
      <button id="toggle" type="button">Toggle</button>
    </div>
  </div>
`;

const toggleActor = createActor(toggleMachine);

const toggleButton = document.querySelector<HTMLButtonElement>('#toggle')!;
const outputEl = document.querySelector<HTMLDivElement>('#output')!;

toggleActor.subscribe((snapshot) => {
  outputEl.innerHTML = snapshot.value === 'active' ? 'Active' : 'Inactive';
});

toggleActor.start();

toggleButton?.addEventListener('click', () => {
  toggleActor.send({ type: 'toggle' });
});
