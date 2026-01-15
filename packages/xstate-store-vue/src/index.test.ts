import { fireEvent, render } from '@testing-library/vue';
import TestCounter from './TestCounter.vue';
import { createStore, createAtom } from './index';

describe('@xstate/store-vue', () => {
  describe('useSelector', () => {
    it('should work with a selector', async () => {
      const { getByTestId } = render(TestCounter);

      const countEl = getByTestId('count');
      const incrementEl = getByTestId('increment');

      expect(countEl.textContent).toBe('0');

      await fireEvent.click(incrementEl);
      expect(countEl.textContent).toBe('1');
    });
  });

  describe('re-exports', () => {
    it('should re-export createStore from @xstate/store', () => {
      expect(createStore).toBeDefined();
      const store = createStore({
        context: { value: 'test' },
        on: {}
      });
      expect(store.get().context.value).toBe('test');
    });

    it('should re-export createAtom from @xstate/store', () => {
      expect(createAtom).toBeDefined();
      const atom = createAtom(123);
      expect(atom.get()).toBe(123);
    });
  });
});
