import './style.css';

import { createActor } from 'xstate';
import { createInspector } from '@statelyai/sdk';
import { trafficLightMachine } from './trafficLightMachine';

const inspector = createInspector();

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="card">
    <div class="light" id="light">
      <div class="lamp red" data-lamp="red"></div>
      <div class="lamp yellow" data-lamp="yellow"></div>
      <div class="lamp green" data-lamp="green"></div>
    </div>
    <div class="controls">
      <button id="walk" type="button">Pedestrian button</button>
      <button id="fault" type="button">Trigger fault</button>
      <button id="reset" type="button">Reset</button>
    </div>
    <output id="output"></output>
  </div>
`;

const actor = createActor(trafficLightMachine, { inspect: inspector.inspect });

const lamps = document.querySelectorAll<HTMLDivElement>('.lamp');
const output = document.querySelector<HTMLOutputElement>('#output')!;

actor.subscribe((snapshot) => {
  const inFault = snapshot.matches('fault');
  const flashOn = inFault && snapshot.matches({ fault: { lamp: 'on' } });
  const lit = inFault
    ? flashOn
      ? 'yellow'
      : null
    : (snapshot.value as { operating: string }).operating;

  lamps.forEach((lamp) => {
    lamp.classList.toggle('lit', lamp.dataset.lamp === lit);
  });

  const beeping = inFault && snapshot.matches({ fault: { buzzer: 'beeping' } });

  output.textContent = inFault
    ? `fault — flashing${beeping ? ' + beeping' : ''}`
    : `${lit} · cycles: ${snapshot.context.cycles}${
        snapshot.context.pedestrianWaiting ? ' · pedestrian waiting' : ''
      }`;
});

actor.start();

document
  .querySelector<HTMLButtonElement>('#walk')!
  .addEventListener('click', () => actor.send({ type: 'pedestrianRequest' }));
document
  .querySelector<HTMLButtonElement>('#fault')!
  .addEventListener('click', () => actor.send({ type: 'fault' }));
document
  .querySelector<HTMLButtonElement>('#reset')!
  .addEventListener('click', () => actor.send({ type: 'reset' }));
