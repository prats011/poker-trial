import { expect, test, type Browser, type Page } from "@playwright/test";

async function chooseAction(page: Page) {
  for (const name of ["CHECK", "CALL", "ALL IN"]) {
    const button = page.getByRole("button", { name, exact: true });
    if (await button.count() && await button.first().isVisible()) {
      await button.first().click();
      return true;
    }
  }
  return false;
}

async function playHand(host: Page, player: Page) {
  for (let turn = 0; turn < 30; turn += 1) {
    if (await host.getByText("HAND_COMPLETE", { exact: true }).count() ||
      await player.getByText("HAND_COMPLETE", { exact: true }).count()) return;
    if (await chooseAction(host)) {
      await host.waitForTimeout(120);
      continue;
    }
    if (await chooseAction(player)) {
      await player.waitForTimeout(120);
      continue;
    }
    await host.waitForTimeout(200);
  }
  throw new Error("The hand did not reach completion within 30 actions.");
}

async function runVariant(browser: Browser, variant: string) {
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();
  await host.goto("/create");
  await host.getByRole("textbox", { name: "Your nickname" }).fill("Host");
  await host.locator("select").first().selectOption(variant);
  await host.getByRole("button", { name: "Create table" }).click();
  await expect(host.getByText("Your table is ready.")).toBeVisible();
  const inviteUrl = await host.locator("a", { hasText: "Open lobby" }).getAttribute("href");
  expect(inviteUrl).toBeTruthy();

  await host.goto(inviteUrl!);
  await expect(host.getByRole("heading", { name: "Poker table" })).toBeVisible();
  await host.getByRole("button", { name: /Seat 1 Open seat/ }).click();

  await player.goto(inviteUrl!);
  await player.getByRole("textbox", { name: "Your nickname" }).fill("Player 2");
  await player.getByRole("button", { name: "Join lobby" }).click();
  await player.getByRole("button", { name: /Seat 2 Open seat/ }).click();
  await expect(host.getByRole("button", { name: "Seat 2 Player 2 Ready" })).toBeVisible();

  await host.getByRole("button", { name: "Start game" }).click();
  await expect(host.getByText("Hand · PREFLOP")).toBeVisible();
  await expect(player.getByText("Hand · PREFLOP")).toBeVisible();

  await expect.poll(async () => host.locator("text=(you)").count()).toBeGreaterThan(0);
  await expect.poll(async () => player.locator("text=(you)").count()).toBeGreaterThan(0);
  await playHand(host, player);
  await expect(host.getByText("Payout complete", { exact: false })).toBeVisible();
  await expect(player.getByText("Payout complete", { exact: false })).toBeVisible();

  await expect(host.getByRole("button", { name: "Next hand" })).toBeVisible();
  await host.getByRole("button", { name: "Next hand" }).click();
  await expect(host.getByText("Hand · PREFLOP")).toBeVisible();

  await hostContext.close();
  await playerContext.close();
}

test("two browser contexts complete a Hold'em hand and start the next hand", async ({ browser }) => {
  await runVariant(browser, "HOLD_EM_NO_LIMIT");
});

test("two browser contexts complete an Omaha hand and start the next hand", async ({ browser }) => {
  await runVariant(browser, "OMAHA_HI");
});
