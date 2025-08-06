import { describe, it, expect } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { render } from 'vitest-browser-lit';
import { html } from 'lit';
import { createActor, createMachine } from 'xstate';
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
  it('should work with a component', async () => {
    const screen = render(html`<use-actor></use-actor>`);
    await expect.element(screen.getByText('Fetch')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Fetch' }));
    await expect.element(screen.getByText('Loading...')).toBeVisible();
    await expect.element(screen.getByText('Success')).toBeVisible();
    await expect.element(screen.getByText('some data')).toBeVisible();
  });

  it('should work with a component with rehydrated state', async () => {
    const screen = render(
      html`<use-actor .persistedState=${persistedFetchState}></use-actor>`
    );
    await expect.element(screen.getByText('Success')).toBeVisible();
    await expect.element(screen.getByText('persisted data')).toBeVisible();
  });

  it('should work with a component with rehydrated state config', async () => {
    const screen = render(
      html`<use-actor .persistedState=${persistedFetchStateConfig}></use-actor>`
    );
    await expect.element(screen.getByText('Success')).toBeVisible();
    await expect.element(screen.getByText('persisted data')).toBeVisible();
  });

  it('should be able to spawn an actor from actor logic', async () => {
    const screen = render(
      html`<use-actor-with-transition-logic></use-actor-with-transition-logic>`
    );
    await expect.element(screen.getByText('0')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: '0' }));
    await expect.element(screen.getByText('1')).toBeVisible();
  });
});
