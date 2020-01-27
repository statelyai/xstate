<template>
  <div>
    Hallo
    <button v-if="current.matches('idle')" @click="send('FETCH')">Fetch</button>
    <div v-else-if="current.matches('loading')">Loading...</div>
    <div v-else-if="current.matches('success')">
      Success! Data:
      <div data-testid="data">{{ current.context.data }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import { useMachine } from '../src';
import { Machine, assign, Interpreter, spawn, doneInvoke, State } from 'xstate';
import { watch } from '@vue/composition-api';

const context = {
  data: undefined
};
const fetchMachine = Machine<typeof context, any>({
  id: 'fetch',
  initial: 'idle',
  context,
  states: {
    idle: {
      on: { FETCH: 'loading' }
    },
    loading: {
      invoke: {
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

export default {
  props: ['persistedState'],
  setup({ persistedState }): { persistedState: State<any, any> } {
    const onFetch = () =>
      new Promise(res => setTimeout(() => res('some data'), 50));

    const { current, send, service } = useMachine(fetchMachine, {
      services: {
        fetchData: onFetch
      },
      state: persistedState
    });
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
