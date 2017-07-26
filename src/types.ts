export type Action =
  | number
  | string
  | {
      type: string;
      [key: string]: any;
    };
