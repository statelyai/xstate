import { html, LitElement } from 'lit';
import { createBrowserInspector } from '@statelyai/inspect';
import { feedbackMachine } from './feedbackMachine.js';
import { UseMachine } from '../../../packages/xstate-lit/src/index.js';
// import { UseMachine } from '@xstate/lit';
import { styles } from './styles/lit-ts-styles.css.js';

const { inspect } = createBrowserInspector({
  // Comment out the line below to start the inspector
  autoStart: false
});

export class LitTs extends LitElement {
  static override styles = [styles];

  feedbackController: UseMachine<typeof feedbackMachine>;

  constructor() {
    super();
    this.feedbackController = new UseMachine(this, {
      machine: feedbackMachine,
      options: { inspect }
    });
  }

  #getMatches(match: 'prompt' | 'thanks' | 'form' | 'closed') {
    return this.feedbackController.snapshot.matches(match);
  }

  override render() {
    return html`
      ${this.#getMatches('closed') ? this._closedTpl : this._feedbackTpl}
    `;
  }

  get _feedbackTpl() {
    return html`
      <div class="feedback">
        ${this._closeFeedbackTpl}
        ${this.#getMatches('prompt') ? this._promptTpl : ''}
        ${this.#getMatches('thanks') ? this._thanksTpl : ''}
        ${this.#getMatches('form') ? this._formTpl : ''} ${this._slotTpl}
      </div>
    `;
  }

  get _slotTpl() {
    return html`<div><slot></slot></div> `;
  }

  get _closeFeedbackTpl() {
    return html`
      <div class="close-feedback">
        <button
          class="close-button"
          @click=${() => this.feedbackController.send({ type: 'close' })}
        >
          Close
        </button>
      </div>
    `;
  }

  get _promptTpl() {
    return html`
      <div class="step">
        <h2>How was your experience?</h2>

        <button
          class="button"
          @click=${() =>
            this.feedbackController.send({ type: 'feedback.good' })}
        >
          Good
        </button>

        <button
          class="button"
          @click=${() => this.feedbackController.send({ type: 'feedback.bad' })}
        >
          Bad
        </button>
      </div>
    `;
  }

  get _thanksTpl() {
    return html`
      <div class="step">
        <h2>Thanks for your feedback.</h2>

        ${this.feedbackController.snapshot.context.feedback
          ? html`<p>"${this.feedbackController.snapshot.context.feedback}"</p>`
          : ''}
      </div>
    `;
  }

  get _formTpl() {
    return html`
      <form
        class="step"
        @submit=${(ev: Event) => {
          ev.preventDefault();
          this.feedbackController.send({ type: 'submit' });
        }}
      >
        <h2>What can we do better?</h2>

        <textarea
          name="feedback"
          rows="4"
          placeholder="So many things..."
          @input=${({ target }: { target: HTMLTextAreaElement }) =>
            this.feedbackController.send({
              type: 'feedback.update',
              value: target.value
            })}
        ></textarea>

        <button
          class="button"
          ?disabled=${!this.feedbackController.snapshot.can({ type: 'submit' })}
          @click=${() => this.feedbackController.send({ type: 'submit' })}
        >
          Submit
        </button>

        <button
          class="button"
          @click=${() => this.feedbackController.send({ type: 'back' })}
        >
          Back
        </button>
      </form>
    `;
  }

  get _closedTpl() {
    return html`
      <div>
        <em>Feedback form closed.</em>
        <button
          class="button"
          @click=${() => this.feedbackController.send({ type: 'restart' })}
        >
          Provide more feedback
        </button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lit-ts': LitTs;
  }
}
