<script lang="ts">
  import { feedbackMachine } from './feedbackMachine';
  import { useMachine } from '@xstate/svelte';
  import { createBrowserInspector } from '@statelyai/inspect';

  const { inspect } = createBrowserInspector();

  const { snapshot, send } = useMachine(feedbackMachine, {
    // Uncomment the line below to start the inspector
    // inspect
  });
</script>

{#if $snapshot.matches('closed')}
  <div>
    <em>Feedback form closed.</em>
    <br />
    <button on:click={() => send({ type: 'restart' })}>
      Provide more feedback
    </button>
  </div>
{:else}
  <div class="feedback">
    <button class="close-button" on:click={() => send({ type: 'close' })}>
      Close
    </button>

    {#if $snapshot.matches('prompt')}
      <div class="step">
        <h2>How was your experience?</h2>

        <button class="button" on:click={() => send({ type: 'feedback.good' })}>
          Good
        </button>

        <button class="button" on:click={() => send({ type: 'feedback.bad' })}>
          Bad
        </button>
      </div>
    {/if}

    {#if $snapshot.matches('thanks')}
      <div class="step">
        <h2>Thanks for your feedback.</h2>

        {#if $snapshot.context.feedback}
          <p>"{$snapshot.context.feedback}"</p>
        {/if}
      </div>
    {/if}

    {#if $snapshot.matches('form')}
      <form
        class="step"
        on:submit|preventDefault={() => send({ type: 'submit' })}
      >
        <h2>What can we do better?</h2>

        <textarea
          name="feedback"
          rows={4}
          placeholder="So many things..."
          on:input={(ev) =>
            send({ type: 'feedback.update', value: ev.target.value })}
        />

        <button class="button" disabled={!$snapshot.can({ type: 'submit' })}>
          Submit
        </button>

        <button class="button" on:click={() => send({ type: 'back' })}>
          Back
        </button>
      </form>
    {/if}
  </div>
{/if}
