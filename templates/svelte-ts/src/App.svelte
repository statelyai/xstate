<script lang="ts">
  import { feedbackMachine } from './feedbackMachine';
  import { useActor } from '@xstate/svelte';

  const { snapshot, send } = useActor(feedbackMachine);
</script>

{#if $snapshot.matches('closed')}
  <div>
    <em>Feedback form closed.</em>
    <br />
    <button onclick={() => send({ type: 'restart' })}>
      Provide more feedback
    </button>
  </div>
{:else}
  <div class="feedback">
    <button class="close-button" onclick={() => send({ type: 'close' })}>
      Close
    </button>

    {#if $snapshot.matches('prompt')}
      <div class="step">
        <h2>How was your experience?</h2>

        <button class="button" onclick={() => send({ type: 'feedback.good' })}>
          Good
        </button>

        <button class="button" onclick={() => send({ type: 'feedback.bad' })}>
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
        onsubmit={(ev) => {
          ev.preventDefault();
          send({ type: 'submit' });
        }}
      >
        <h2>What can we do better?</h2>

        <textarea
          name="feedback"
          rows={4}
          placeholder="So many things..."
          oninput={(ev) =>
            send({ type: 'feedback.update', value: ev.currentTarget.value })}
        ></textarea>

        <button class="button" disabled={!$snapshot.can({ type: 'submit' })}>
          Submit
        </button>

        <button class="button" type="button" onclick={() => send({ type: 'back' })}>
          Back
        </button>
      </form>
    {/if}
  </div>
{/if}
