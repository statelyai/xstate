import { render, fireEvent, waitFor } from '@testing-library/vue';
import { Machine, assign, interpret } from 'xstate';
import UseService from './UseService.vue';

describe('useService composable function', () => {
  const counterMachine = Machine<{ count: number }>({
    id: 'counter',
    initial: 'active',
    context: { count: 0 },
    states: {
      active: {
        on: {
          INC: { actions: assign({ count: (ctx) => ctx.count + 1 }) },
          SOMETHING: { actions: 'doSomething' }
        }
      }
    }
  });

  it('2 components should share a single service instance', async () => {
    const counterService = interpret(counterMachine).start();

    const twoServices = {
      components: { UseService },
      template: `
        <div>
          <use-service :service="service" />
          <use-service :service="service" />
        </div>
        `,
      props: ['service']
    };

    const { getAllByTestId } = render(twoServices as any, {
      props: { service: counterService }
    });

    const countEls = getAllByTestId('count');

    expect(countEls.length).toBe(2);

    countEls.forEach((countEl) => expect(countEl.textContent).toBe('0'));

    counterService.send('INC');

    await waitFor(() => {
      expect(countEls.every((el) => el.textContent === '1'));
    });
  });

  it('service should be updated when it changes', async () => {
    const counterService1 = interpret(counterMachine, { id: 'c1' }).start();
    const counterService2 = interpret(counterMachine, { id: 'c2' }).start();

    const { getByTestId, rerender } = render(UseService as any, {
      props: { service: counterService1 }
    });

    const incButton = getByTestId('inc');
    const countEl = getByTestId('count');

    expect(countEl.textContent).toBe('0');
    await fireEvent.click(incButton);
    expect(countEl.textContent).toBe('1');

    await rerender({ props: { service: counterService2 } });

    await waitFor(() => expect(getByTestId('count').textContent).toBe('0'));
  });
});
