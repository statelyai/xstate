import type { Page, TestInfo, test } from '@playwright/test';
import { expectTypeOf, it } from 'vitest';
import type {
  PlaywrightMock,
  PlaywrightPage,
  PlaywrightSutConfig,
  PlaywrightTestInfo
} from '../src/playwright.ts';

it('accepts a real Playwright page', () => {
  expectTypeOf<
    Page extends PlaywrightPage ? true : false
  >().toEqualTypeOf<true>();
});

it('accepts route registrations returned from mocks', () => {
  expectTypeOf<(page: Page) => ReturnType<Page['route']>>().toExtend<
    PlaywrightMock<Page>
  >();
});

it('accepts testInfo and test.step', () => {
  expectTypeOf<
    TestInfo extends PlaywrightTestInfo ? true : false
  >().toEqualTypeOf<true>();
  const step: NonNullable<PlaywrightSutConfig<Page, any, any>['step']> =
    null! as typeof test.step;
  void step;
});
