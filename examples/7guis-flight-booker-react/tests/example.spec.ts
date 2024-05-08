// @ts-check
import { test, expect } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Flight Booker/);
});

test("book button is enabled when depart date is today", async ({ page }) => {
  function generateDate(days: number) {
    return new Date(Date.now() + days * 86400000).toISOString().split("T")[0];
  }
  const TODAY = generateDate(0);
  await page.goto("/");
  const departDate = page.getByLabel("Depart Date");
  await departDate.fill(TODAY);

  const bookButton = page.getByRole("button");
  expect(await bookButton.isEnabled()).toBe(true);
});

test("book button is disabled when depart date is in the past", async ({
  page,
}) => {
  function generateDate(days: number) {
    return new Date(Date.now() + days * 86400000).toISOString().split("T")[0];
  }
  const LAST_WEEK = generateDate(-7);
  await page.goto("/");
  const departDate = page.getByLabel("Depart Date");
  await departDate.fill(LAST_WEEK);

  const bookButton = page.getByRole("button");
  expect(await bookButton.isEnabled()).toBe(false);
});

test("return date input is showing when roundTrip is selected", async ({
  page,
}) => {
  await page.goto("/");
  const tripSelector = page.getByLabel("Trip Type");
  await tripSelector.selectOption({ value: "roundTrip" });
  const returnDate = page.getByLabel("Return Date");
  expect(await returnDate.isDisabled()).toBe(false);
});

test("book button is disabled when return date is in before depart date", async ({
  page,
}) => {
  function generateDate(days: number) {
    return new Date(Date.now() + days * 86400000).toISOString().split("T")[0];
  }
  const LAST_WEEK = generateDate(-7);
  await page.goto("/");
  const tripSelector = page.getByLabel("Trip Type");
  await tripSelector.selectOption({ value: "roundTrip" });
  const returnDate = page.getByLabel("Return Date");
  await returnDate.fill(LAST_WEEK);
  const bookButton = page.getByRole("button");
  expect(await bookButton.isEnabled()).toBe(false);
});

test("itinerary contains 'one way' when one way flight is booked", async ({
  page,
}) => {
  function generateDate(days: number) {
    return new Date(Date.now() + days * 86400000).toISOString().split("T")[0];
  }
  const NEXT_WEEK = generateDate(+7);
  await page.goto("/");
  const departDate = page.getByLabel("Depart Date");
  await departDate.fill(NEXT_WEEK);
  const bookButton = page.getByRole("button");
  bookButton.click();
  await expect(page.getByText("one way")).toBeVisible();
});

test("itinerary contains 'round trip' when return flight is booked", async ({
  page,
}) => {
  function generateDate(days: number) {
    return new Date(Date.now() + days * 86400000).toISOString().split("T")[0];
  }
  const NEXT_WEEK = generateDate(+7);
  await page.goto("/");
  const tripSelector = page.getByLabel("Trip Type");
  await tripSelector.selectOption({ value: "roundTrip" });
  const returnDate = page.getByLabel("Return Date");
  await returnDate.fill(NEXT_WEEK);
  const bookButton = page.getByRole("button");
  bookButton.click();
  await expect(page.getByText("round trip")).toBeVisible();
});
