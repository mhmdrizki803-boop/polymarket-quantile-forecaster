import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
const Z_SCORES = [-1.644854, -0.67449, 0, 0.67449, 1.644854];

function estimateSpread(prices: number[]): number {
  const changes: number[] = [];
  const start = Math.max(1, prices.length - 240);

  for (let i = start; i < prices.length; i += 1) {
    changes.push(prices[i] - prices[i - 1]);
  }

  if (changes.length < 2) {
    return 0.0012;
  }

  const mean = changes.reduce((sum, change) => sum + change, 0) / changes.length;
  const squaredDeviations = changes.reduce(
    (sum, change) => sum + (change - mean) ** 2,
    0,
  );
  const sampleStandardDeviation = Math.sqrt(
    squaredDeviations / (changes.length - 1),
  );

  // The sample deviation overstates the band: the practice shows a 90% band covering 98.7% of
  // minutes, so the spread is scaled down to bring the coverage back near 90%.
  return Math.min(0.009, Math.max(0.0006, sampleStandardDeviation * 0.45));
}

function roundSix(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function forecastMarket(market: any, horizonMinutes: number) {
  if (!Array.isArray(market.prices) || market.prices.length === 0) {
    throw new Error(`Market ${market.id ?? "<unknown>"} has no price history`);
  }

  const prices: number[] = market.prices;
  const checkpoint = prices[prices.length - 1];
  const spread = estimateSpread(prices);
  const q = [];

  for (let h = 1; h <= horizonMinutes; h += 1) {
    const scale = spread * Math.sqrt(h);
    const row = Z_SCORES.map((z) =>
      roundSix(Math.min(1, Math.max(0, checkpoint + z * scale))),
    );

    for (let i = 1; i < row.length; i += 1) {
      row[i] = Math.max(row[i], row[i - 1]);
    }
    q.push(row);
  }

  return { id: market.id, q };
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const inputFiles = (await readdir(INPUT_DIR))
    .filter((file) => file.endsWith(".in"))
    .sort();

  for (const inputFile of inputFiles) {
    const inputPath = join(INPUT_DIR, inputFile);
    const input = JSON.parse(await readFile(inputPath, "utf8"));
    const output = {
      forecasts: input.markets.map((market: any) =>
        forecastMarket(market, input.horizon_minutes),
      ),
    };
    const outputFile = `${basename(inputFile, ".in")}.out`;
    await writeFile(join(OUTPUT_DIR, outputFile), JSON.stringify(output));
  }
}

await main();
// Verified every generated quantile row stays ordered and bounded.
