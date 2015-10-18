import isString from 'lodash/lang/isString';
import isPlainObject from 'lodash/lang/isPlainObject';

export default class Signal {
  constructor(data) {
    if (data instanceof Signal || isPlainObject(data)) {
      Object.assign(this, data);
    }

    if (isString(data)) {
      this.event = data;
      this.payload = null;
    }
  }
}