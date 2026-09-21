import { expect, test } from '@playwright/test';
import * as fc from 'fast-check';
import { formatTestCoverage, propertyTest } from '@xstate/test';
import { createPlaywrightSut } from '@xstate/test/playwright';
import { formMachine } from './machine.ts';

test('the form matches its model', async ({ page }) => {
  const { coverage } = await propertyTest(formMachine, {
    seed: 1,
    numRuns: 25,
    maxCommands: 8,
    events: {
      FILL: fc.record({
        value: fc.oneof(
          fc.constant(''),
          fc.constant('Ada'),
          fc.constant('ada@example.com'),
          fc.constant('not-an-email')
        )
      }),
      NEXT: fc.constant({}),
      BACK: fc.constant({})
    },
    sut: createPlaywrightSut(page, {
      reset: async (page) => {
        await page.goto('/');
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
    }),
    invariant: () => {}
  });

  console.log(formatTestCoverage(coverage));
});
