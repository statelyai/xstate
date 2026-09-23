import { expect, test, type Page } from '@playwright/test';
import * as fc from 'fast-check';
import type { SnapshotFrom } from 'xstate';
import { formatTestCoverage, propertyTest } from '@xstate/test';
import { createPlaywrightSut } from '@xstate/test/playwright';
import { formMachine } from './machine.ts';

// The field is disabled on the review and done steps.
const fieldEnabled = ({
  snapshot
}: {
  snapshot: SnapshotFrom<typeof formMachine>;
}) => snapshot.matches('name') || snapshot.matches('email');

/** Runs the property test against the page at `url`. */
function checkForm(page: Page, url: string) {
  return propertyTest(formMachine, {
    seed: 1,
    numRuns: 100,
    maxCommands: 10,
    // Fails the campaign if no run submits the form.
    reachable: ['#form.done'],
    events: {
      FILL: [
        {
          generate: fc.record({
            value: fc.constantFrom('', 'Ada', 'ada@example.com', 'not-an-email')
          }),
          when: fieldEnabled
        },
        // A value the current step accepts, so runs get past validation.
        {
          case: 'valid',
          generate: fc.constant(null),
          resolve: ({ snapshot }) => ({
            value: snapshot.matches('name') ? 'Ada' : 'ada@example.com'
          }),
          when: fieldEnabled
        }
      ],
      NEXT: fc.constant({}),
      BACK: fc.constant({})
    },
    sut: createPlaywrightSut(page, {
      reset: async (page) => {
        await page.goto(url);
      },
      events: {
        FILL: async (page, event) => {
          await page.fill('#field', event.value);
        },
        NEXT: async (page) => {
          await page.click('#next');
        },
        BACK: async (page) => {
          await page.click('#back');
        }
      },
      read: async (page) => ({
        step: (await page.locator('#step').textContent()) ?? '',
        error: (await page.locator('#error').textContent()) ?? ''
      }),
      projectModel: (snapshot) => ({
        step: String(snapshot.value),
        error: snapshot.context.error
      }),
      // Per-state assertions live on the same `sut`, next to the projections.
      states: {
        review: async (page) => {
          await expect(page.locator('#next')).toHaveText('Submit');
        }
      },
      // The page is static, so there is nothing to wait for on the network.
      settle: async () => {}
    })
  });
}

test('the form matches its model', async ({ page }) => {
  const { coverage } = await checkForm(page, '/');
  console.log(formatTestCoverage(coverage));
});

test('reports a counterexample when the form is buggy', async ({ page }) => {
  // `?bug` makes the page accept any non-empty email.
  await expect(checkForm(page, '/?bug')).rejects.toThrow('sut diverged');
});
