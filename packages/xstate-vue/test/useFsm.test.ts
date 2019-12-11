import {
  render,
  fireEvent,
  waitForElement,
  cleanup
} from '@testing-library/vue';
import VueCompositionApi from '@vue/composition-api';
import FsmComponent from './FsmComponent.vue';

afterEach(cleanup);

describe('useFsm composable function', () => {
  it('should work ', async () => {
    const { getByText, getByTestId } = render(FsmComponent, {}, vue =>
      // @ts-ignore
      vue.use(VueCompositionApi)
    );
    const button = getByText('Fetch');
    fireEvent.click(button);
    await waitForElement(() => getByText('Loading...'));
    await waitForElement(() => getByText(/Success/));
    const dataEl = getByTestId('data');
    expect(dataEl.textContent).toBe('some data');
  });
});
