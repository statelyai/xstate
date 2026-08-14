<script setup lang="ts">
import { computed, ref } from 'vue';
import { useActor } from '@xstate/vue';
import { createInspector } from '@statelyai/sdk';
import { authMachine } from './authMachine';

const inspector = createInspector();

const { snapshot, send } = useActor(authMachine, {
  inspect: inspector.inspect
});

const email = ref('ada@example.com');
const password = ref('lovelace');

const session = computed(() => snapshot.value.context.session);
const error = computed(() => snapshot.value.context.error);
const isAuthenticating = computed(() =>
  snapshot.value.matches('authenticating')
);
const isRefreshing = computed(() =>
  snapshot.value.matches({ authenticated: 'refreshing' })
);
</script>

<template>
  <main v-if="snapshot.matches('sessionExpired')">
    <h1>Session expired</h1>
    <p class="error">{{ error }}</p>
    <button @click="send({ type: 'retry' })">Sign in again</button>
  </main>

  <main v-else-if="session">
    <h1>Signed in</h1>
    <p>
      Welcome, <strong>{{ session.user }}</strong>
    </p>
    <p class="token">
      token <code>{{ session.token.slice(0, 8) }}</code>
      <span v-if="isRefreshing"> refreshing…</span>
    </p>
    <button @click="send({ type: 'expire' })">Simulate expiry</button>
    <button @click="send({ type: 'logout' })">Log out</button>
  </main>

  <main v-else>
    <h1>Sign in</h1>
    <form
      @submit.prevent="
        send({ type: 'submit', email: email, password: password })
      "
    >
      <label>
        Email
        <input v-model="email" type="email" />
      </label>
      <label>
        Password
        <input v-model="password" type="password" />
      </label>
      <button type="submit" :disabled="isAuthenticating">
        {{ isAuthenticating ? 'Signing in…' : 'Sign in' }}
      </button>
    </form>
    <p v-if="error" class="error">{{ error }}</p>
    <p class="hint">Any other password fails.</p>
  </main>
</template>
