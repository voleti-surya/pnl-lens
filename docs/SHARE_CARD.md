<!--
@file  docs/SHARE_CARD.md
@area  Docs
@what  Share card v2 ("My Trading Edge"): the spec as built — rules, layout, tile catalogue, slot filling, text styles, founding trader numbers, QR, dialog, tests — and where the owner's 29 Oct review changed the original brief.
-->
# Share card v2: "My Trading Edge"

The card a trader posts from **Share progress** in the report header. It replaces the PR #24 progress card.
Code: `packages/shared/src/insights/share.ts` (content, slots, layout, text styles, colours),
`packages/shared/src/insights/share-qr.ts` (QR), `apps/web/components/workspace/share-draw.ts` (canvas drawing),
`ShareCard.tsx` (dialog), migration `0032_founding_traders.sql`.

## Rules
1. **Strengths only.** No losses, worst day or trade, negative numbers, "edge negative" or red. A tile appears only
   when it passes its strength rule. Otherwise the next tile in the pool takes its slot.
2. **Privacy.**
   - No money amounts, currency signs, or names (person or client id).
   - An underlying's plain name is allowed: BANKNIFTY, RELIANCE, AAPL.
   - Contract codes (strike, expiry, CE/PE) never appear (`safeUnderlying`, `CONTRACT_RE`).
3. **Drawn in the browser** on a canvas, after `document.fonts.ready`. Nothing is sent to a server to build it.
4. **The engine is unchanged.** Everything is computed from the stored report.
5. **One source of truth.** Labels, chip names, copy, colours, layout and text styles live only in `share.ts`.

## Canvas
- **Card** 1080 × 1728. **Story** 1080 × 1920: the card centred on black, with the glow continuing.
- Margin 72, content width 936, gap 20. Black background with a soft yellow glow top-right.
- Logo and "PnL Lens" at the top left; the period ("Jan–Mar 2025") in grey, right-aligned.
- Title: "MY TRADING" in white, "EDGE" in yellow #FFD400.
- **Founding badge** (when the user has a number and has not hidden it):
  - a gold gradient #FFE27A → #E0A800 with a star and a soft glow;
  - text "FOUNDING TRADER / #0427 / 1000".
- **Rows:**

| Row | y | Height | Slots (width) |
|---|---|---|---|
| A | 620 | 340 | A1 hero (560) · A2 (356) |
| B | 980 | 250 | B1 (448) · B2 (468) |
| C | 1250 | 220 | C1 (380) · C2 (272) · C3 (244) |

  When fewer tiles qualify, a row shares its width between the tiles it has, and fewer rows are centred between the badge and the footer.
- **Slot styles** (the accent belongs to the slot, not the stat):

| Slot | Style |
|---|---|
| A1 | Yellow fill, black text, trophy |
| A2 | Green border |
| B1 | Blue border, blue value |
| B2 | Purple border, purple value |
| C1 | Orange fill, black text |
| C2 | Green border, green value |
| C3 | Yellow border, yellow value |

  Card fill #1A1A1A, radius 28, 3px border with a soft accent glow.
- **Each tile:** an UPPERCASE label, a big value and an optional sub-line. The value shrinks in 4px steps (88 → 40). It goes onto two lines when that allows a bigger size.
- **Footer:**
  - QR 164 × 164: 33 modules × 4px plus a white 4-module quiet zone;
  - "Read your own P&L, trade by trade.";
  - 🌐 "pnllens.com" in yellow at 44px;
  - "Analysis of my own trades. Not investment advice." in small grey.

## Text styles (Manrope, the site's `--f-sans`)

| Style | Use | Spec |
|---|---|---|
| Display | Title | 800, 104px |
| Value | Tile values, badge number | 800, 88 → 40px |
| Label | Tile labels, "FOUNDING TRADER" | 800, 28px, uppercase, 0.04em |
| Body | Sub-lines, footer line, wordmark; "pnllens.com" at 44px | 700, 32px |
| Small | Period, disclaimer | 600, 24px, #9A9A9A |

## Tile catalogue

| Key | Label | Value | Shown only if |
|---|---|---|---|
| streak | Biggest achievement | "9-day win streak" | Longest run of trading days with net P&L > 0 is ≥ 3 (dates) |
| planKept | Biggest achievement | "4 of 5 rules kept" | The earlier 30-day plan has ≥ 3 rules met |
| level | Biggest achievement | "Reached Steady" | Level is Steady, Disciplined or Elite |
| winRun | Biggest achievement | "7 wins in a row" | ≥ 5 winning trades in a row, in date order (all trades dated) |
| proIn | Pro in | "BANKNIFTY" / "62% win rate" | Underlying with ≥ 15 trades, ≥ 55% won and net > 0; highest win rate |
| bestDay | Best day | "Tuesday" | Weekday with the highest net P&L, > 0, with ≥ 5 trades (dates) |
| bestTrade | Best trade | "+184%" / "return on premium" (options) or "return on trade" | Highest P&L ÷ buy value ≥ 1%, among trades at least the median buy value; capped "+999%" |
| bestMonth | Best month | "July" (plus the year when the months span 12+) | ≥ 2 months with dates; best net > 0 |
| greenDays | Green days | "58%" | ≥ 5 trading days and ≥ 50% green |
| winRate | Trades won | "54%" | ≥ 20 trades and ≥ 50% won |
| tradesRead | Trades read | "312" | Always |
| months | Months analysed | "6" | ≥ 1 month with dates |
| habits | Habits tracked | "6" | Always (the Progress dimensions) |

## Slot filling (same report → same card)
1. **Hero (A1):** the first eligible tile from
   - streak (≥ 5 days)
   - → planKept
   - → level
   - → streak (3–4 days)
   - → winRun
   - → tradesRead.

   The user may pick another eligible hero.
2. **Default tiles:** A2 proIn, B1 bestDay, B2 bestTrade, C1 bestMonth, C2 greenDays, C3 tradesRead.
3. **Pool**, in order, when a default isn't eligible, is used or was switched off:
   - winRate → planKept → bestTrade → months → habits → tradesRead;
   - then, only for small reports, the hero achievements not used as the hero (level, streak, winRun).
4. **No duplicates.**
   - The card always shows min(7, eligible) tiles.
   - A tile can be switched off only while a spare can take its place.

## Founding trader numbers (migration 0032)
- **Storage:** `users.founding_no` (1–1000, unique), from a one-row counter updated inside the granting transaction. A rolled-back grant leaves no gap.
- **Who gets one:**
  - given once, on the first **paid** plan (trigger on `subscriptions` with a `payment_id`);
  - or on a manual grant the owner ticks **Founding trader** (`admin_grant_plan(…, p_founding)`);
  - never to staff roles, or to accounts the owner marks **test** (`users.is_test`, admin console).
- **Write protection:** the app roles cannot write either column (guard trigger), and cannot call the assign or reset functions.
- **Never reassigned:** account deletion keeps the number on the anonymised row.
- **Reset before launch:**
  - `MIGRATE_DATABASE_URL=… npm run founding:reset -w @pnl-lens/db -- --yes`;
  - refused once any payment is paid.
- **API:** `GET /me` returns `foundingNo`.

## QR
- The URL is `https://pnllens.com/?utm_source=share_card&utm_medium=qr`, the same for both sites, because the landing page picks India or Global from the visitor's country.
- It carries no user data, so the modules were generated once and committed (`share-qr.ts`, error correction M). No QR library ships.
- A unit test decodes the committed modules, and the visual test decodes the QR on the drawn card.
- A visit records `landing_visit {region, source, medium}`. The admin's Landing page panel shows "Share cards made" and "Visits from share card QR codes".

## Dialog
- **Contents:**
  - a note on what is never shown;
  - **Biggest achievement** chips;
  - **Tiles** chips (switch one off and the pool refills it);
  - **Card / Story**;
  - **Founding badge** (only with a number);
  - a live preview, with an `aria-label` summarising the tiles and a plain-text list under it;
  - **Download image** (`pnl-lens-edge.png` / `pnl-lens-edge-story.png`) and **Share…** (where the phone supports sharing files).
- **Event:** `share_card_used { how, format, hero, tiles, badge }`.
- **Placement:** the button is in the report header on every view. Inside one file's tab, the card uses only that file's data, without the plan check.

## Changes from the original brief (owner review, 29 Oct)
- **Founding numbers:** manual grants count only when ticked, because payments are off and manual grants mostly go to testers.
- **QR:** pre-made instead of the `qrcode` package.
- **"Minimum 7 tiles":** small reports show fewer tiles instead of weak padding.
- **Tighter rules:**
  - `winRun` needs dates;
  - `bestMonth` uses trade dates only;
  - `bestTrade` ignores trades smaller than the median buy.
- **Open for the owner:**
  - attach the target design image as `docs/design/share-card-v2-target.jpg`;
  - scan the QR on a phone from a downloaded card;
  - have a lawyer review best-stat cards against SEBI's rules on performance claims.

## Tests
- `packages/shared/test/share.test.ts`, on every golden report:
  - privacy;
  - positives;
  - each strength rule checked on its own;
  - slot filling (with and without dates, 1 or many months, with and without a plan, with and without a number);
  - no duplicates; determinism;
  - formats; layout sums; the committed QR decodes.
- `packages/db/test/db/founding.test.ts`:
  - numbers are given once and in order;
  - only on a paid plan or a ticked grant;
  - never to staff or test accounts;
  - nothing past 1000;
  - no gap after a rollback;
  - reset refused after a paid order;
  - app roles locked out.
- `tests/e2e-web/share.spec.ts`:
  - the dialog, hero and tile chips;
  - Card and Story downloads (sizes and names);
  - the badge from `/me` and its toggle;
  - the event props;
  - a QR visit counted.
- `tests/e2e-web/share-visual.spec.ts`:
  - the real drawing code on a blank page with the site's font;
  - 2 golden reports × Card/Story compared with stored snapshots (`-darwin` and `-linux`);
  - the QR on the drawn card decodes.
  - No stack needed.
