import { actionTypes } from './actions';
import {
  EventObject,
  InvokeConfig,
  InvokeDefinition,
  InvokeSourceDefinition
} from './types';
import { isString } from './utils';

export function toInvokeSource(
  src: string | InvokeSourceDefinition
): InvokeSourceDefinition {
  if (typeof src === 'string') {
    const simpleSrc = { type: src };
    simpleSrc.toString = () => src; // v4 compat - TODO: remove in v5
    return simpleSrc;
  }

  return src;
}

export function toInvokeDefinition<TContext, TEvent extends EventObject>(
  invokeConfig: InvokeConfig<TContext, TEvent> & {
    src: string | InvokeSourceDefinition;
    id: string;
  }
): InvokeDefinition<TContext, TEvent> {
  return {
    type: actionTypes.invoke,
    ...invokeConfig,
    isInline: isString(invokeConfig),
    toJSON() {
      const { onDone, onError, ...invokeDef } = invokeConfig;
      return {
        ...invokeDef,
        type: actionTypes.invoke,
        src: toInvokeSource(invokeConfig.src)
      };
    }
  };
}
