import { createMachine, interpret } from 'xstate';
import './style.css';

const app = document.querySelector('#app');

app.innerHTML = `
  <h1>XState JavaScript Template</h1>
  <p>Open the console!</p>
  <button id="toggle">Toggle</button>
`;

// Edit your machine(s) here
const machine = createMachine({
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

const button = document.querySelector('#toggle');

// Edit your service(s) here
const service = interpret(machine).onTransition((state) => {
  console.log(state.value);
  button.dataset.state = state.value;
});

service.start();

button?.addEventListener('click', () => {
  service.send('TOGGLE');
});
