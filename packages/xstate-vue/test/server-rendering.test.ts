// @vitest-environment node
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createMachine } from 'xstate';
import { createCallbackLogic } from 'xstate/actors';
import { useActorRef, useMachine } from '../src/index.ts';

it('renders the initial snapshot without starting actors or observers on the server', async () => {
  const started = vi.fn();
  const cleanedUp = vi.fn();
  const observed = vi.fn();
  const machine = createMachine({
    initial: 'idle',
    states: { idle: {} },
    invoke: {
      src: createCallbackLogic(() => {
        started();
        return cleanedUp;
      })
    }
  });
  const app = createSSRApp(
    defineComponent({
      setup() {
        useActorRef(machine, {}, observed);
        const { snapshot } = useMachine(machine);
        return () => h('output', String(snapshot.value.value));
      }
    })
  );
  expect(await renderToString(app)).toBe('<output>idle</output>');
  expect(started).not.toHaveBeenCalled();
  expect(observed).not.toHaveBeenCalled();
  expect(cleanedUp).not.toHaveBeenCalled();
});
