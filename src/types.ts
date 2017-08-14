import { State } from './index';

export type Action =
  | number
  | string
  | {
      type: string;
      [key: string]: any;
    };

export type StateKey = string | State;
