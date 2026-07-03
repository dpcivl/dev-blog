---
title: "Quant Study 00 — pandas Basics · Trend Following vs Mean Reversion · The 4 Backtest Biases · Fake Alpha"
description: "Starting a quant learning series. pandas Series/DataFrame, loc/iloc, the warm-up period (NaN), silent data corruption from adjusted close prices, trend following (MA, golden/dead cross) vs mean reversion, the 4 backtest biases (look-ahead, overfitting, unrealistic trading costs, survivorship bias), and why you need to look at a distribution instead of a single point to filter out fake alpha (B&H beat rate / median alpha / market exposure / walk-forward)."
pubDatetime: 2026-06-24T01:00:00Z
tags:
  - 퀀트
  - pandas
  - 백테스트
  - 학습
draft: false
featured: false
---

Starting a new series. Studying **quant (quantitative trading)**. This 00 post covers the basic tools and concepts. Before I run any actual backtest code, I want to organize **how pandas handles time-series data** and **the 4 patterns where backtests often lie**.

## Table of contents

## 1. pandas basics — Series and DataFrame

- **Series** = 1-dimensional (a single row/column)
- **DataFrame** = 2-dimensional (a table)

A single line of closing price time series is a Series. An OHLCV table (open, high, low, close, volume) is a DataFrame.

### loc vs iloc — label-based or position-based

| | Basis | Example |
|---|---|---|
| `loc` | **Label** (date, column name) | `df.loc["2026-06-01", "Close"]` |
| `iloc` | **Position** (integer index) | `df.iloc[0, 3]` |

For time series, I usually slice by date using `loc`. For relative access like "the last N days," `iloc` is more convenient.

## 2. pandas looks at the past — the warm-up period (NaN)

A **rolling window operation** like a moving average needs **N past values** to compute. But there's no past data at the very start of a time series.

- 20-day moving average → on day 1, there aren't 20 past values, so it's `NaN`
- This section is the **"warm-up"**

How to handle it:

```python
df["MA20"] = df["Close"].rolling(20).mean()
df = df.dropna()  # NaN 행 제거 → 워밍업 잘라내기
```

`dropna()` is a method that keeps "only non-NaN values." If you don't trim the warm-up, every downstream signal calculation gets contaminated with NaN.

## 3. Silent data corruption — the trap of adjusted close prices

Even if you pull the same ticker for the same period, **the data itself can change the next time you fetch it.** This happens because stock splits, dividends, and rights offerings cause **historical closing prices to be retroactively re-adjusted** (this is the "adjusted close").

The problem is that this **doesn't throw an error**. The numbers just change slightly. So when a backtest that worked fine yesterday suddenly gives different results today, you can spend a long time confused.

How to respond:

- Force a fresh fetch by setting `use_cache=False`
- For tickers that had a split/dividend event, delete the cache file and re-fetch

> A **data bug** is scarier than a code bug. There's no error — the returns just look slightly inflated.

## 4. Strategy classification — trend following vs mean reversion

Even looking at the same price chart, **opposite strategies work depending on market regime.**

### Trend Following

> **"What's going up keeps going up"**

- Representative indicators: **Moving Average (MA)**, **TSMOM** (Time-Series Momentum)
- Signal: **Golden cross** (short-term MA crosses above long-term MA) → buy
- Signal: **Dead cross** (short-term MA crosses below long-term MA) → sell
- Works well in a **trending market**

### Mean Reversion

> **"What's dropped comes back to its place"**

- Representative indicators: **RSI**, **Bollinger Bands**
- Signal: enter in the opposite direction when far from the mean
- Works well in a **sideways market**

### Key point

**You need to switch strategies depending on whether the current market is trending or range-bound.** Running mean reversion in a trending market means constantly catching a falling knife, and running trend following in a sideways market means getting chopped up by frequent stop losses.

## 5. Mismatched warm-up lengths lie to you too

Say Strategy A uses a 20-day MA and Strategy B uses a 200-day MA. If you compare the two over the same period, their warm-ups differ:

- A generates signals starting day 21
- B generates signals starting day 201

**A's first 180 days of trading don't exist at all for B**, so even if you look at the same performance, the starting lines are different. **For a fair comparison, you need to trim both strategies based on whichever has the longer warm-up.**

> Skip aligning the warm-up, and you go **straight to a wrong conclusion.**

## 6. The 4 biases of quant — 4 ways backtests lie

### (1) Look-ahead Bias

The mistake of **making a decision using future data you couldn't have seen at that point in time.**

- Example: Using day t's closing price to make a buy decision on day t (the close isn't confirmed until market close, but you're assuming you knew it during the trading session)
- Example: Backtesting with day t+1's opening price while "pretending" you decided based on day t's close

**The key to preventing this = a time boundary.** Calculate signals only using data up to t-1, and trade on day t.

### (2) Overfitting

Results where you've **fit parameters too well to the past, so they collapse in the future.**

- Example: "MA 17-day + RSI 6 + Bollinger 1.8σ" looked fantastic for 2020–2025 → falls apart in 2026
- A combination that fits the past smoothly is likely **just fit to the data**

**Out-of-sample testing** can filter this out to some degree.

### (3) Unrealistic Trading Costs

**Ignoring fees, taxes, and slippage** makes returns on paper magically look great. Especially for high-frequency strategies, it's common for the profit/loss sign to flip after deducting trading costs.

### (4) Survivorship Bias

**Looking only at surviving stocks means the failed losers are missing.** If you calculate historical returns using today's stock list, **companies that have already been delisted after failing aren't in the dataset.** So you end up only covering successful cases, and returns look more inflated than they actually were.

> **"If a backtest looks too good, be suspicious."** There's a high chance one of the 4 biases is at play.

### Measuring survivorship bias leakage — reviving them yourself

To check how much survivorship bias has crept into your backtest:

```
Leakage = (number of delisted stocks in the universe) - (number of those that actually made it into the size ranking)
```

The bigger this gap, **the more failed losers were excluded from the size list** = the bigger the survivorship bias leakage.

## 7. Look at the distribution, not a single point — filtering out fake alpha

It's risky to judge backtest results from **a single return curve.** Even slightly tweaking parameters or the period for the same strategy can make results swing. So look at **a distribution, not a single point.**

> Not **"Did this strategy beat B&H?"** (a single point), but
> **"When run across various conditions, is the median alpha positive, and is it reasonable relative to market exposure?"** (a distribution)

### The trap of "fake alpha"

**Even a high B&H beat rate can still be fake alpha.** B&H is just a simple buy-and-hold strategy — buy and do nothing. Frequently beating it isn't necessarily good on its own. Two things you need to check alongside it:

- **Median alpha** — the median, not the average. It's common for one or two big wins to pull the average up. **If the median is negative, more than half the trades were losses** → in live trading, the typical trade loses money.
- **Market Exposure** — the **proportion of time you held a position** out of the total period. If a strategy beat B&H while only being exposed to the market 5% of the time, that's an unfair comparison (mostly holding cash means naturally lower volatility). The shorter the exposure time, the smaller the sample, so there's a higher chance **it won by luck.**

> Looking only at the B&H beat rate can look great, but there are surprisingly many cases with **short exposure time and negative median alpha.** "Won often" and "wins consistently" are different things.

### Walk-forward Analysis

The standard method for filtering out overfitting. You **fix a set of parameters chosen once and roll the time series forward**, checking whether it still works in the following period.

```
[ in-sample : 파라미터 최적화 ] → [ out-of-sample : 그 파라미터로 검증 ]
                ↓ (앞으로 밀기)
       [ in-sample ] → [ out-of-sample ]
                ↓
                ...
```

- **Impressive in-sample but collapses out-of-sample** → sign of overfitting
- You need to look at the **distribution of out-of-sample results** to judge whether it's real alpha

Distribution shows up again here. A single good out-of-sample result doesn't make a strategy good — the **median/variance of results across multiple sliding windows** need to be healthy.

## Retrospective — discovering the habit of "benchmarking by feel"

While studying this, I realized I have a tendency to **benchmark by feel** without even noticing. Something like "using cache feels faster, I think..."

In the example, I actually **measured the time and quantified it**:

![Cache read vs network fetch benchmark — cache is about 3x faster](/assets/posts/quant-study-00-pandas/01-cache-vs-network-benchmark.png)

- Network fetch: **0.088 seconds**
- Cache read: **0.034 seconds**
- **Cache is about 3x faster**

Once I had the number "3x" in hand, "cache is the right call" finally became a **judgment**. Before that, it was just an impression. Quant is ultimately a field where you **doubt with numbers and decide with numbers**, so I think I need to fix this habit first.

## Things to study further

### 1. pandas time series tools

- `resample()` — converting daily bars → weekly/monthly bars
- `shift()` — essential for preventing look-ahead bias (`signal = df["Close"].shift(1) > df["MA20"].shift(1)`)
- `min_periods` option in `rolling()` — controlling warm-up
- MultiIndex — ticker × date panel data

### 2. Backtesting frameworks

- **backtrader / vectorbt / zipline / bt** — building it yourself vs using a framework
- Building it yourself is good for learning, but frameworks are safer for preventing the 4 biases
- Walk-forward optimization, anchored / rolling windows

### 3. Tools to prevent the 4 biases

- **Point-in-time (PIT) data** — data exactly as it was known at that point in time (not reflecting later restatements of financial statements)
- **Survivorship-bias-free datasets** — a universe that includes delisted stocks (commercial data like CRSP)
- **Combinatorial Purged CV** (Marcos López de Prado) — preventing leakage in time-series K-fold

### 4. Regime Detection

- Automatically detecting trending / sideways markets → automatic strategy switching
- **ADX**, **Hurst exponent**, **HMM (Hidden Markov Model)**
- "Regime awareness + strategy routing" is more practical than a single strategy

### 5. Trading cost modeling

- Fees (fixed rate) + taxes (capital gains tax, transaction tax) + **slippage** (market impact)
- Slippage is proportional to order size relative to trading volume → can't be ignored once asset scale grows
- If Sharpe drops below 1 after deducting trading costs, hold off on live deployment