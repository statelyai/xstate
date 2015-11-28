import isString from 'lodash/lang/isString';
import isPlainObject from 'lodash/lang/isPlainObject';
import extend from 'lodash/object/extend';

export default class Action {
  constructor(data) {
    if (data instanceof Action || isPlainObject(data)) {
      extend(this, data);
    }

    if (isString(data)) {
      this.type = data;
    }
  }
}