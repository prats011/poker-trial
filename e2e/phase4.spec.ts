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
  for (let turn = 0; turn < 40; turn += 1) {
    if (await host.getByText("HAND_COMPLETE", { exact: true }).count() ||
      await player.getByText("HAND_COMPLETE", { exact: true }).count()) return;
    if (await chooseAction(host) || await chooseAction(player)) {
      await host.waitForTimeout(100);
      continue;
    }
    await host.waitForTimeout(150);
  }
  throw new Error("The hand did not complete.");
}

async function playAllInHand(host: Page, player: Page) {
  for (let turn = 0; turn < 20; turn += 1) {
    if (await host.getByText("HAND_COMPLETE", { exact: true }).count() ||
      await player.getByText("HAND_COMPLETE", { exact: true }).count()) return;
    for (const page of [host, player]) {
      const allIn = page.getByRole("button", { name: "ALL IN", exact: true });
      if (await allIn.count() && await allIn.first().isVisible()) {
        await allIn.first().click();
        await page.waitForTimeout(100);
        break;
      }
      const call = page.getByRole("button", { name: "CALL", exact: true });
      if (await call.count() && await call.first().isVisible()) {
        await call.first().click();
        await page.waitForTimeout(100);
        break;
      }
    }
  }
  throw new Error("The all-in hand did not complete.");
}

async function createTwoPlayerTable(browser: Browser, overrides: Record<string, unknown> = {}) {
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();
  await host.goto("/create");
  await host.getByRole("textbox", { name: "Your nickname" }).fill("Host");
  if (overrides.startingStack) await host.locator('input[type="number"]').nth(0).fill(String(overrides.startingStack));
  if (overrides.smallBlind) await host.locator('input[type="number"]').nth(2).fill(String(overrides.smallBlind));
  if (overrides.bigBlind) await host.locator('input[type="number"]').nth(3).fill(String(overrides.bigBlind));
  if (overrides.rebuysEnabled === false) await host.getByLabel("Enable play-money rebuys").uncheck();
  if (overrides.rebuyMinAmount) await host.locator('input[type="number"]').nth(4).fill(String(overrides.rebuyMinAmount));
  if (overrides.rebuyMaxAmount) await host.locator('input[type="number"]').nth(5).fill(String(overrides.rebuyMaxAmount));
  await host.getByRole("button", { name: "Create table" }).click();
  const inviteUrl = await host.locator("a", { hasText: "Open lobby" }).getAttribute("href");
  expect(inviteUrl).toBeTruthy();
  await host.goto(inviteUrl!);
  await host.getByRole("button", { name: /Seat 1 Open seat/ }).click();
  await player.goto(inviteUrl!);
  await player.getByRole("textbox", { name: "Your nickname" }).fill("Player 2");
  await player.getByRole("button", { name: "Join lobby" }).click();
  await player.getByRole("button", { name: /Seat 2 Open seat/ }).click();
  await expect(host.getByRole("button", { name: "Seat 2 Player 2 Ready" })).toBeVisible();
  return { host, player, hostContext, playerContext, inviteUrl: inviteUrl! };
}

test("host pause/resume works between hands and synchronizes to both browsers", async ({ browser }) => {
  const { host, player, hostContext, playerContext } = await createTwoPlayerTable(browser);
  await host.getByRole("button", { name: "Start game" }).click();
  await expect(host.getByText("Hand · PREFLOP")).toBeVisible();
  await playHand(host, player);
  await host.getByRole("button", { name: "Pause game" }).click();
  await expect(host.getByText("PAUSED", { exact: true })).toBeVisible();
  await expect(player.getByText("PAUSED", { exact: true })).toBeVisible();
  await expect(host.getByRole("button", { name: "Next hand" })).toBeDisabled();
  await host.getByRole("button", { name: "Resume game" }).click();
  await expect(host.getByRole("button", { name: "Next hand" })).toBeEnabled();
  await host.getByRole("button", { name: "Next hand" }).click();
  await expect(host.getByText("Hand · PREFLOP")).toBeVisible();
  await hostContext.close();
  await playerContext.close();
});

test("pause during a hand becomes pending and pauses after payout", async ({ browser }) => {
  const { host, player, hostContext, playerContext } = await createTwoPlayerTable(browser);
  await host.getByRole("button", { name: "Start game" }).click();
  await expect(host.getByText("Hand · PREFLOP")).toBeVisible();
  await host.getByRole("button", { name: "Pause game" }).click();
  await expect(host.getByText("PAUSE PENDING", { exact: true })).toBeVisible();
  await playAllInHand(host, player);
  await expect(host.getByText("PAUSED", { exact: true })).toBeVisible();
  await expect(player.getByText("PAUSED", { exact: true })).toBeVisible();
  await hostContext.close();
  await playerContext.close();
});

test("host end confirmation closes the table and non-host lifecycle requests are rejected", async ({ browser }) => {
  const { host, player, hostContext, playerContext, inviteUrl } = await createTwoPlayerTable(browser);
  await host.getByRole("button", { name: "Start game" }).click();
  await expect(host.getByText("Hand · PREFLOP")).toBeVisible();
  expect(await player.getByRole("button", { name: "Pause game" }).count()).toBe(0);
  host.once("dialog", (dialog) => void dialog.dismiss());
  await host.getByRole("button", { name: "End game" }).click();
  await expect(host.getByText("END PENDING", { exact: true })).toHaveCount(0);
  await expect(host.getByText("Hand · PREFLOP")).toBeVisible();
  host.once("dialog", (dialog) => void dialog.accept());
  await host.getByRole("button", { name: "End game" }).click();
  await expect(host.getByText("END PENDING", { exact: true })).toBeVisible();
  await playHand(host, player);
  await expect(host.getByText("Game ended")).toBeVisible();
  expect(await host.getByRole("button", { name: "End game" }).count()).toBe(1);
  await hostContext.close();
  await playerContext.close();
  expect(inviteUrl).toContain("/game/");
});

test("a zero-stack player receives a custom rebuy offer", async ({ browser }) => {
  const { host, player, hostContext, playerContext } = await createTwoPlayerTable(browser, {
    startingStack: 20,
    smallBlind: 1,
    bigBlind: 2,
    rebuyMinAmount: 5,
    rebuyMaxAmount: 20
  });
  await host.getByRole("button", { name: "Start game" }).click();
  await playAllInHand(host, player);
  const eligible = (await host.getByText("Rebuy available").count()) ? host : player;
  await expect(eligible.getByText("Rebuy available")).toBeVisible();
  await expect(eligible.getByText(/Time remaining:/)).toBeVisible();
  await eligible.waitForTimeout(1000);
  await eligible.reload();
  await expect(eligible.getByText("Rebuy available")).toBeVisible();
  await eligible.getByRole("spinbutton", { name: "Rebuy amount" }).fill("10");
  await eligible.getByRole("button", { name: "Confirm rebuy" }).click();
  await expect(eligible.getByText("Rebuy available")).toHaveCount(0);
  await hostContext.close();
  await playerContext.close();
});
