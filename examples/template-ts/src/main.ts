import { createMachine, interpret } from 'xstate';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <h1>XState TypeScript Template</h1>
  <p>Open the console!</p>
  <button id="toggle">Toggle</button>
`;

interface ToggleContext {
  count: number;
}

type ToggleEvent = {
  type: 'TOGGLE';
};

// Edit your machine(s) here
const machine = createMachine<ToggleContext, ToggleEvent>({
  id: 'machine',
  initial: 'inactive',
  context: {
    count: 0
  },
  states: {
    inactive: {
      on: { TOGGLE: 'active' }
    },
    active: {
      on: { TOGGLE: 'inactive' }
    }
  }
});

const button = document.querySelector<HTMLButtonElement>('#toggle');

// Edit your service(s) here
const service = interpret(machine).onTransition((state) => {
  console.log(state.value);
  button!.dataset.state = state.value as string;
});

service.start();

button?.addEventListener('click', () => {
  service.send('TOGGLE');
});
