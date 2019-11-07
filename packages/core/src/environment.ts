export const IS_PRODUCTION =
  typeof process !== 'undefined' ? process.env.NODE_ENV === 'production' : true;
