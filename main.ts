// polymarket-nvidia-ceo-forecast-01 entry (Node 22, standard library only).
//
// Reads every <id>.in case in the input directory, estimates each market's own per-square-root-minute
// spread from the minute-to-minute moves inside that case, and writes <id>.out with five quantiles for
// each of the horizon's minutes: a random walk around the checkpoint price, with the case's own spread.
//
// Outside the grader: MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/** The scored levels, in the order each row lists them. */
const Z = [-1.644854, -0.67449, 0, 0.67449, 1.644854];
/** Floors and caps on an estimated spread, in price units per square-root minute. */
const SIGMA_MIN = 0.0012;
const SIGMA_MAX = 0.03;
/** Samples of the case's recent past used for the estimate. */
const WINDOW = 240;

interface Market { id: string; prices: number[] }
interface Case { case?: string; at?: string; horizon_minutes?: number; markets?: Market[] }

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** A per-minute spread: the standard deviation of the case's last WINDOW price changes. */
function spread(prices: number[]): number {
  const n = prices.length;
  const from = Math.max(1, n - WINDOW);
  const d: number[] = [];
  for (let i = from; i < n; i++) d.push(prices[i]! - prices[i - 1]!);
  if (d.length < 2) return SIGMA_MIN;
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  const v = d.reduce((a, b) => a + (b - mean) * (b - mean), 0) / (d.length - 1);
  return clamp(Math.sqrt(v), SIGMA_MIN, SIGMA_MAX);
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const files = readdirSync(INPUT_DIR).filter((f) => f.endsWith('.in'));

for (const file of files) {
  const id = file.slice(0, -3);
  let c: Case;
  try {
    c = JSON.parse(readFileSync(join(INPUT_DIR, file), 'utf8')) as Case;
  } catch {
    continue;
  }
  const horizon = Math.max(1, c.horizon_minutes ?? 240);
  const forecasts: Array<{ id: string; q: number[][] }> = [];
  for (const m of c.markets ?? []) {
    const prices = m.prices ?? [];
    const last = prices.length > 0 ? prices[prices.length - 1]! : 0.5;
    const sigma = spread(prices);
    const q: number[][] = [];
    for (let h = 1; h <= horizon; h++) {
      const scale = sigma * Math.sqrt(h);
      const row = Z.map((z) => Number(clamp(last + z * scale, 0, 1).toFixed(6)));
      // keep the five quantiles non-decreasing after rounding and clamping
      for (let k = 1; k < row.length; k++) if (row[k]! < row[k - 1]!) row[k] = row[k - 1]!;
      q.push(row);
    }
    forecasts.push({ id: m.id, q });
  }
  writeFileSync(join(OUTPUT_DIR, `${id}.out`), JSON.stringify({ forecasts }));
}
