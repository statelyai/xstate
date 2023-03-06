<template>
  <div class="feedback" v-if="!state.matches('closed')">
    <button class="close-button" @click="send('close')">
      Close
    </button>
    <div v-if="state.matches('prompt')" class="step">
      <h2>How was your experience?</h2>
      <button class="button" @click="send('feedback.good')">Good</button>
      <button class="button" @click="send('feedback.bad')">Bad</button>
    </div>
    <div v-if="state.matches('thanks')" class="step">
      <h2>Thanks for your feedback.</h2>
      <p v-if="state.context.feedback.length > 0">"{{ state.context.feedback }}"</p>
    </div>
    <form v-if="state.matches('form')" class="step" @submit.prevent="send('submit')">
      <h2>What can we do better?</h2>
      <textarea
        name="feedback"
        rows="4"
        placeholder="So many things..."
        @input="send({ type: 'feedback.update', value: $event.target.value })"
      ></textarea>
      <button class="button" :disabled="!state.can('submit')">Submit</button>
      <button class="button" type="button" @click="send('back')">Back</button>
    </form>
  </div>

  <div v-if="state.matches('closed')">
    <em>Feedback form closed.</em>
    <br />
    <button @click="send('restart')">Provide more feedback</button>
  </div>
</template>

<script>
import { feedbackMachine } from './feedbackMachine';
import { useMachine } from '@xstate/vue';

export default {
  setup() {
    const {state, send} = useMachine(feedbackMachine);

    return {
      state,
      send
    };
  }
};
</script>

<style>
/* Add your styles here */
</style>
