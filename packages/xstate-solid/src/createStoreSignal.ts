/**
 * Returns an object that can be used in a store
 * Handles primitives or objects.
 */
import type { Accessor } from 'solid-js';
import { createComputed, createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { updateState } from './utils';

const isSnapshotSymbol: unique symbol = Symbol('is-xstate-solid-snapshot');
const snapshotKey = '_snapshot';
/**
 * Returns an object that can be used in a store
 * Handles primitives or objects.
 */
const setSnapshotValue = <Value>(value: Value) => {
  // If primitive, store in a unique object or return the value if an object
  return typeof value === 'object' && value
    ? value
    : { [snapshotKey]: value, [isSnapshotSymbol]: true };
};

const getSnapshotValue = <ReturnValue>(state): ReturnValue =>
  snapshotKey in state && state[isSnapshotSymbol] ? state[snapshotKey] : state;

const getInitialValue = <Value, ReturnValue>(
  value: Value,
  selector?: (val: Value) => ReturnValue
) => {
  // Access value if it is a signal
  const baseValue = typeof value === 'function' ? value() : value;
  return selector ? selector(baseValue) : baseValue;
};

/**
 * Create a SolidJS store wrapped in a signal. Handle primitives and objects
 * with one hook.
 * @param value The base value to store
 * @param selector A function that accepts value and returns a sub value (or any other value)
 */
export const createStoreSignal = <
  UpdateValue,
  SnapshotValue = unknown,
  Value = unknown
>(
  value: Value,
  selector?: (val: Value | UpdateValue) => SnapshotValue
): [Accessor<SnapshotValue>, (value: UpdateValue) => void] => {
  const initialValue = getInitialValue(value, selector);
  // Stores an object or primitive - gets value from selector if provided
  const [state, setState] = createStore(setSnapshotValue(initialValue));

  // A signal with the original value or value from selector if provided
  const [snapshot, setSnapshot] = createSignal(
    getSnapshotValue<SnapshotValue>(state)
  );

  // Update snapshot after state is finished updating
  createComputed(() => setSnapshot(getSnapshotValue(state)), state);

  const update = (updateValue: UpdateValue) => {
    updateState(setSnapshotValue(updateValue), setState);
  };
  return [snapshot, update];
};
