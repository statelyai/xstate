<template>
  <div>
    <button v-if="current.matches('idle')" @click="send('FETCH')">Fetch</button>
    <div v-else-if="current.matches('loading')">Loading...</div>
    <div v-else-if="current.matches('success')">
      Success! Data:
      <div data-testid="data">{{ current.context.data }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import { useFsm } from '../src/useFsm';
import { createMachine, assign } from '@xstate/fsm';
import { watch } from '@vue/composition-api';

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

export default {
  setup() {
    const { state: current, send, service } = useFsm(fetchMachine);
    const onFetch = () =>
      new Promise(res => setTimeout(() => res('some data'), 50));

    watch(() =>
      current.value.actions.forEach(action => {
        if (action.type === 'load') {
          onFetch().then(res => {
            send({ type: 'RESOLVE', data: res });
          });
        }
      })
    );
    return { current, send, service };
  }
};
</script>
