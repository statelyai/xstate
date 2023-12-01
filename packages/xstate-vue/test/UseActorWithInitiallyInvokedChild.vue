<template>
  <div data-testid="machine-snapshot">
    {{ machineSnapshot.value }}
  </div>
  <div data-testid="actor-snapshot">
    {{ actorSnapshot.value }}
  </div>
</template>

<script lang="ts">
import { useActor, useSelector } from '../src/index.ts';
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
    const { snapshot: machineSnapshot } = useActor(machine);
    const actorSnapshot = useSelector(
      machineSnapshot.value.children.child,
      (s) => s
    );

    return {
      machineSnapshot,
      actorSnapshot
    };
  }
});
</script>
