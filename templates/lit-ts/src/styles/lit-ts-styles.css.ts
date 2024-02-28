import { css } from 'lit';

export const styles = css`
  :host {
    --color-primary: #056dff;
    display: block;
    box-sizing: border-box;
    display: block;
    margin: auto;
  }

  :host([hidden]),
  [hidden] {
    display: none !important;
  }

  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }

  ::slotted(*) {
    display: block;
    color: var(--color-primary);
    text-indent: 1rem;
    white-space: nowrap;
    text-decoration: none;
    margin-top: 0.5rem;
  }

  em {
    display: block;
    margin-bottom: 1rem;
    text-align: center;
  }

  .step {
    padding: 2rem;
    background: white;
    border-radius: 1rem;
    box-shadow: 0 0.5rem 1rem #0001;
    width: 75vw;
    max-width: 40rem;
  }

  .feedback {
    position: relative;
  }

  .close-feedback {
    position: absolute;
    top: 0;
    right: 0;
  }

  .close-button {
    appearance: none;
    background: transparent;
    font: inherit;
    cursor: pointer;
    border: none;
    padding: 1rem;
  }

  .button {
    appearance: none;
    color: white;
    border: none;
    padding: 1rem 1.5rem;
    border-radius: 0.25rem;
    font: inherit;
    font-weight: bold;
    cursor: pointer;
    display: inline-block;
    margin-right: 1rem;
    background-color: var(--color-primary);
  }

  .button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  textarea {
    display: block;
    border: 2px solid #eaeaea;
    border-radius: 0.25rem;
    margin-bottom: 1rem;
    width: 100%;
    padding: 0.5rem;
  }
`;
