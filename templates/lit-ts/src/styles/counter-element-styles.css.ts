import { css } from 'lit';

export const styles = css`
  :host {
    --color-primary: #056dff;
    --_mark-color: rgb(197, 197, 197);
    display: block;
    box-sizing: border-box;
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
    white-space: nowrap;
    text-indent: -1.5rem;
    text-decoration: none;
    margin-top: 0.5rem;
  }

  [aria-disabled='true'] {
    opacity: 0.5;
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
    pointer-events: none;
    cursor: not-allowed;
  }

  p {
    font-size: 1.5rem;
    min-width: 4.25rem;
    text-align: center;
    margin: auto;
    padding: 0.8333em;
    border-radius: 1rem;
    border: 0.0625rem solid var(--_mark-color);
  }

  button {
    appearance: none;
    color: white;
    border: none;
    padding: 1rem 1.5rem;
    border-radius: 0.25rem;
    font: inherit;
    cursor: pointer;
    display: inline-block;
    background-color: var(--color-primary);
  }

  button + button {
    margin-top: 1rem;
  }

  div {
    display: flex;
    align-items: center;
    max-width: 25rem;
    padding: 1em 2em;
    margin: auto;
    background-color: rgb(238, 238, 238);
    padding: 2rem;
    background: white;
    border-radius: 0.25rem;
    box-shadow: 0 0.5rem 1rem #0001;
    border: 0.0625rem solid var(--_mark-color);
    border-bottom: none;
  }
  div + div {
    position: relative;
    border-top: 0.0625rem dashed var(--_mark-color);
    border-bottom: 0.0625rem solid var(--_mark-color);
  }

  div + div button {
    margin: 0 auto;
    min-width: 10.625rem;
  }

  div + div span {
    position: absolute;
    display: block;
    bottom: -1.5rem;
    margin: 0;
  }

  span {
    display: flex;
    flex-direction: column;
    margin-right: 2rem;
  }

  ::slotted(*) {
    white-space: nowrap;
  }
`;
