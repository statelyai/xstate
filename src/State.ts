import { StateValue, IHistory } from './types';
import { STATE_DELIMITER } from './constants';

export default class State {
  public value: StateValue;
  public history: IHistory;
  public changed: boolean;
  constructor({ value, history, changed }) {
    this.value = value;
    this.history = history;
    this.changed = changed;
  }
  public toString(): string | undefined {
    if (typeof this.value === 'string') {
      return this.value;
    }

    const path = [];
    let marker: StateValue = this.value;

    while (true) {
      if (typeof marker === 'string') {
        path.push(marker);
        break;
      }

      const [firstKey, ...otherKeys] = Object.keys(marker);

      if (otherKeys.length) {
        return undefined;
      }

      path.push(firstKey);
      marker = marker[firstKey];
    }

    return path.join(STATE_DELIMITER);
  }
}
