<template>
  <div>
    <button v-if="snapshot.matches('idle')" @click="send({ type: 'FETCH' })">Fetch</button>
    <div v-else-if="snapshot.matches('loading')">Loading...</div>
    <div v-else-if="snapshot.matches('success')">
      Success! Data:
      <div data-testid="data">{{ snapshot.context.data }}</div>
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

    const { snapshot, send, service } = useMachine(fetchMachine, {
      actions: {
        load: () => {
          onFetch().then((res) => {
            send({ type: 'RESOLVE', data: res });
          });
        }
      }
    });

    return { snapshot, send, service };
  }
});
</script>
