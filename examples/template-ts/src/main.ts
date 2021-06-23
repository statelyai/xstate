import { interpret } from 'xstate';
import './style.css';
import { machine } from './toggle.machine';

const app = document.querySelector<HTMLDivElement>('#app')!;

app.innerHTML = `
  <h1>XState TypeScript Template</h1>
  <p>Open the console!</p>
  <button id="toggle">Toggle</button>
`;

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
