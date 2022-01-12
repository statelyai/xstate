/**
 * Returns an object that can be used in a store
 * Handles primitives or objects.
 */
import type { Accessor } from 'solid-js';
import { createSignal } from 'solid-js';
import { createStore } from 'solid-js/store';
import { updateState } from './utils';

const isSnapshotSymbol: unique symbol = Symbol('is-xstate-solid-snapshot');
const snapshotKey = '_snapshot';
/**
 * Returns an object that can be used in a store
 * Handles primitives or objects.
 */
export const setSnapshotValue = <Value, ReturnValue>(
  value: Value,
  getValue?: (val: Value) => ReturnValue
) => {
  const baseValue = typeof value === 'function' ? value() : value;
  const defaultValue = getValue ? getValue(baseValue) : baseValue;
  return typeof defaultValue === 'object' && defaultValue
    ? defaultValue
    : { [snapshotKey]: defaultValue, [isSnapshotSymbol]: true };
};

export const getSnapshotValue = <Value>(state): Value =>
  snapshotKey in state && state[isSnapshotSymbol] ? state[snapshotKey] : state;

/**
 * Create a SolidJS store wrapped in a signal. Handle primitives and objects
 * with one hook.
 * @param value
 * @param getValue
 */
export const createStoreSignal = <
  UpdateValue,
  ReturnValue = unknown,
  Value = unknown
>(
  value: Value,
  getValue: (val: Value | UpdateValue) => ReturnValue
): [Accessor<ReturnValue>, (value: UpdateValue) => void] => {
  const [state, setState] = createStore(setSnapshotValue(value, getValue));
  const [snapshot, setSnapshot] = createSignal(
    getSnapshotValue<ReturnValue>(state)
  );
  const update = (updateValue: UpdateValue) => {
    updateState(setSnapshotValue(updateValue), setState);
    setSnapshot(getSnapshotValue(state));
  };
  return [snapshot, update];
};
