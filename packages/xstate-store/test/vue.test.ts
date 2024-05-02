import { fireEvent, render } from '@testing-library/vue';
import UseSelector from './UseSelector.vue';
import UseActor from './UseActor.vue';
import UseActorRef from './UseActorRef.vue';

it('works with `useSelector(…)` (@xstate/vue)', async () => {
  const { getByTestId } = render(UseSelector);

  const countEl = getByTestId('count');
  const incrementEl = getByTestId('increment');

  await fireEvent.click(incrementEl);
  expect(countEl.textContent).toBe('1');
});

it('works with `useActor(…)` (@xstate/vue)', async () => {
  const { getByTestId } = render(UseActor);

  const countEl = getByTestId('count');
  const incrementEl = getByTestId('increment');

  await fireEvent.click(incrementEl);
  expect(countEl.textContent).toBe('1');
});

it('works with `useActorRef(…)` (@xstate/vue)', async () => {
  const { getByTestId } = render(UseActorRef);

  const countEl = getByTestId('count');
  const incrementEl = getByTestId('increment');

  await fireEvent.click(incrementEl);
  expect(countEl.textContent).toBe('1');
});
