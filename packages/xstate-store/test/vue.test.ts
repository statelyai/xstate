import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import UseSelector from './UseSelector.vue';
import UseActor from './UseActor.vue';
import UseActorRef from './UseActorRef.vue';

async function clickAndAssert(
  wrapper: ReturnType<typeof mount>,
  countTestId: string,
  incrementTestId: string
) {
  const countEl = wrapper.get(`[data-testid="${countTestId}"]`);
  const incrementEl = wrapper.get(`[data-testid="${incrementTestId}"]`);

  expect(countEl.text()).toBe('0');

  await incrementEl.trigger('click');
  await nextTick();
  expect(countEl.text()).toBe('1');
}

it('works with `useSelector(…)` (@xstate/vue)', async () => {
  const wrapper = mount(UseSelector);
  await clickAndAssert(wrapper, 'count', 'increment');
});

it('works with `useActor(…)` (@xstate/vue)', async () => {
  const wrapper = mount(UseActor);
  await clickAndAssert(wrapper, 'count', 'increment');
});

it('works with `useActorRef(…)` (@xstate/vue)', async () => {
  const wrapper = mount(UseActorRef);
  await clickAndAssert(wrapper, 'count', 'increment');
});
