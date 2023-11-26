<template>
  <div data-testid="machine-state">
    {{ machineState.value }}
  </div>
  <div data-testid="actor-state">
    {{ actorState.value }}
  </div>
</template>

<script lang="ts">
import { useMachine, useSelector } from '../src/index.ts';
import { createMachine, sendParent } from 'xstate';
import { defineComponent } from 'vue';

const childMachine = createMachine({
  id: 'childMachine',
  initial: 'active',
  states: {
    active: {
      on: {
        FINISH: { actions: sendParent({ type: 'FINISH' }) }
      }
    }
  }
});
const machine = createMachine({
  initial: 'active',
  invoke: {
    id: 'child',
    src: childMachine
  },
  states: {
    active: {
      on: { FINISH: 'success' }
    },
    success: {}
  }
});

export default defineComponent({
  setup() {
    const { snapshot: machineState } = useMachine(machine);

    const actorState = useSelector(machineState.value.children.child, (s) => s);

    return {
      machineState,
      actorState
    };
  }
});
</script>
