<script lang="ts">
  // this file acts as a type test
  import { createMachine, interpret } from 'xstate';

  const service = interpret(
    createMachine({
      schema: {
        context: {} as { count: number }
      }
    })
  ).start();

  const { count } = $service.context;
  ((_val: number) => {})(count);
  // @ts-expect-error
  ((_val: string) => {})(count);
</script>

<div>$count</div>
