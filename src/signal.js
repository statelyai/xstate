import isString from 'lodash/lang/isString';
import isPlainObject from 'lodash/lang/isPlainObject';
import extend from 'lodash/object/extend';

export default class Signal {
  constructor(data) {
    if (data instanceof Signal || isPlainObject(data)) {
      extend(this, data);
    }

    if (isString(data)) {
      this.type = data;
    }
  }
}