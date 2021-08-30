import { assign, createMachine } from 'xstate';
import { choose } from 'xstate/lib/actions';

export interface PaginationMachineContext {
  totalPages?: number;
  /**
   * This page is 1-indexed, not 0-indexed
   */
  currentPage: number;
}

export type PaginationMachineEvent =
  | {
      type: 'UPDATE_TOTAL_PAGES';
      totalPages: number;
    }
  | {
      type: 'NEXT_PAGE';
    }
  | {
      type: 'PREV_PAGE';
    }
  | {
      type: 'GO_TO_TARGET_PAGE';
      targetPage: number;
    };

const paginationMachine = createMachine<
  PaginationMachineContext,
  PaginationMachineEvent
>(
  {
    id: 'pagination',
    initial: 'awaitingTotalPages',
    context: {
      currentPage: 1
    },
    on: {
      UPDATE_TOTAL_PAGES: {
        cond: 'newTotalPagesIsValidValue',
        actions: choose([
          {
            actions: ['assignTotalPagesToContext', 'goToFirstPage'],
            cond: 'currentPageIsAboveNewTotalPages'
          },
          {
            actions: 'assignTotalPagesToContext'
          }
        ]),
        target: 'idle'
      }
    },
    states: {
      awaitingTotalPages: {},
      idle: {
        on: {
          NEXT_PAGE: {
            cond: 'canGoToNextPage',
            actions: 'goToNextPage'
          },
          PREV_PAGE: {
            cond: 'canGoToPrevPage',
            actions: 'goToPrevPage'
          },
          GO_TO_TARGET_PAGE: {
            actions: 'goToTargetPage',
            cond: 'targetPageIsWithinBounds'
          }
        }
      }
    }
  },
  {
    guards: {
      newTotalPagesIsValidValue: (context, event) => {
        if (event.type !== 'UPDATE_TOTAL_PAGES') return false;

        return event.totalPages > 0;
      },
      currentPageIsAboveNewTotalPages: (context, event) => {
        if (event.type !== 'UPDATE_TOTAL_PAGES') return false;

        return context.currentPage > event.totalPages;
      },
      canGoToNextPage: (context) => {
        return context.currentPage < (context.totalPages || 0);
      },
      canGoToPrevPage: (context) => {
        return context.currentPage > 1;
      },
      targetPageIsWithinBounds: (context, event) => {
        if (event.type !== 'GO_TO_TARGET_PAGE') return false;
        return (
          event.targetPage >= 1 && event.targetPage <= (context.totalPages || 0)
        );
      }
    },
    actions: {
      goToFirstPage: assign({
        currentPage: 1
      }),
      goToPrevPage: assign({
        currentPage: (context) => context.currentPage - 1
      }),
      goToNextPage: assign({
        currentPage: (context) => context.currentPage + 1
      }),
      goToTargetPage: assign((context, event) => {
        if (event.type !== 'GO_TO_TARGET_PAGE') return {};

        return {
          currentPage: event.targetPage
        };
      }),
      assignTotalPagesToContext: assign((context, event) => {
        if (event.type !== 'UPDATE_TOTAL_PAGES') return {};
        return {
          totalPages: event.totalPages
        };
      })
    }
  }
);

export default paginationMachine;
