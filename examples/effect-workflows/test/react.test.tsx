import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from '@testing-library/react';
import { App } from '../src/react.tsx';
import { actor, Review, runtime } from '../src/selector.tsx';

afterEach(cleanup);
afterAll(async () => {
  await runtime.dispose();
});

it('renders atom state and sends approval from React', async () => {
  render(<App />);
  const button = await screen.findByRole('button', { name: 'Approve release' });
  expect(screen.getByRole('status').textContent).toBe('pending');
  fireEvent.click(button);
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('published')
  );
  expect((button as HTMLButtonElement).disabled).toBe(true);
});

it('reads an Effect actor with useSelector', async () => {
  render(<Review actor={actor} />);
  fireEvent.click(screen.getByRole('button', { name: 'pending' }));
  await screen.findByRole('button', { name: 'approved' });
  expect(actor.getSnapshot().value).toBe('approved');
});
