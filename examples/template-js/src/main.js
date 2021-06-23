import { interpret } from 'xstate';
import { toggleMachine } from './toggle.machine';
import './style.css';

const app = document.querySelector('#app');

app.innerHTML = `
  <h1>XState JavaScript Template</h1>
  <p>Open the console!</p>
  <button id="toggle">Toggle</button>
`;

const button = document.querySelector('#toggle');

// Edit your service(s) here
const service = interpret(toggleMachine).onTransition((state) => {
  console.log(state.value);
  button.dataset.state = state.value;
});

service.start();

button?.addEventListener('click', () => {
  service.send('TOGGLE');
});
