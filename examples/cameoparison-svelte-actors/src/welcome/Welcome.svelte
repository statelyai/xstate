<script>
  import Error from '../error/Error.svelte';

  export let actor;

  $: ({ errorActor } = $actor.context);

  const categories = [
    { slug: 'actors', label: 'Actors' },
    { slug: 'athletes', label: 'Athletes' },
    { slug: 'comedians', label: 'Comedians' },
    { slug: 'creators', label: 'Creators' },
    { slug: 'models', label: 'Models' },
    { slug: 'musicians', label: 'Musicians' },
    { slug: 'reality-tv', label: 'Reality TV' }
  ];
</script>

{#if $actor.matches('failure')}
  <div class="error-container">
    <Error actor={errorActor} />
  </div>
{/if}

<header>
  <h1>CameoP<span class="logo">a</span>rison</h1>
  <p>
    On <a href="https://cameo.com">cameo.com</a>, you can buy personalised video
    clips from everyone from Lindsay Lohan to Ice T.
  </p>
  <p>But who commands the highest price?</p>
</header>

<p>Pick a category to play a game:</p>

<div class="categories">
  {#each categories as category}
    <button
      disabled={!$actor.matches('categories')}
      class:loading={$actor.matches('loadingCelebs')}
      on:click={() => actor.send({ type: 'SELECT_CATEGORY', category })}
    >
      {category.label}
    </button>
  {/each}
</div>

<style>
  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: min(12vw, 4em);
    font-weight: 100;
    margin: 0 0 0.5em 0;
  }
  p {
    max-width: 24em;
    margin: 0 auto 1em auto;
  }
  .logo {
    display: inline-block;
    background: url(/icons/compare.svg) 50% 50% no-repeat;
    background-size: 100% 100%;
    width: 0.8em;
    top: 0.05em;
    transform: scale(1.4);
    left: 0.02em;
    text-indent: -9999px;
  }
  .categories {
    width: 100%;
    max-width: 26em;
    margin: 0 auto;
  }
  button {
    padding: 1em 1em;
    display: block;
    margin: 0 0 0.2em 0;
    width: 100%;
    cursor: pointer;
  }
  button[disabled] {
    cursor: default;
    background-color: #666;
    color: #444;
  }
  .loading {
    background: linear-gradient(
      135deg,
      var(--do-something-lighter) 25%,
      var(--do-something) 25%,
      var(--do-something) 50%,
      var(--do-something-lighter) 50%,
      var(--do-something-lighter) 75%,
      var(--do-something) 75%
    );
    animation: bar-animation 3s linear infinite;
    background-size: 64px 64px;
  }
  .error-container {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translate(-50%, 0);
  }
  @keyframes bar-animation {
    0% {
      background-position: 0 0;
    }
    100% {
      background-position: 64px 64px;
    }
  }
  @media (min-width: 640px) {
    button {
      display: inline;
      margin: 0 0.2em 0.4em 0.2em;
      width: auto;
    }
  }
</style>
