import './style.css';

import { createActor } from 'xstate';
import { createInspector } from '@statelyai/sdk';
import { coins, items, vendingMachine } from './vendingMachine';

const inspector = createInspector();

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="card">
    <div class="controls">
      ${coins
        .map(
          (value) =>
            `<button type="button" data-coin="${value}">${value}¢</button>`
        )
        .join('')}
      <button type="button" id="refund">Refund</button>
    </div>
    <div class="items">
      ${items
        .map(
          (item) => `
            <button type="button" data-item="${item.id}">
              <strong>${item.label}</strong>
              <span>${item.price}¢</span>
              <small data-stock="${item.id}"></small>
            </button>`
        )
        .join('')}
    </div>
    <output id="credit"></output>
    <output id="message"></output>
    <output id="tray"></output>
  </div>
`;

const actor = createActor(vendingMachine, { inspect: inspector.inspect });

const creditEl = document.querySelector<HTMLOutputElement>('#credit')!;
const messageEl = document.querySelector<HTMLOutputElement>('#message')!;
const trayEl = document.querySelector<HTMLOutputElement>('#tray')!;

actor.subscribe((snapshot) => {
  const { credit, stock, dispensing, change, message } = snapshot.context;

  creditEl.textContent = `Credit: ${credit}¢ · ${String(snapshot.value)}`;
  messageEl.textContent = message;
  trayEl.textContent = [
    dispensing ? `Tray: ${dispensing}` : '',
    change > 0 ? `Change: ${change}¢` : ''
  ]
    .filter(Boolean)
    .join(' · ');

  items.forEach((item) => {
    document.querySelector<HTMLElement>(
      `[data-stock="${item.id}"]`
    )!.textContent =
      stock[item.id]! > 0 ? `${stock[item.id]} left` : 'sold out';
  });

  document.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.disabled = !snapshot.matches('idle');
  });
});

actor.start();

document
  .querySelectorAll<HTMLButtonElement>('[data-coin]')
  .forEach((button) => {
    button.addEventListener('click', () =>
      actor.send({ type: 'insertCoin', value: Number(button.dataset.coin) })
    );
  });

document
  .querySelectorAll<HTMLButtonElement>('[data-item]')
  .forEach((button) => {
    button.addEventListener('click', () =>
      actor.send({ type: 'select', id: button.dataset.item! })
    );
  });

document
  .querySelector<HTMLButtonElement>('#refund')!
  .addEventListener('click', () => actor.send({ type: 'refund' }));
