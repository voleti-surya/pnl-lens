/**
 * @file  packages/shared/test/share.test.ts
 * @area  Tests
 * @what  Share card v2 on every golden report: no money, currency, contract symbol or name; positives only; deterministic slot filling (dates or not, 1 or many months, plan or not, founding number or not); formats; layout fits; the committed QR reads back as SHARE_URL.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import jsQR from 'jsqr';
import {
  shareCard, eligibleTiles, periodLabel, foundingLabel, plusPct, safeUnderlying, LAYOUT, CARD, COLORS, SLOT_STYLE, TEXT, MIN_TILES,
  type TileKey,
} from '../src/insights/share';
import { SHARE_QR, SHARE_URL } from '../src/insights/share-qr';

const dir = join(__dirname, '../../engine/test/golden');
const goldens = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => ({ name: f, report: JSON.parse(readFileSync(join(dir, f), 'utf8')).report })).filter((g) => g.report);
const get = (n: string) => goldens.find((g) => g.name === n)!.report;
const tb = get('zerodha_tradebook_csv.json');           // dated, 3 months, 96 trades
const fo = get('zerodha_fo_statement_xlsx.json');       // no dates
const dhan = get('dhan_tradebook_csv.json');            // dated, 1 month
const groww = get('groww_pnl_csv.json');                // 5 trades, mostly losses
const keys = (c: ReturnType<typeof shareCard>) => [c.hero.key, ...c.tiles.map((t) => t.key)];

describe('share card v2: privacy and positives on every golden report', () => {
  for (const g of goldens) {
    it(`${g.name}`, () => {
      for (const opts of [{}, { planCheck: { met: 4, measured: 5 }, foundingNo: 427 }]) {
        const c = shareCard(g.report, opts);
        const text = JSON.stringify(c);
        // no money: no currency signs or codes, no amounts with units
        expect(text).not.toMatch(/[₹$€£¥]|\b(INR|USD|EUR|GBP|Rs\.?|rupees?|dollars?|lakh|crore|L\b|Cr\b|k\b)/i);
        // no contract symbols: only an underlying's plain name may appear
        for (const t of g.report.trades) if (t.symbol !== t.underlying) expect(text).not.toContain(String(t.symbol));
        expect(text).not.toMatch(/\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\d|\d(CE|PE)\b/);
        // no names
        if (g.report.m.clientId) expect(text).not.toContain(String(g.report.m.clientId));
        // positives only: no minus signs, no negative numbers, no red
        for (const t of [c.hero, ...c.tiles]) {
          expect(t.value).not.toMatch(/[−-]\s*\d|negative|loss|worst/i);
          expect(t.value.length).toBeGreaterThan(0);
        }
        const palette: string[] = [...Object.values(COLORS), ...Object.values(SLOT_STYLE).flatMap((s) => [s.fill, s.value, s.border ?? ''])];
        for (const red of ['#FF6961', '#FF3B30', '#E5484D', '#FF0000']) expect(palette).not.toContain(red);
        // no duplicates; deterministic
        expect(new Set(keys(c)).size).toBe(keys(c).length);
        expect(shareCard(g.report, opts)).toEqual(c);
        expect(c.count).toBe(Math.min(MIN_TILES, eligibleTiles(g.report, opts).tiles.size));
      }
    });
  }
});

describe('strength rules', () => {
  it('every shown tile passes its own rule (checked independently on the trades)', () => {
    for (const g of goldens) {
      const T = g.report.trades.filter((t: any) => Number.isFinite(t.pnl));
      const { tiles } = eligibleTiles(g.report, { planCheck: { met: 2, measured: 5 } });
      expect(tiles.has('planKept')).toBe(false);                                       // 2 kept is not a strength
      const wr = T.filter((t: any) => t.pnl > 0).length / T.length;
      expect(tiles.has('winRate')).toBe(T.length >= 20 && wr >= 0.5);
      const lvl = g.report.progress?.level?.name;
      expect(tiles.has('level')).toBe(['Steady', 'Disciplined', 'Elite'].includes(lvl));
      const pro = tiles.get('proIn');
      if (pro) {
        const xs = T.filter((t: any) => String(t.underlying).toUpperCase() === pro.value);
        expect(xs.length).toBeGreaterThanOrEqual(15);
        expect(xs.filter((t: any) => t.pnl > 0).length / xs.length).toBeGreaterThanOrEqual(0.55);
        expect(xs.reduce((s: number, t: any) => s + t.pnl, 0)).toBeGreaterThan(0);
      }
    }
  });
  it('reports without dates show no date tiles', () => {
    const { tiles } = eligibleTiles(fo);
    for (const k of ['streak', 'winRun', 'bestDay', 'bestMonth', 'greenDays', 'months'] as TileKey[]) expect(tiles.has(k)).toBe(false);
  });
  it('one month: no best month; many months: best month is a month name', () => {
    expect(eligibleTiles(dhan).tiles.has('bestMonth')).toBe(false);
    expect(eligibleTiles(tb).tiles.get('bestMonth')!.value).toMatch(/^(January|February|March|April|May|June|July|August|September|October|November|December)$/);
  });
  it('a losing, small report still gets a card, with fewer tiles and no weak stat', () => {
    const c = shareCard(groww);
    expect(c.count).toBeLessThan(MIN_TILES);
    expect(keys(c)).not.toContain('winRate');
    expect(keys(c)).not.toContain('bestTrade');
  });
});

describe('slot filling', () => {
  it('dated report, no plan: defaults where eligible, pool for the rest', () => {
    const c = shareCard(tb);
    expect(c.hero.slot).toBe('A1');
    expect(c.tiles.map((t) => t.slot)).toEqual(['A2', 'B1', 'B2', 'C1', 'C2', 'C3']);
    expect(c.tiles[0]).toMatchObject({ key: 'proIn', value: 'RELIANCE', sub: '60% win rate' });
    expect(c.tiles[1]).toMatchObject({ key: 'bestDay', value: 'Monday' });
    expect(c.tiles[2].key).toBe('bestTrade');
  });
  it('hero order: plan kept before level; level when no plan; the user may pick another eligible hero', () => {
    expect(shareCard(tb, { planCheck: { met: 4, measured: 5 } }).hero).toMatchObject({ key: 'planKept', value: '4 of 5 rules kept' });
    const noPlan = shareCard(tb);
    const { streakDays } = eligibleTiles(tb);
    expect(noPlan.hero.key).toBe(streakDays >= 5 ? 'streak' : 'level');
    expect(noPlan.heroOptions).toContain('level');
    expect(shareCard(tb, { hero: 'tradesRead' }).hero.key).toBe('tradesRead');
    expect(shareCard(tb, { hero: 'proIn' }).hero.key).toBe(noPlan.hero.key);         // not a hero achievement
    const tr = shareCard(tb, { hero: 'tradesRead' });
    expect(tr.tiles.map((t) => t.key)).not.toContain('tradesRead');                    // C3 takes the next pool item
    expect(tr.count).toBe(7);
  });
  it('switching a tile off: the pool refills it; never below 7 when 7 are eligible', () => {
    const base = shareCard(tb);
    const off = shareCard(tb, { exclude: ['bestDay'] });
    expect(keys(off)).not.toContain('bestDay');
    expect(off.count).toBe(7);
    const all = shareCard(tb, { exclude: base.options });
    expect(all.count).toBe(7);
    expect(shareCard(groww, { exclude: ['habits'] }).count).toBe(shareCard(groww).count);   // nothing spare: it stays
  });
  it('founding badge: shown with a number unless hidden; never without one', () => {
    expect(shareCard(tb, { foundingNo: 427 }).founding).toBe('#0427 / 1000');
    expect(shareCard(tb, { foundingNo: 427, badge: false }).founding).toBeNull();
    expect(shareCard(tb).founding).toBeNull();
    expect(shareCard(tb, { foundingNo: 1001 }).founding).toBeNull();
    expect(keys(shareCard(tb, { foundingNo: 427 }))).toEqual(keys(shareCard(tb)));
  });
});

describe('formats', () => {
  it('percentages, names, founding number, cap', () => {
    expect(plusPct(184.4)).toBe('+184%');
    expect(plusPct(5000)).toBe('+999%');
    expect(foundingLabel(427)).toBe('#0427 / 1000');
    expect(foundingLabel(1000)).toBe('#1000 / 1000');
    expect(eligibleTiles(tb).tiles.get('proIn')!.sub).toMatch(/^\d{1,3}% win rate$/);
    expect(periodLabel('2026-04-02', '2026-09-30')).toBe('Apr–Sep 2026');
    expect(periodLabel('2024-11-02', '2025-02-01')).toBe('Nov 2024 – Feb 2025');
    expect(periodLabel(null, null)).toBe('');
  });
  it('underlying names allowed, contract codes not', () => {
    for (const ok of ['BANKNIFTY', 'NIFTY', 'RELIANCE', 'BAJFINANCE', 'AAPL', 'M&M', 'BTC']) expect(safeUnderlying(ok)).toBe(ok);
    for (const bad of ['BANKNIFTY2262333000CE', 'NIFTY24OCT52000PE', 'AAPL 250117C00150000', '500325', '']) expect(safeUnderlying(bad)).toBeNull();
  });
});

describe('layout', () => {
  it('each full row spans the content width; rows and footer fit the card', () => {
    for (const r of Object.values(LAYOUT.rows)) expect(r.slots.reduce((s, [, w]) => s + w, 0) + LAYOUT.gap * (r.slots.length - 1)).toBe(LAYOUT.width);
    expect(LAYOUT.margin * 2 + LAYOUT.width).toBe(CARD.w);
    expect(LAYOUT.rows.C.y + LAYOUT.rows.C.h).toBeLessThanOrEqual(LAYOUT.footer.y);
    expect(LAYOUT.footer.y + LAYOUT.footer.qr).toBeLessThanOrEqual(CARD.h - 40);
    expect(Object.keys(TEXT)).toHaveLength(5);
  });
  it('fewer tiles share the row and are centred', () => {
    const c = shareCard(groww);
    for (const t of [c.hero, ...c.tiles]) { expect(t.x + t.w).toBeLessThanOrEqual(LAYOUT.margin + LAYOUT.width + 0.01); expect(t.y).toBeGreaterThanOrEqual(LAYOUT.band.top); expect(t.y + t.h).toBeLessThanOrEqual(LAYOUT.band.bottom); }
  });
});

describe('QR code', () => {
  it('the committed modules read back as SHARE_URL, which carries no user data', () => {
    const n = SHARE_QR.length, q = 4, s = 4, size = (n + q * 2) * s;
    expect(SHARE_QR.every((r) => r.length === n && /^[01]+$/.test(r))).toBe(true);
    const px = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (SHARE_QR[y][x] === '1')
      for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) { const i = (((y + q) * s + dy) * size + (x + q) * s + dx) * 4; px[i] = px[i + 1] = px[i + 2] = 0; }
    expect(jsQR(px, size, size)?.data).toBe(SHARE_URL);
    expect(SHARE_URL).toBe('https://pnllens.com/?utm_source=share_card&utm_medium=qr');
    expect(LAYOUT.footer.qr).toBe((n + q * 2) * LAYOUT.footer.qrModule);
  });
});
