import { expect, test } from "@playwright/test";

test("two browsers complete the Phase 1 private-room workflow", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const playerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const player = await playerContext.newPage();

  await host.goto("/create");
  await host.getByRole("textbox", { name: "Your nickname" }).fill("Host");
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
  await expect(player.getByText("2 connected")).toBeVisible();
  await player.getByRole("button", { name: /Seat 2 Open seat/ }).click();
  await expect(host.getByRole("button", { name: "Seat 2 Player 2 Ready" })).toBeVisible();

  await host.getByRole("button", { name: "Settings" }).click();
  await host.locator('input[type="number"]').nth(2).fill("20");
  await host.getByRole("button", { name: "Save settings" }).click();
  await expect(player.getByText("2 connected")).toBeVisible();

  await host.getByRole("textbox", { name: "Write a message…" }).fill("Welcome");
  await host.getByRole("button", { name: "Send" }).click();
  await expect(player.getByText("Welcome")).toBeVisible();

  await player.getByRole("textbox", { name: "Write a message…" }).fill("Hello host");
  await player.getByRole("button", { name: "Send" }).click();
  await expect(host.getByText("Hello host")).toBeVisible();

  await host.getByRole("button", { name: "Start game" }).click();
  await expect(player.getByText("Game starting")).toBeVisible();

  await player.reload();
  await expect(player.getByRole("heading", { name: "Poker table" })).toBeVisible();
  await expect(player.getByText("Game starting")).toBeVisible();

  await hostContext.close();
  await playerContext.close();
});
