/**
 * @file  packages/shared/src/insights/share.ts
 * @area  Reports
 * @what  The "My Trading Edge" share card (v2, docs/SHARE_CARD.md): the tile catalogue (positives only), the deterministic slot filling, the founding badge text and every layout, colour and text style the browser draws with.
 */
/**
 * Pure. Every value is a count, a percentage, a weekday or month name, a level or an underlying's name: never a money
 * amount, a currency, a person's name or a contract symbol, so a card can be posted publicly. A tile is shown only
 * when it passes its strength rule; weak stats are left out, never shown in red. The browser draws the card
 * (apps/web/components/workspace/ShareCard.tsx); all text and geometry live here, once.
 */
import { consistency } from './deep';

export type TileKey = 'streak' | 'planKept' | 'level' | 'winRun' | 'proIn' | 'bestDay' | 'bestTrade' | 'bestMonth'
  | 'greenDays' | 'winRate' | 'tradesRead' | 'months' | 'habits';
export interface Tile { key: TileKey; label: string; value: string; sub?: string }
export type SlotId = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2' | 'C3';
export interface PlacedTile extends Tile { slot: SlotId; x: number; y: number; w: number; h: number }
export interface ShareOpts {
  planCheck?: { met: number; measured: number } | null;
  foundingNo?: number | null;
  /** the hero the user picked (must be eligible); default: the first in HERO_ORDER */
  hero?: TileKey | null;
  /** tiles the user switched off; the pool refills their slots (never below min(7, eligible)) */
  exclude?: TileKey[];
  /** show the founding badge (default true when there is a number) */
  badge?: boolean;
}
export interface ShareCardData {
  period: string;
  hero: PlacedTile;
  tiles: PlacedTile[];
  /** every eligible hero achievement, for the hero picker */
  heroOptions: TileKey[];
  /** every eligible non-hero tile, for the tile chips */
  options: TileKey[];
  /** keys that may be switched off now (a spare tile can take the slot) */
  removable: TileKey[];
  founding: string | null;
  /** tiles shown (hero included); fewer than 7 when the report has fewer strengths */
  count: number;
  summary: string;
}

/* ------------------------------------------------------------------ design constants (spec §2, §5) */
export const CARD = { w: 1080, h: 1728 } as const;
export const STORY = { w: 1080, h: 1920 } as const;
export const COLORS = {
  bg: '#000000', ink: '#0A0A0A', white: '#FFFFFF', grey: '#9A9A9A', card: '#1A1A1A',
  yellow: '#FFD400', green: '#2BB673', blue: '#3D8BFF', purple: '#A66BFF', orange: '#FF9F1C',
  gold1: '#FFE27A', gold2: '#E0A800',
} as const;
/** the only 5 text styles (Manrope); sizes in px. Body may be drawn at 44px for "pnllens.com". */
export const TEXT = {
  display: { weight: 800, size: 104 },
  value: { weight: 800, size: 88, min: 40, step: 4 },
  label: { weight: 800, size: 28, spacing: 0.04 },
  body: { weight: 700, size: 32, url: 44 },
  small: { weight: 600, size: 24 },
} as const;
export const LAYOUT = {
  margin: 72, width: 936, gap: 20, radius: 28, border: 3, glowBlur: 24, glowAlpha: 0.35, pad: 32,
  logo: { x: 72, y: 72, size: 64 },
  periodY: 104,
  title: { x: 72, line1: 290, line2: 400 },
  badge: { x: 72, y: 450, w: 520, h: 120 },
  rows: {
    A: { y: 620, h: 340, slots: [['A1', 560], ['A2', 356]] },
    B: { y: 980, h: 250, slots: [['B1', 448], ['B2', 468]] },
    C: { y: 1250, h: 220, slots: [['C1', 380], ['C2', 272], ['C3', 244]] },
  } as Record<'A' | 'B' | 'C', { y: number; h: number; slots: [SlotId, number][] }>,
  /** tiles sit between the badge and the footer; fewer rows are centred in this band */
  band: { top: 620, bottom: 1470 },
  footer: { y: 1500, qr: 164, qrModule: 4, line1Y: 1556, urlY: 1614, noteY: 1676 },
} as const;
export interface SlotStyle { fill: string; border: string | null; value: string; labelInk: string; icon?: 'trophy' }
export const SLOT_STYLE: Record<SlotId, SlotStyle> = {
  A1: { fill: COLORS.yellow, border: null, value: COLORS.ink, labelInk: COLORS.ink, icon: 'trophy' },
  A2: { fill: COLORS.card, border: COLORS.green, value: COLORS.white, labelInk: COLORS.grey },
  B1: { fill: COLORS.card, border: COLORS.blue, value: COLORS.blue, labelInk: COLORS.grey },
  B2: { fill: COLORS.card, border: COLORS.purple, value: COLORS.purple, labelInk: COLORS.grey },
  C1: { fill: COLORS.orange, border: null, value: COLORS.ink, labelInk: COLORS.ink },
  C2: { fill: COLORS.card, border: COLORS.green, value: COLORS.green, labelInk: COLORS.grey },
  C3: { fill: COLORS.card, border: COLORS.yellow, value: COLORS.yellow, labelInk: COLORS.grey },
};
export const COPY = {
  title1: 'MY TRADING', title2: 'EDGE', brand: 'PnL Lens', founding: 'FOUNDING TRADER',
  footer: 'Read your own P&L, trade by trade.', url: 'pnllens.com', note: 'Analysis of my own trades. Not investment advice.',
  file: { card: 'pnl-lens-edge.png', story: 'pnl-lens-edge-story.png' },
  shareText: 'My trading edge, from PnL Lens',
} as const;

/* ------------------------------------------------------------------ tile catalogue (spec §3) */
export const LABELS: Record<TileKey, string> = {
  streak: 'Biggest achievement', planKept: 'Biggest achievement', level: 'Biggest achievement', winRun: 'Biggest achievement',
  proIn: 'Pro in', bestDay: 'Best day', bestTrade: 'Best trade', bestMonth: 'Best month', greenDays: 'Green days',
  winRate: 'Trades won', tradesRead: 'Trades read', months: 'Months analysed', habits: 'Habits tracked',
};
/** short names for the dialog's chips */
export const CHIP: Record<TileKey, string> = {
  streak: 'Win streak', planKept: '30-day plan kept', level: 'Level reached', winRun: 'Wins in a row', proIn: 'Pro in',
  bestDay: 'Best day', bestTrade: 'Best trade', bestMonth: 'Best month', greenDays: 'Green days', winRate: 'Trades won',
  tradesRead: 'Trades read', months: 'Months analysed', habits: 'Habits tracked',
};
const DEFAULTS: [SlotId, TileKey][] = [['A2', 'proIn'], ['B1', 'bestDay'], ['B2', 'bestTrade'], ['C1', 'bestMonth'], ['C2', 'greenDays'], ['C3', 'tradesRead']];
/** spec pool, then (only when it runs dry on a small report) the achievements not used as the hero */
const POOL: TileKey[] = ['winRate', 'planKept', 'bestTrade', 'months', 'habits', 'tradesRead', 'level', 'streak', 'winRun'];
export const MIN_TILES = 7;
export const BEST_TRADE_CAP = 999;

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MON = MONTH.map((m) => m.slice(0, 3));
const HIGH_LEVELS = ['Steady', 'Disciplined', 'Elite'];
/** strike, expiry or option-type codes: never on a card (e.g. BANKNIFTY2262333000CE, NIFTY24OCT52000PE) */
export const CONTRACT_RE = /\d{2}(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)|\d(CE|PE|C|P)\b|\d{5,}|\s/i;

type Trade = Record<string, any>;
const pct = (x: number) => `${Math.round(x * 100)}%`;
const dayOf = (t: Trade): string | null => (t.exitDate || t.entryDate ? String(t.exitDate || t.entryDate).slice(0, 10) : null);
const validDay = (d: string | null): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);

export function periodLabel(from?: string | null, to?: string | null): string {
  if (!from || !to) return '';
  const f = String(from).slice(0, 10), t = String(to).slice(0, 10);
  const fm = MON[Number(f.slice(5, 7)) - 1], tm = MON[Number(t.slice(5, 7)) - 1];
  if (!fm || !tm) return '';
  if (f.slice(0, 7) === t.slice(0, 7)) return `${tm} ${t.slice(0, 4)}`;
  return f.slice(0, 4) === t.slice(0, 4) ? `${fm}–${tm} ${t.slice(0, 4)}` : `${fm} ${f.slice(0, 4)} – ${tm} ${t.slice(0, 4)}`;
}

/** "#0427 / 1000" */
export const foundingLabel = (n: number) => `#${String(Math.trunc(n)).padStart(4, '0')} / 1000`;

/** "+184%", capped at "+999%" */
export const plusPct = (p: number) => `+${Math.min(BEST_TRADE_CAP, Math.round(p))}%`;

/** An underlying's name is allowed on a card; anything that looks like a contract code is not. */
export const safeUnderlying = (u: unknown): string | null => {
  const s = typeof u === 'string' ? u.trim().toUpperCase() : '';
  return s && s.length <= 20 && /^[A-Z0-9&.-]+$/.test(s) && !CONTRACT_RE.test(s) && /[A-Z]/.test(s) ? s : null;
};

/** Every tile this report can show, keyed; only the ones that pass their strength rule. */
export function eligibleTiles(report: any, opts: Pick<ShareOpts, 'planCheck'> = {}): { tiles: Map<TileKey, Tile>; streakDays: number } {
  const T: Trade[] = (report?.trades || []).filter((t: Trade) => Number.isFinite(t?.pnl));
  const P = report?.progress || null;
  const out = new Map<TileKey, Tile>();
  const put = (key: TileKey, value: string, sub?: string) => out.set(key, { key, label: LABELS[key], value, ...(sub ? { sub } : {}) });

  // trading days in order (needs dates)
  const byDay = new Map<string, number>();
  for (const t of T) { const d = dayOf(t); if (validDay(d)) byDay.set(d, (byDay.get(d) || 0) + t.pnl); }
  const days = [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  let streak = 0, run = 0;
  for (const [, p] of days) { run = p > 0 ? run + 1 : 0; streak = Math.max(streak, run); }
  if (streak >= 3) put('streak', `${streak}-day win streak`);

  const pc = opts.planCheck;
  if (pc && pc.measured > 0 && pc.met >= 3) put('planKept', `${pc.met} of ${pc.measured} rules kept`);

  const lvl = P?.level?.name;
  if (typeof lvl === 'string' && HIGH_LEVELS.includes(lvl)) put('level', `Reached ${lvl}`);

  // wins in a row, in time order (needs dates; trades on the same day keep the statement's order)
  const dated = T.map((t, i) => ({ t, i, d: dayOf(t) })).filter((x) => validDay(x.d));
  if (dated.length === T.length && T.length) {
    dated.sort((a, b) => (a.d! < b.d! ? -1 : a.d! > b.d! ? 1 : a.i - b.i));
    let best = 0, r = 0;
    for (const { t } of dated) { r = t.pnl > 0 ? r + 1 : 0; best = Math.max(best, r); }
    if (best >= 5) put('winRun', `${best} wins in a row`);
  }

  // pro in: an underlying with 15+ trades, 55%+ won, net positive; the highest win rate
  const byU = new Map<string, Trade[]>();
  for (const t of T) { const u = safeUnderlying(t.underlying); if (u) byU.set(u, [...(byU.get(u) || []), t]); }
  const pro = [...byU.entries()]
    .map(([u, xs]) => ({ u, n: xs.length, wr: xs.filter((t) => t.pnl > 0).length / xs.length, pnl: xs.reduce((s, t) => s + t.pnl, 0) }))
    .filter((x) => x.n >= 15 && x.wr >= 0.55 && x.pnl > 0)
    .sort((a, b) => b.wr - a.wr || b.n - a.n || (a.u < b.u ? -1 : 1))[0];
  if (pro) put('proIn', pro.u, `${pct(pro.wr)} win rate`);

  // best weekday (5+ trades that weekday, net positive)
  const byW = new Map<number, { n: number; pnl: number }>();
  for (const t of T) { const d = dayOf(t); if (!validDay(d)) continue; const w = new Date(`${d}T00:00:00Z`).getUTCDay(); const c = byW.get(w) || { n: 0, pnl: 0 }; c.n++; c.pnl += t.pnl; byW.set(w, c); }
  const bw = [...byW.entries()].filter(([, c]) => c.n >= 5 && c.pnl > 0).sort((a, b) => b[1].pnl - a[1].pnl || a[0] - b[0])[0];
  if (bw) put('bestDay', DOW[bw[0]]);

  // best trade by return on what was paid; only trades at least the median size, so a tiny lottery ticket can't top it
  const sized = T.filter((t) => Number.isFinite(t.pct) && Number(t.buy) > 0);
  if (sized.length) {
    const buys = sized.map((t) => Number(t.buy)).sort((a, b) => a - b);
    const med = buys[Math.floor((buys.length - 1) / 2)];
    const top = sized.filter((t) => Number(t.buy) >= med && t.pct >= 1).sort((a, b) => b.pct - a.pct)[0];
    if (top) put('bestTrade', plusPct(top.pct), top.isOpt ? 'return on premium' : 'return on trade');
  }

  // best month (2+ months; net positive); the year when the period spans more than 12 months
  const byM = new Map<string, number>();
  for (const [d, p] of days) byM.set(d.slice(0, 7), (byM.get(d.slice(0, 7)) || 0) + p);
  if (byM.size >= 2) {
    const ms = [...byM.keys()].sort();
    const span = (Number(ms.at(-1)!.slice(0, 4)) - Number(ms[0].slice(0, 4))) * 12 + Number(ms.at(-1)!.slice(5, 7)) - Number(ms[0].slice(5, 7));
    const bm = [...byM.entries()].filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0];
    if (bm) put('bestMonth', `${MONTH[Number(bm[0].slice(5, 7)) - 1]}${span >= 12 ? ` ${bm[0].slice(0, 4)}` : ''}`);
  }

  const c = consistency(T as any);
  if (c && c.days >= 5 && c.greenDays >= 0.5) put('greenDays', pct(c.greenDays));

  if (T.length >= 20) { const wr = T.filter((t) => t.pnl > 0).length / T.length; if (wr >= 0.5) put('winRate', pct(wr)); }
  if (T.length) put('tradesRead', String(T.length));
  if (byM.size >= 1) put('months', String(byM.size));
  const habits = P?.labels && typeof P.labels === 'object' ? Object.keys(P.labels).length : 0;
  if (habits) put('habits', String(habits));
  return { tiles: out, streakDays: streak };
}

/** Hero order: streak ≥ 5 days → plan kept → level → streak 3–4 days → wins in a row → trades read. */
function heroOrder(tiles: Map<TileKey, Tile>, streakDays: number): TileKey[] {
  const o: TileKey[] = [];
  if (tiles.has('streak') && streakDays >= 5) o.push('streak');
  for (const k of ['planKept', 'level'] as TileKey[]) if (tiles.has(k)) o.push(k);
  if (tiles.has('streak') && streakDays < 5) o.push('streak');
  for (const k of ['winRun', 'tradesRead'] as TileKey[]) if (tiles.has(k)) o.push(k);
  return o;
}

/** Fill the 6 other slots: defaults first, then the pool, skipping used and excluded tiles; empty when nothing is left. */
function fill(tiles: Map<TileKey, Tile>, hero: TileKey, exclude: Set<TileKey>): [SlotId, TileKey | null][] {
  const used = new Set<TileKey>([hero]);
  const ok = (k: TileKey) => tiles.has(k) && !used.has(k) && !exclude.has(k);
  return DEFAULTS.map(([slot, def]) => {
    const k = ok(def) ? def : POOL.find(ok) ?? null;
    if (k) used.add(k);
    return [slot, k];
  });
}

/** Rectangles for the tiles shown: rows keep their order; a row with fewer tiles shares its width; fewer rows are centred. */
function place(filled: [SlotId, Tile][]): PlacedTile[] {
  const rowOf = (s: SlotId) => s[0] as 'A' | 'B' | 'C';
  const rows = (['A', 'B', 'C'] as const).map((r) => ({ r, items: filled.filter(([s]) => rowOf(s) === r) })).filter((x) => x.items.length);
  const L = LAYOUT, total = rows.reduce((s, x) => s + L.rows[x.r].h, 0) + L.gap * (rows.length - 1);
  let y = rows.length === 3 ? L.band.top : Math.round(L.band.top + (L.band.bottom - L.band.top - total) / 2);
  const out: PlacedTile[] = [];
  for (const { r, items } of rows) {
    const spec = L.rows[r], full = items.length === spec.slots.length;
    const even = (L.width - L.gap * (items.length - 1)) / items.length;
    let x = L.margin;
    for (const [slot, t] of items) {
      const w = full ? spec.slots.find(([s]) => s === slot)![1] : even;
      out.push({ ...t, slot, x, y, w, h: spec.h });
      x += w + L.gap;
    }
    y += spec.h + L.gap;
  }
  return out;
}

export function shareCard(report: any, opts: ShareOpts = {}): ShareCardData {
  const { tiles, streakDays } = eligibleTiles(report, opts);
  const heroOptions = heroOrder(tiles, streakDays);
  const hero = opts.hero && heroOptions.includes(opts.hero) ? opts.hero : heroOptions[0] ?? 'tradesRead';
  const exclude = new Set((opts.exclude || []).filter((k) => k !== hero));
  const want = Math.min(MIN_TILES, tiles.size);
  // a switched-off tile stays off only while the card still shows min(7, eligible) tiles
  const keep = new Set<TileKey>();
  for (const k of exclude) { keep.add(k); if (fill(tiles, hero, keep).filter(([, x]) => x).length + 1 < want) keep.delete(k); }
  const slots = fill(tiles, hero, keep);
  const shown = new Set<TileKey>([hero, ...slots.map(([, k]) => k).filter((k): k is TileKey => !!k)]);
  const options = [...tiles.keys()].filter((k) => k !== hero);
  const removable = [...shown].filter((k) => k !== hero && fill(tiles, hero, new Set([...keep, k])).filter(([, x]) => x).length + 1 >= want);
  const heroTile = tiles.get(hero) ?? { key: 'tradesRead' as TileKey, label: LABELS.tradesRead, value: '0' };
  const placed = place([['A1', heroTile], ...slots.filter((s): s is [SlotId, TileKey] => !!s[1]).map(([s, k]) => [s, tiles.get(k)!] as [SlotId, Tile])]);
  const fno = Number.isInteger(opts.foundingNo) && opts.foundingNo! >= 1 && opts.foundingNo! <= 1000 ? opts.foundingNo! : null;
  const founding = fno && opts.badge !== false ? foundingLabel(fno) : null;
  const m = report?.m || {};
  const summary = placed.map((t) => `${t.label}: ${t.value}${t.sub ? ` (${t.sub})` : ''}`).join('; ');
  return {
    period: periodLabel(m.from, m.to), hero: placed[0], tiles: placed.slice(1), heroOptions, options, removable, founding,
    count: placed.length, summary,
  };
}
