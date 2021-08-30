import {
  after,
  cancel,
  done,
  escalate,
  log,
  pure,
  raise,
  respond,
  sendParent,
  sendUpdate,
  start,
  stop
} from 'xstate/lib/actions';
import type { ActionNode } from './actions';
import { AnyNode, NumericLiteral, StringLiteral } from './scalars';
import { namedFunctionCall, unionType, wrapParserResult } from './utils';
import * as t from '@babel/types';

export const AfterAction = wrapParserResult(
  namedFunctionCall(
    'after',
    unionType<{ node: t.Node; value: number | string }>([
      StringLiteral,
      NumericLiteral
    ])
  ),
  (result): ActionNode => {
    return {
      node: result.node,
      action: after(result.argument1Result?.value || ''),
      name: ''
    };
  }
);

export const CancelAction = wrapParserResult(
  namedFunctionCall('cancel', AnyNode),
  (result): ActionNode => {
    return {
      node: result.node,
      action: cancel(''),
      name: ''
    };
  }
);

export const DoneAction = wrapParserResult(
  namedFunctionCall('done', AnyNode),
  (result): ActionNode => {
    return {
      node: result.node,
      action: done(''),
      name: ''
    };
  }
);

export const EscalateAction = wrapParserResult(
  namedFunctionCall('escalate', AnyNode),
  (result): ActionNode => {
    return {
      node: result.node,
      action: escalate(''),
      name: ''
    };
  }
);

export const LogAction = wrapParserResult(
  namedFunctionCall('log', AnyNode),
  (result): ActionNode => {
    return {
      node: result.node,
      action: log(),
      name: ''
    };
  }
);

export const PureAction = wrapParserResult(
  namedFunctionCall('pure', AnyNode),
  (result): ActionNode => {
    return {
      node: result.node,
      action: pure(() => []),
      name: ''
    };
  }
);

export const RaiseAction = wrapParserResult(
  namedFunctionCall('raise', AnyNode),
  (result): ActionNode => {
    return {
      node: result.node,
      action: raise(''),
      name: ''
    };
  }
);

export const RespondAction = wrapParserResult(
  namedFunctionCall('respond', AnyNode),
  (result): ActionNode => {
    return {
      node: result.node,
      action: respond(''),
      name: ''
    };
  }
);

export const SendParentAction = wrapParserResult(
  namedFunctionCall('sendParent', AnyNode),
  (result): ActionNode => {
    return {
      node: result.node,
      action: sendParent(''),
      name: ''
    };
  }
);

export const SendUpdateAction = wrapParserResult(
  namedFunctionCall('sendUpdate', AnyNode),
  (result): ActionNode => {
    return {
      node: result.node,
      action: sendUpdate(),
      name: ''
    };
  }
);

export const StartAction = wrapParserResult(
  namedFunctionCall('start', AnyNode),
  (result): ActionNode => {
    return {
      node: result.node,
      action: start(''),
      name: ''
    };
  }
);

export const StopAction = wrapParserResult(
  namedFunctionCall('stop', AnyNode),
  (result): ActionNode => {
    return {
      node: result.node,
      action: stop(''),
      name: ''
    };
  }
);
