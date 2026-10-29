/**
 * @file  tests/e2e-web/share.spec.ts
 * @area  Tests
 * @what  Share progress (v2): 7 strength tiles and no money, hero and tile chips change the card, Card (1080×1728) and Story (1080×1920) downloads with a readable QR, the founding badge from /me and its toggle, the use recorded with its choices; a QR visit is counted.
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { signIn, givePlan, sql, FIX } from './helpers';

test.skip(({ browserName }) => browserName === 'webkit', 'Secure cookie over plain http');

const size = (png: Buffer) => [png.readUInt32BE(16), png.readUInt32BE(20)];   // IHDR width × height

test('share card v2: strengths only, hero and tiles, card and story, founding badge, recorded', async ({ page }) => {
  const email = `share-${Date.now()}@e2e.local`;
  await signIn(page, email, '/upload');
  givePlan(email);
  await page.goto('/upload');
  await page.setInputFiles('#file', path.join(FIX, 'zerodha_tradebook.csv'));
  await page.check('input[name=consent]');
  await page.getByRole('button', { name: 'Analyse' }).click();
  await page.waitForURL(/\/report\//, { timeout: 90_000 });

  await page.locator('[data-share-open]').click();
  const dlg = page.locator('[data-share]');
  await expect(dlg).toBeVisible();
  const items = dlg.locator('[data-share-items] li');
  await expect(items).toHaveCount(7);
  const list = dlg.locator('[data-share-items]');
  expect(await list.innerText()).not.toMatch(/[₹$€£]|BANKNIFTY\d|\d(CE|PE)\b/);
  await expect(list).toContainText('Pro in: RELIANCE (60% win rate)');
  await expect(list).toContainText('Best day: Monday');
  await expect(dlg.locator('[data-share-badge]')).toHaveCount(0);           // no founding number yet

  // hero picker and tile chips
  await dlg.locator('[data-share-hero]').getByRole('button', { name: 'Trades read' }).click();
  await expect(items.first()).toHaveText('Trades read: 96');
  await dlg.locator('[data-share-tiles]').getByRole('button', { name: 'Best day', exact: true }).click();
  await expect(list).not.toContainText('Best day');
  await expect(items).toHaveCount(7);                                        // the pool refilled the slot
  await expect(dlg.locator('[data-share-canvas]')).toHaveAttribute('aria-label', /^My trading edge card, Jan–Mar 2025: Trades read: 96;/);

  // card download
  let [download] = await Promise.all([page.waitForEvent('download'), dlg.locator('[data-share-download]').click()]);
  expect(download.suggestedFilename()).toBe('pnl-lens-edge.png');
  let png = fs.readFileSync((await download.path())!);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(size(png)).toEqual([1080, 1728]);

  // story download
  await dlg.locator('[data-share-format="story"]').click();
  [download] = await Promise.all([page.waitForEvent('download'), dlg.locator('[data-share-download]').click()]);
  expect(download.suggestedFilename()).toBe('pnl-lens-edge-story.png');
  png = fs.readFileSync((await download.path())!);
  expect(size(png)).toEqual([1080, 1920]);

  await expect.poll(() => sql(`select count(*) from events e join users u on u.id = e.user_id where u.email = '${email}' and e.name = 'share_card_used'`)).toBe('2');
  const props = JSON.parse(sql(`select e.props from events e join users u on u.id = e.user_id where u.email = '${email}' and e.name = 'share_card_used' order by e.id desc limit 1`));
  expect(props).toMatchObject({ how: 'download', format: 'story', hero: 'tradesRead', badge: false });
  expect(props.tiles).toHaveLength(6);
  expect(props.tiles).not.toContain('bestDay');

  // founding badge: shown once the account has a number, and can be hidden
  await dlg.getByRole('button', { name: 'Close' }).click();
  await expect(dlg).toHaveCount(0);
  sql(`update users set founding_no = null where founding_no = 427`);       // a number is unique: free it from an earlier run
  sql(`update users set founding_no = 427 where email = '${email}'`);
  await page.locator('[data-share-open]').click();
  await expect(dlg.locator('[data-share-badge]')).toBeVisible();
  await expect(dlg.locator('[data-share-canvas]')).toHaveAttribute('aria-label', /founding trader #0427 \/ 1000/);
  await dlg.locator('[data-share-badge]').click();
  await expect(dlg.locator('[data-share-canvas]')).not.toHaveAttribute('aria-label', /founding trader/);
});

test('a visit from the share card QR is counted, with nothing about the visitor', async ({ page }) => {
  const before = Number(sql(`select count(*) from events where name = 'landing_visit' and props->>'source' = 'share_card'`));
  await page.goto('/?utm_source=share_card&utm_medium=qr');
  await expect.poll(() => Number(sql(`select count(*) from events where name = 'landing_visit' and props->>'source' = 'share_card'`))).toBe(before + 1);
  const row = JSON.parse(sql(`select json_build_object('user', user_id, 'props', props) from events where name = 'landing_visit' order by id desc limit 1`));
  expect(row.user).toBeNull();
  expect(Object.keys(row.props).sort()).toEqual(['medium', 'region', 'source']);
});
