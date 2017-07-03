export type Action =
  | string
  | {
      type: string;
      [key: string]: any;
    };
