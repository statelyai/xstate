<script lang="ts">
  import type { Actor, AnyActorLogic } from 'xstate';
  import { useActor } from '../src/index.ts';

  export let actor: Actor<AnyActorLogic>;
  export let onActorRef: (actorRef: Actor<AnyActorLogic>) => void = () => {};

  const { snapshot, actorRef } = useActor(actor);
  onActorRef(actorRef);
</script>

<div data-testid="value">{$snapshot.value}</div>
