import _ from 'lodash';

export default class Signal {
  constructor(data) {
    if (data instanceof Signal || _.isPlainObject(data)) {
      Object.assign(this, data);
    }

    if (_.isString(data)) {
      this.event = data;
      this.payload = null;
    }
  }
}