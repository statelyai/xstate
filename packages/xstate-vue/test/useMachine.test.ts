import {
  render,
  fireEvent,
  waitForElement,
  cleanup
} from '@testing-library/vue';
import VueCompositionApi from '@vue/composition-api';
import UseMachine from './UseMachine.vue';
import { Machine, assign, doneInvoke } from 'xstate';
import { createLocalVue, mount } from '@vue/test-utils';

afterEach(cleanup);

const renderWithCompositionApi = (component, options?) =>
  // @ts-ignore
  render(component, options, vue => vue.use(VueCompositionApi));

describe('useMachine composition function', () => {
  const context = {
    data: undefined
  };
  const fetchMachine = Machine<typeof context>({
    id: 'fetch',
    initial: 'idle',
    context,
    states: {
      idle: {
        on: { FETCH: 'loading' }
      },
      loading: {
        invoke: {
          id: 'fetchData',
          src: 'fetchData',
          onDone: {
            target: 'success',
            actions: assign({
              data: (_, e) => e.data
            }),
            cond: (_, e) => e.data.length
          }
        }
      },
      success: {
        type: 'final'
      }
    }
  });

  const persistedFetchState = fetchMachine.transition(
    'loading',
    doneInvoke('fetchData', 'persisted data')
  );

  it('should work with a component ', async () => {
    const { getByText, getByTestId } = renderWithCompositionApi(UseMachine);
    const button = getByText('Fetch');
    fireEvent.click(button);
    await waitForElement(() => getByText('Loading...'));
    await waitForElement(() => getByText(/Success/));
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('some data');
  });

  it('should work with a component with rehydrated state', async () => {
    const { getByText, getByTestId } = renderWithCompositionApi(UseMachine, {
      propsData: { persistedState: persistedFetchState }
    });

    await waitForElement(() => getByText(/Success/));

    const dataEl = getByTestId('data');

    expect(dataEl.textContent).toBe('persisted data');
  });

  it('should work with a component with rehydrated state config', async () => {
    const persistedFetchStateConfig = JSON.parse(
      JSON.stringify(persistedFetchState)
    );
    const { getByText, getByTestId } = renderWithCompositionApi(UseMachine, {
      propsData: { persistedState: persistedFetchStateConfig }
    });
    await waitForElement(() => getByText(/Success/));
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('persisted data');
  });

  it('should provide the service and send function in the data object', async () => {
    const localVue = createLocalVue();
    localVue.use(VueCompositionApi);
    const wrapper = mount(UseMachine, { localVue });
    await wrapper.vm.$nextTick();
    const { service, send } = wrapper.vm.$data;
    expect(service).toBeDefined();
    expect(typeof send).toBe('function');
  });
});
