import './style.css';

import { createActor } from 'xstate';
import { createInspector } from '@statelyai/sdk';
import { settingsMachine } from './settingsMachine';

const inspector = createInspector();

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <h1>Settings</h1>
  <div class="controls">
    <button id="close" type="button">Close panel</button>
    <button id="open" type="button">Open (initial tab)</button>
    <button id="openShallow" type="button">Open (shallow history)</button>
    <button id="openDeep" type="button">Open (deep history)</button>
  </div>
  <div class="panel" id="panel">
    <div class="tabs">
      <button data-tab="general" type="button">General</button>
      <button data-tab="appearance" type="button">Appearance</button>
      <button data-tab="advanced" type="button">Advanced</button>
    </div>
    <div class="body" id="body"></div>
  </div>
  <output id="output"></output>
`;

const panel = document.querySelector<HTMLDivElement>('#panel')!;
const body = document.querySelector<HTMLDivElement>('#body')!;
const output = document.querySelector<HTMLOutputElement>('#output')!;
const tabButtons = document.querySelectorAll<HTMLButtonElement>('[data-tab]');

const actor = createActor(settingsMachine, { inspect: inspector.inspect });

actor.subscribe((snapshot) => {
  const isOpen = snapshot.matches('open');

  tabButtons.forEach((button) => {
    button.disabled = !isOpen;
    button.setAttribute(
      'aria-pressed',
      String(isOpen && snapshot.matches({ open: button.dataset.tab! }))
    );
  });

  if (!isOpen) {
    panel.classList.add('closed');
    body.textContent = 'Panel closed. Reopen it three different ways.';
  } else {
    panel.classList.remove('closed');
    if (snapshot.matches({ open: 'advanced' })) {
      body.innerHTML = `
        <div class="sections">
          <button data-section="network" type="button">Network</button>
          <button data-section="experiments" type="button">Experiments</button>
        </div>
        <p>Advanced settings.</p>
      `;
      body
        .querySelectorAll<HTMLButtonElement>('[data-section]')
        .forEach((button) => {
          const section = button.dataset.section as 'network' | 'experiments';
          button.setAttribute(
            'aria-pressed',
            String(snapshot.matches({ open: { advanced: section } }))
          );
          button.addEventListener('click', () =>
            actor.send({ type: 'selectSection', section })
          );
        });
    } else {
      body.innerHTML = `<p>${
        snapshot.matches({ open: 'general' }) ? 'General' : 'Appearance'
      } settings.</p>`;
    }
  }

  output.textContent = `state: ${JSON.stringify(snapshot.value)} · opens: ${
    snapshot.context.opens
  }`;
});

actor.start();

tabButtons.forEach((button) => {
  button.addEventListener('click', () =>
    actor.send({
      type: 'selectTab',
      tab: button.dataset.tab as 'general' | 'appearance' | 'advanced'
    })
  );
});

const send = (
  id: string,
  type: 'close' | 'open' | 'openShallow' | 'openDeep'
) =>
  document
    .querySelector<HTMLButtonElement>(`#${id}`)!
    .addEventListener('click', () => actor.send({ type }));

send('close', 'close');
send('open', 'open');
send('openShallow', 'openShallow');
send('openDeep', 'openDeep');
