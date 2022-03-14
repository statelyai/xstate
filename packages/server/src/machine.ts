/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { isAsyncDef, isSyncDef, promiseWithTimeout } from './helpers';
import type { StateDefinition, USD } from './types';

const unexpectedState: USD = {
  type: 'unexpected',
  value: 'fstate.unexpected'
};

export class Machine<
  TA = any,
  TC extends Record<string, unknown> = Record<string, unknown>,
  S extends StateDefinition<TA, TC> = StateDefinition<TA, TC>
> {
  #args!: TA;
  readonly #containsAsyncStates: boolean;
  readonly #initialContext: TC;
  constructor(
    public _states: (S | USD)[],
    private initial: string,
    private context: TC,
    private overflow = 100,
    public test = false
  ) {
    this.#initialContext = context;
    this.#initializeStates();
    this.#initializeTransitions();
    this.#containsAsyncStates = _states.some((state) => state.type === 'async');
  }

  get clone() {
    return new Machine(
      this._states,
      this.initial,
      this.#initialContext,
      this.overflow
    );
  }

  get cloneTest() {
    return new Machine(
      this._states,
      this.initial,
      this.#initialContext,
      this.overflow,
      true
    );
  }

  #initializeStates() {
    const __allStates = this._states;
    const initial = this.initial;
    if (__allStates.length < 1) throw 'No states';
    if (!__allStates.some((value) => value.type === 'final'))
      throw 'No final states';

    const findInitial = __allStates.find((state) => state.value === initial);
    if (!findInitial) throw 'No initial state';
    if (findInitial.type === 'final') throw 'First state cannot be final';

    this.#currentState = findInitial;
    this._states.push(unexpectedState);

    this.test && this.enteredStates.push(this.#currentState.value);
  }

  #initializeTransitions() {
    const __temp = this._states.map((state) => {
      if (isSyncDef(state)) {
        state.transitions.push({
          target: unexpectedState.value,
          source: state.value,
          actions: [],
          conditions: []
        });
      }
      return state;
    });
    this._states = __temp;
  }

  #hasNext = true;

  #setCurrentState(value: string) {
    const out = this._states.find((_state) => _state.value === value);
    this.#currentState = out!;
    this.test && this.enteredStates.push(out!.value);
  }

  #nextSync() {
    const current = { ...this.#currentState };
    const args = { ...this.#args };
    if (isSyncDef(current)) {
      this.#hasNext = true;
      const transitions = current.transitions;
      for (const transition of transitions) {
        const cond = transition.conditions
          .map((condition) => condition({ ...this.context }, args))
          .every((value) => value === true);
        if (!cond) continue;
        transition.actions.forEach((action) => action(this.context, args));
        this.#setCurrentState(transition.target);
        break;
      }
    }
  }

  async #nextAsync() {
    const current = this.#currentState;
    const args = { ...this.#args };
    if (isAsyncDef(current)) {
      this.#hasNext = true;
      const src = promiseWithTimeout({
        timeoutMs: current.timeout,
        promise: () => current.promise({ ...this.context }, args)
      });
      await src()
        .then((data) => {
          const transitions = current.onDone;
          for (const transition of transitions) {
            const cond = transition.conditions
              .map((condition) => condition({ ...this.context }, data))
              .every((value) => value === true);

            if (!cond) continue;
            transition.actions.forEach((action) => {
              action(this.context, args);
            });
            this.#setCurrentState(transition.target);
            break;
          }
        })
        .catch((error) => {
          const transitions = current.onError;
          for (const transition of transitions) {
            const cond = transition.conditions
              .map((condition) => condition({ ...this.context }, error))
              .every((value) => value === true);
            if (!cond) continue;
            transition.actions.forEach((action) => action(this.context, error));
            this.#setCurrentState(transition.target);
            break;
          }
        });
    }
  }

  readonly start = (args: TA) => {
    if (this.#containsAsyncStates) throw 'async state exists';
    let iterator = 0;
    this.#args = args;
    while (this.#hasNext && this.#currentState.type !== 'final') {
      this.#hasNext = false;
      this.#nextSync();
      iterator++;
      if (iterator >= this.overflow) {
        throw 'Overflow transitions';
      }
    }
    return this.context;
  };

  readonly startAsync = async (args: TA) => {
    if (!this.test && !this.#containsAsyncStates) throw 'no async state';
    let iterator = 0;
    this.#args = args;
    while (this.#hasNext && this.#currentState.type !== 'final') {
      this.#hasNext = false;
      this.#nextSync();
      await this.#nextAsync();
      iterator++;
      if (iterator >= this.overflow) {
        throw 'Overflow transitions';
      }
    }
    return this.context;
  };

  #currentState!: S | USD;

  get state() {
    return this.#currentState;
  }

  get value() {
    return this.context;
  }

  enteredStates: string[] = [];
}
