<script setup lang="ts">
import { useMachine } from '@xstate/vue'
import { feedbackMachine } from './feedbackMachine';

const { snapshot, send } = useMachine(feedbackMachine)
</script>

<template>
  <div v-if="snapshot.matches('closed')">
    <em>Feedback form closed.</em>
    <br />
    <button @click="send({ type: 'restart' })">
      Provide more feedback
    </button>
  </div>
  <div v-else class="feedback">
    <button class="close-button" @click="send({ type: 'close' })">
      Close
    </button>

    <div v-if="snapshot.matches('prompt')" class="step">
      <h2>How was your experience?</h2>
      <button class="button" @click="send({ type: 'feedback.good' })">
        Good
      </button>
      <button class="button" @click="send({ type: 'feedback.bad' })">
        Bad
      </button>
    </div>



    <div v-if="snapshot.matches('thanks')" class="step">
      <h2>Thanks for your feedback.</h2>

      <p v-if="snapshot.context.feedback.length > 0">"{{ snapshot.context.feedback }}"</p>

    </div>


    <form v-if="snapshot.matches('form')" class="step" @submit.prevent="send({ type: 'submit' })">
      <h2>What can we do better?</h2>
      <textarea name="feedback" rows={4} placeholder="So many things..." @input="(ev) => {
        send({
          type: 'feedback.update',
          value: (ev.target as HTMLTextAreaElement).value
        })
      }" />
      <button class="button" :disabled="!snapshot.can({ type: 'submit' })">
        Submit
      </button>
      <button class=" button" type="button" @click="
        send({ type: 'back' })">
        Back
      </button>
    </form>
  </div>
</template>

<style scoped>
.step {
  padding: 2rem;
  background: white;
  border-radius: 1rem;
  box-shadow: 0 .5rem 1rem #0001;
  width: 75vw;
  max-width: 40rem;
}

.feedback>.close-button {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
}

.button {
  appearance: none;
  color: white;
  border: none;
  padding: 1rem 1.5rem;
  border-radius: 0.25rem;
  font-size: inherit;
  font-weight: bold;
  margin-right: 1rem;
  background-color: var(--color-primary);
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.close-button {
  appearance: none;
  background: transparent;
  border: none;
  padding: 1rem;
}
</style>
