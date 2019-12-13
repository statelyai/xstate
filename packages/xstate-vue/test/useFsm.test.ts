import {
  render,
  fireEvent,
  waitForElement,
  cleanup
} from '@testing-library/vue';
import { mount, createLocalVue } from '@vue/test-utils';
import VueCompositionApi from '@vue/composition-api';
import UseFsm from './UseFsm.vue';

afterEach(cleanup);

const renderWithCompositionApi = (component, options?) =>
  // @ts-ignore
  render(component, options, vue => vue.use(VueCompositionApi));

describe('useFsm composable function', () => {
  it('should work ', async () => {
    const { getByText, getByTestId } = renderWithCompositionApi(UseFsm);
    const button = getByText('Fetch');
    fireEvent.click(button);
    await waitForElement(() => getByText('Loading...'));
    await waitForElement(() => getByText(/Success/));
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('some data');
  });

  it('should provide the service and send function in the data object', async () => {
    const localVue = createLocalVue();
    localVue.use(VueCompositionApi);
    const wrapper = mount(UseFsm, { localVue });
    await wrapper.vm.$nextTick();
    const { service, send } = wrapper.vm.$data;
    expect(service).toBeDefined();
    expect(typeof send).toBe('function');
  });
});
