import type { UseActor } from './UseActor.ts';
import type { UseActorWithTransitionLogic } from './UseActorWithTransitionLogic.ts';
import { createActor, createMachine } from 'xstate';
import { fixture, fixtureCleanup, html } from '@open-wc/testing-helpers';
import {
  getByText,
  getByTestId,
  findByText,
  fireEvent,
  waitFor
} from '@testing-library/dom';
import { fetchMachine } from './fetchMachine.ts';
import './UseActor.ts';
import './UseActorWithTransitionLogic.ts';

const actorRef = createActor(
  fetchMachine.provide({
    actors: {
      fetchData: createMachine({
        initial: 'done',
        states: {
          done: {
            type: 'final'
          }
        },
        output: 'persisted data'
      }) as any
    }
  })
).start();
actorRef.send({ type: 'FETCH' });

const persistedFetchState = actorRef.getPersistedSnapshot();

const persistedFetchStateConfig = JSON.parse(
  JSON.stringify(persistedFetchState)
);

describe('useActor', () => {
  afterEach(() => {
    fixtureCleanup();
  });

  it('should work with a component', async () => {
    const el: UseActor = await fixture(html`<use-actor></use-actor>`);
    const button = getByText(el, 'Fetch');
    await fireEvent.click(button);
    await el.updateComplete;
    await findByText(el, 'Loading...');
    await findByText(el, /Success/);
    const dataEl = getByTestId(el, 'data');
    expect(dataEl.textContent?.trim()).toBe('some data');
  });

  it('should work with a component with rehydrated state', async () => {
    const el: UseActor = await fixture(
      html`<use-actor .persistedState=${persistedFetchState}></use-actor>`
    );
    await findByText(el, /Success/);
    const dataEl = getByTestId(el, 'data');
    expect(dataEl.textContent?.trim()).toBe('persisted data');
  });

  it('should work with a component with rehydrated state config', async () => {
    const el: UseActor = await fixture(
      html`<use-actor .persistedState=${persistedFetchStateConfig}></use-actor>`
    );
    await findByText(el, /Success/);
    const dataEl = getByTestId(el, 'data');
    expect(dataEl.textContent?.trim()).toBe('persisted data');
  });

  it('should be able to spawn an actor from actor logic', async () => {
    const el: UseActorWithTransitionLogic = await fixture(
      html`<use-actor-with-transition-logic></use-actor-with-transition-logic>`
    );
    const buttonEl = getByTestId(el, 'count');
    await waitFor(() => expect(buttonEl.textContent?.trim()).toEqual('0'));
    await fireEvent.click(buttonEl);
    await el.updateComplete;
    await waitFor(() => expect(buttonEl.textContent?.trim()).toEqual('1'));
  });
});
