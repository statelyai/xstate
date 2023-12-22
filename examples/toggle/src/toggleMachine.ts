import { createMachine } from 'xstate';

export const toggleMachine = createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QBcD2UoBswDoCWAdgIYDGyeAbmAMRobYDaADALqKgAOqse5qB7EAA9EARgCcADhxMAbACYArE0kAWJqIDso+ZtkAaEAE8xm8TllMrTTU3lbVq2bIC+Lw3Sy5S5KrXRezGxIIFw8fAIhIggS0nJKKupaOnqGJgiS5pbWAMzyTIqq4qqa8m7uIASoEHCCntiCYbx4-ILRALSqkmmI7ZqaFtZMeQVFJWUV9biEPpRgjdzNrVGIlj0I4oo4mjm7ObL7okxOkopuHgHYOLNUC+EtkaDReQOqCRJ2iqJFSuub23t9odjrJTuUXEA */
  id: 'toggle',
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        toggle: 'active'
      }
    },
    active: {
      on: {
        toggle: 'inactive'
      }
    }
  }
});
