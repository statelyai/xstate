export interface InvokedPromiseOptions {
  id?: string;
}

export interface PromiseMachineSchema {
  states: {
    pending: {};
    resolved: {};
    rejected: {};
  };
}

// export function fromPromise<T>(
//   promise: Promise<T>,
//   options?: InvokedPromiseOptions
// ): any {
//   const optionsWithDefaults = {
//     id: 'promise',
//     ...options
//   };

//   return Machine<T, PromiseMachineSchema>({
//     id: optionsWithDefaults.id,
//     initial: 'pending',
//     states: {
//       pending: {},
//       resolved: {},
//       rejected: {}
//     }
//   });
// }
