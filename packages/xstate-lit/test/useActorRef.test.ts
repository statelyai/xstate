import type { UseActorRef } from './UseActorRef.ts';
import { fixture, fixtureCleanup, html } from '@open-wc/testing-helpers';
import { getByTestId, waitFor, fireEvent } from '@testing-library/dom';
import './UseActorRef.ts';

describe('useActorRef', () => {
  afterEach(() => {
    fixtureCleanup();
  });

  it('observer should be called with next state', async () => {
    const el: UseActorRef = await fixture(
      html`<use-actor-ref></use-actor-ref>`
    );
    const buttonEl = getByTestId(el, 'button');
    await waitFor(() => expect(buttonEl.textContent?.trim()).toBe('Turn on'));
    await fireEvent.click(buttonEl);
    await el.updateComplete;
    await waitFor(() => expect(buttonEl.textContent?.trim()).toBe('Turn off'));
  });
});
