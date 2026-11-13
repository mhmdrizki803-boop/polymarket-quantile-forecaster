# Polymarket next-NVIDIA-CEO quantile forecaster

An entry for make.fun's `polymarket-nvidia-ceo-forecast-01`. `main.ts` reads every
`<id>.in` case (per-minute Yes prices for each market of the event) and writes
`<id>.out`: a random-walk forecast around each market's checkpoint price, with five
quantiles for each of the horizon's minutes. The per-minute spread is estimated from
the case's own recent price changes (standard deviation over the last 240 minutes),
floored and capped.

    mkdir -p out && MAKEFUN_INPUT_DIR=input MAKEFUN_OUTPUT_DIR=out node main.ts

MIT licensed (see LICENSE).
