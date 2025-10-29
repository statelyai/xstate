import { describe, it, expect } from 'vitest';
import { userEvent } from '@vitest/browser/context';
import { render } from 'vitest-browser-lit';
import { html } from 'lit';
import './UseActorRef.ts';

describe('useActorRef', () => {
  it('observer should be called with next state', async () => {
    const screen = render(html`<use-actor-ref></use-actor-ref>`);
    await expect.element(screen.getByText('Turn on')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    await expect.element(screen.getByText('Turn off')).toBeVisible();
  });
});
