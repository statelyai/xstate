<template>
  <div>
    <button v-if="state.matches('idle')" @click="send('FETCH')">Fetch</button>
    <div v-else-if="state.matches('loading')">Loading...</div>
    <div v-else-if="state.matches('success')">
      Success! Data:
      <div data-testid="data">{{ state.context.data }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import { useMachine } from '../src/fsm';
import { createMachine, assign } from '@xstate/fsm';
import { defineComponent } from 'vue';

const context = {
  data: undefined
};
const fetchMachine = createMachine<typeof context, any>({
  id: 'fetch',
  initial: 'idle',
  context,
  states: {
    idle: {
      on: { FETCH: 'loading' }
    },
    loading: {
      entry: ['load'],
      on: {
        RESOLVE: {
          target: 'success',
          actions: assign({
            data: (_, e) => e.data
          })
        }
      }
    },
    success: {}
  }
});

export default defineComponent({
  setup() {
    const onFetch = () =>
      new Promise((res) => setTimeout(() => res('some data'), 50));

    const { state, send, service } = useMachine(fetchMachine, {
      actions: {
        load: () => {
          onFetch().then((res) => {
            send({ type: 'RESOLVE', data: res });
          });
        }
      }
    });

    return { state, send, service };
  }
});
</script>
