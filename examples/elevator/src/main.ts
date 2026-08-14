import './style.css';

import { createActor } from 'xstate';
import { createBrowserInspector } from '@statelyai/inspect';
import {
  BOTTOM_FLOOR,
  TOP_FLOOR,
  directionOf,
  elevatorMachine
} from './elevatorMachine';

const inspector = createBrowserInspector();

const floors = Array.from(
  { length: TOP_FLOOR - BOTTOM_FLOOR + 1 },
  (_, index) => TOP_FLOOR - index
);

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="card">
    <div class="shaft">
      ${floors
        .map(
          (floor) => `
            <div class="floor" data-floor="${floor}">
              <span class="car"></span>
              <button type="button" data-call="${floor}">Call ${floor}</button>
            </div>`
        )
        .join('')}
    </div>
    <div class="controls">
      <button id="close" type="button">Close doors</button>
    </div>
    <output id="output"></output>
  </div>
`;

const actor = createActor(elevatorMachine, { inspect: inspector.inspect });

const output = document.querySelector<HTMLOutputElement>('#output')!;
const closeButton = document.querySelector<HTMLButtonElement>('#close')!;

actor.subscribe((snapshot) => {
  const { currentFloor, queue } = snapshot.context;
  const doorsOpen = snapshot.matches('doorsOpen');

  document.querySelectorAll<HTMLDivElement>('.floor').forEach((el) => {
    const floor = Number(el.dataset.floor);
    el.classList.toggle('here', floor === currentFloor);
    el.classList.toggle('open', floor === currentFloor && doorsOpen);
    el.classList.toggle('queued', queue.includes(floor));
  });

  closeButton.disabled = !doorsOpen;

  const direction = { '-1': 'down', '0': 'idle', '1': 'up' }[
    String(directionOf(snapshot.context))
  ];

  output.textContent = `${String(snapshot.value)} · floor ${currentFloor} · ${direction} · queue [${queue.join(', ')}]`;
});

actor.start();

document
  .querySelectorAll<HTMLButtonElement>('[data-call]')
  .forEach((button) => {
    button.addEventListener('click', () => {
      actor.send({ type: 'call', floor: Number(button.dataset.call) });
    });
  });

closeButton.addEventListener('click', () => {
  actor.send({ type: 'closeDoors' });
});
