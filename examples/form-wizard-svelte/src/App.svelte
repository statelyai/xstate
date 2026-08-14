<script lang="ts">
  import { useActor } from '@xstate/svelte';
  import { createInspector } from '@statelyai/sdk';
  import {
    wizardMachine,
    accountErrors,
    addressErrors,
    planErrors
  } from './wizardMachine';

  const inspector = createInspector();

  const { snapshot, send } = useActor(wizardMachine, {
    inspect: inspector.inspect
  });

  const errors = $derived.by(() => {
    const context = $snapshot.context;

    if ($snapshot.matches('account')) return accountErrors(context);
    if ($snapshot.matches('address')) return addressErrors(context);
    if ($snapshot.matches('plan')) return planErrors(context);

    return [];
  });
</script>

<main>
  <h1>Sign up</h1>

  {#if $snapshot.matches('account')}
    <fieldset>
      <legend>Step 1: Account</legend>
      <label>
        Email
        <input
          value={$snapshot.context.email}
          oninput={(ev) =>
            send({ type: 'setEmail', value: ev.currentTarget.value })}
        />
      </label>
      <label>
        Password
        <input
          type="password"
          value={$snapshot.context.password}
          oninput={(ev) =>
            send({ type: 'setPassword', value: ev.currentTarget.value })}
        />
      </label>
    </fieldset>
  {:else if $snapshot.matches('address')}
    <fieldset>
      <legend>Step 2: Address</legend>
      <label>
        Street
        <input
          value={$snapshot.context.street}
          oninput={(ev) =>
            send({ type: 'setStreet', value: ev.currentTarget.value })}
        />
      </label>
      <label>
        City
        <input
          value={$snapshot.context.city}
          oninput={(ev) =>
            send({ type: 'setCity', value: ev.currentTarget.value })}
        />
      </label>
    </fieldset>
  {:else if $snapshot.matches('plan')}
    <fieldset>
      <legend>Step 3: Plan</legend>
      {#each ['free', 'pro'] as const as plan}
        <label>
          <input
            type="radio"
            name="plan"
            checked={$snapshot.context.plan === plan}
            onchange={() => send({ type: 'setPlan', value: plan })}
          />
          {plan}
        </label>
      {/each}
    </fieldset>
  {:else}
    <p>
      Signed up {$snapshot.context.email} on the
      <strong>{$snapshot.context.plan}</strong> plan.
    </p>
    <button onclick={() => send({ type: 'restart' })}>Start over</button>
  {/if}

  {#if errors.length > 0}
    <ul class="errors">
      {#each errors as error}
        <li>{error}</li>
      {/each}
    </ul>
  {/if}

  {#if !$snapshot.matches('done')}
    <div class="actions">
      <button
        disabled={!$snapshot.can({ type: 'back' })}
        onclick={() => send({ type: 'back' })}
      >
        Back
      </button>
      <button onclick={() => send({ type: 'next' })}>Next</button>
    </div>
  {/if}
</main>
