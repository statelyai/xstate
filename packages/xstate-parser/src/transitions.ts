import * as t from '@babel/types';
import { MaybeArrayOfActions } from './actions';
import { Cond } from './conds';
import { BooleanLiteral } from './scalars';
import { StringLiteralNode } from './types';
import {
  createParser,
  GetParserResult,
  maybeArrayOf,
  objectTypeWithKnownKeys,
  unionType,
  wrapParserResult
} from './utils';

export type TransitionConfigNode = GetParserResult<typeof TransitionObject>;

const TransitionTargetLiteral = createParser({
  babelMatcher: t.isStringLiteral,
  parseNode: (node): StringLiteralNode => {
    return {
      value: node.value,
      node
    };
  }
});

const TransitionObject = objectTypeWithKnownKeys({
  target: TransitionTargetLiteral,
  actions: MaybeArrayOfActions,
  cond: Cond,
  internal: BooleanLiteral
});

const TransitionConfigOrTargetLiteral = unionType([
  TransitionObject,
  wrapParserResult(
    TransitionTargetLiteral,
    (target): TransitionConfigNode => {
      return {
        target,
        node: target.node
      };
    }
  )
]);

export const MaybeTransitionArray = maybeArrayOf(
  TransitionConfigOrTargetLiteral
);
