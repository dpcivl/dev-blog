---
title: "FEMS Project #3 — Streamlit Comparison Dashboard + 3-Backend Question Evaluation (Claude 9 / exaone 7 / gpt 7)"
description: "Put a Streamlit dashboard on top of FEMS RAG and threw the same question at 3 backends (exaone3.5:7.8b / claude-opus-4-8 / gpt-4o) simultaneously to compare. Q1 (air compressor anomaly in May) — exaone and gpt said 'no data', while Claude inferred 'weekend-hours anomaly' from summary stats alone without raw data + disclosed its limitations. Q2 (savings measures from a manager's perspective) — Claude 9/10 (incomplete due to token truncation), exaone 7/10 (broken index), gpt 7/10 (concise but hallucinated 'capacitor'). Results of 5-axis scoring."
pubDatetime: 2026-06-26T08:30:00Z
tags:
  - fems
  - rag
  - ollama
  - claude-api
  - llm
  - streamlit
  - exaone
  - 학습
draft: false
featured: false
---

This is part 3, following [FEMS #1 (setup)](/posts/fems-project-log-01) and [#2 (corpus + model comparison)](/posts/fems-project-log-02). Today: **Streamlit dashboard + 3-backend question evaluation**.

## Table of contents

## Session notes — Claude Code installed Streamlit on its own

Today I was going to build the Streamlit dashboard, but **when I started a new Claude Code session, it went ahead and installed streamlit on its own and started writing code**. Checking further, I found that **this project had no `CLAUDE.md`**.

→ **I decided I needed to create standard guidelines.** First I'll build the necessary subagents, then move on to the main task. (I'll write this up separately.)

## 1. Streamlit comparison dashboard

![Streamlit dashboard — data usage pattern graphs (production_line / lighting / air_compressor) + question → 3-backend comparison area](/assets/posts/fems-project-log-03/01-streamlit-dashboard.png)

**Left sidebar** — checkboxes for Ollama (local) / Claude (API) / GPT (API). **Right side** — data track selection (synthetic / real), time range, graph display, and question input.

What's shown in the screenshot is **synthetic data**. Since anomalies were intentionally injected, they can be identified directly from the graph.

> The reason for using synthetic data is the same as [the question raised in #2](/posts/fems-project-log-02#합성-데이터-vs-실-데이터--과적합-의문) — when I need questions based on real data, I have to create them separately. Today I threw both types of questions at the system.

## Q1 — Synthetic data: "Was there a problem with the air compressor in May?"

I confirmed from the graph that `air_compressor` had anomalies throughout May, then asked the same question.

![Q1 — 3-backend comparison: exaone(23.3s, $0)/claude(12.3s, $0.0352)/gpt(1.5s, $0.0056). exaone and gpt responded 'no data available', Claude gave a response](/assets/posts/fems-project-log-03/02-q1-compressor-comparison.png)

| Backend | Model | Latency | Cost | Response |
|---|---|---|---|---|
| Ollama | exaone3.5:7.8b | 23.3s | Local $0 | **"No data available"** |
| Claude | claude-opus-4-8 | 12.3s | $0.0352 | **Detailed reasoning response** |
| GPT | gpt-4o | 1.5s | $0.0056 | **"No data available"** |

### Claude's reasoning — using summary stats only, without raw data

![Claude response — conclusion: 'anomalous signs observed during weekend hours' + supporting analysis (weekday daytime 92/171kW, weekday nighttime 29/46kW, weekend 56/150kW)](/assets/posts/fems-project-log-03/03-q1-claude-reasoning.png)

Even though it wasn't given exact timestamp or date-level logs as data, Claude **compared the averages and maximums in the synthetic data** and inferred that "there was likely an anomaly during weekend hours." The screenshot is cut off, but it also provided **recommendations** based on this.

### Why this difference occurred — design intent

> The original CSV is used only for visualization; **the LLMs are only shown a summary of the CSV.** This is intentional design — the anomaly signal is preserved, but the models are **not allowed to detect it directly.**

The result:

- **exaone / gpt** → conservatively answered "no data available" (a safe choice that avoids hallucination)
- **Claude** → **successfully reasoned** within limited information, and accurately disclosed the limitation that "the exact date and time cannot be determined"

This difference is the most striking part. It clearly shows the difference in model personality when it comes to **"should I fill the gap with inference, or hold back conservatively"** when the data doesn't contain a direct answer.

## Q2 — Real data: "A year of steel mill patterns, savings measures from a manager's perspective"

The second question is based on the **UCI Steel dataset**. Due to token limits, I explicitly asked it to **"summarize only the key points."**

![Q2 — 3-backend comparison: exaone(46.2s, 480tok)/claude(17.2s, $0.0423, 1024tok)/gpt(4.8s, $0.0100, 475tok). Retrieved sources: fems_market_report_sample.pdf, fems_mv_guideline.pdf](/assets/posts/fems-project-log-03/04-q2-refined-3-backend.png)

| Backend | Latency | Cost | Output tokens |
|---|---|---|---|
| exaone3.5:7.8b | 46.2s | $0 | 480 |
| claude-opus-4-8 | 17.2s | $0.0423 | 1024 (max) |
| gpt-4o | 4.8s | $0.0100 | 475 |

### exaone's answer

![exaone answer — recommended action items, data-based answer but broken index (item 4 appears twice)](/assets/posts/fems-project-log-03/05-q2-exaone-answer.png)

The data-based answer with multiple document references was fine, but **the index broke midway, resulting in "two item 4s"**, and the paragraph breaks became awkward. The "energy saving suggestions" section at the top of the screenshot was just generic-level advice — basically "try harder."

### Claude's answer

![Claude answer — savings direction from a manager's perspective (distributing high-load periods, improving power factor, checking baseline load during weekends/downtime) + savings estimation/verification procedure + monitoring/visualization use](/assets/posts/fems-project-log-03/06-q2-claude-management-actions.png)

Claude covered all of the following:

- **Patterns** confirmed from the data
- Savings direction from a **manager's perspective**
- How to measure savings achieved — **estimation and verification procedure**
- **Monitoring and visualization** methods

The quality of the answer was very good. **The sources were properly cited** (`fems_market_report_sample.pdf`, `fems_mv_guideline.pdf`), and **each section was clearly distinguished**.

However — it hit the **output token cap (1024)**, and the last cautionary section was cut off:

![End of Claude's answer — '4. Monitoring and visualization use' is complete, then cut off at the first line of 'Cautions'](/assets/posts/fems-project-log-03/07-q2-claude-truncated.png)

There seemed to be a lot more to explain. If I had raised `max_tokens`, it would have been complete.

### GPT's answer — clean but a hallucination found

![GPT answer — 1. Optimize load management, 2. Improve power factor (e.g., install capacitors), 3. Adjust weekday/weekend usage differences, 4. Monitoring, 5. Improve inefficient equipment. Did not exceed token cap](/assets/posts/fems-project-log-03/08-q2-gpt-with-hallucination.png)

GPT's answer was lean and gave **just the essential action items from a manager's perspective**. It didn't exceed the token limit, and the content was good.

But **there was a catch.**

> **"It cited capacitors as an example of power factor improvement equipment, but that's not in the data I provided."**

This was **fabricated information (a hallucination)** drawn from general knowledge. There was a "don't make things up" instruction in the system prompt, but **it was ignored, and GPT made it up anyway.**

This is another side of the conservative vs. proactive response difference. In Q1, GPT was conservative with "no data available," but in Q2 it **suddenly filled in gaps using general knowledge not present in the data**. The same model showed different tendencies depending on the question format.

## Scoring — 5-axis evaluation

![5-axis scoring — accuracy/hallucination/sourcing/language/usefulness + total score. exaone 7/10, Claude 9/10, gpt-4o 7/10](/assets/posts/fems-project-log-03/09-scoring-result-table.png)

Criteria: ① factual consistency with the steel brief the model was given ② hallucination ③ accurate source attribution ④ Korean language consistency ⑤ how well it distilled key points for management use.

| Axis | exaone | Claude | gpt-4o |
|---|---|---|---|
| Accuracy | 1 — numbers correct but missed key points | **2** — accurately identified load imbalance, low power factor, weekend baseline load | 1 — surface-level, didn't use M&V |
| Hallucination | 2 — nothing fabricated | **2** — everything traceable to sources | 1 — "capacitor" hallucination |
| Sourcing | 1 — vague citation | **2** — accurately attributed M&V and visualization | 1 — missed `mv_guideline` |
| Language | 2 | 2 | 2 |
| Usefulness | 1 — broken index | 1 — incomplete due to 1024 token truncation | **2** — concise, clear structure |
| **Total** | **7/10** | **9/10** | **7/10** |

**Claude performed best.** If the token cap had been raised, it would have been a perfect score.

### Cost-effectiveness perspective

> exaone and gpt can be used at a **lower cost** than Claude → the next task is **figuring out how to tune these models to approach Claude's level.** If I can solve this, it would be very economically advantageous.

Specifically:

- **exaone** — the broken index issue could potentially be fixed by enforcing an output format (JSON / numbered list)
- **gpt** — enforcing "don't make things up" through **few-shot examples** rather than the system prompt might reduce hallucinations

## Retrospective

Three key things learned today:

1. **The fork between inference and caution** — in Q1, when exaone/gpt were conservative with "no data available," Claude inferred from summary stats alone and disclosed its limitations. The difference in model personality is clearly revealed.
2. **The same model's tendency can flip depending on question format** — GPT was conservative in Q1 (inferring from existing facts) but suddenly hallucinated in Q2 (general recommendations). Judging a model based on a single case is risky.
3. **Output token caps significantly affect evaluation** — Claude's one-point deduction (9/10) was due to token truncation. In production, a combination of `max_tokens` + "key points only" prompting + response format constraints is needed.

## Things to study further

### 1. Checking variance by repeating the same question multiple times

- Today's evaluation was one response per question
- Repeat the same question 5-10 times to measure response variance and hallucination frequency
- "Does Claude always score 9/10, or does it average 9/10" is a different question
- Visualizing the effect of non-determinism (sampling temperature)

### 2. Patterns to prevent output token truncation

- Dynamically adjusting `max_tokens` — proportional to question complexity
- Enforcing length via **response format constraints** (JSON / short bullets)
- **2-pass approach** — short summary first, then detailed elaboration
- Detecting token truncation + automatic continuation pattern

### 3. Automating hallucination detection

- An **evaluator that automatically catches** keywords not in the data, like GPT's "capacitor"
- Extracting noun phrases from response text → checking whether they exist in the retrieved chunks
- Fact-checking with LLM-as-judge
- RAGAS's Faithfulness metric

### 4. Low-cost model tuning strategy

- **Refining the system prompt** — explicitly teaching the patterns Claude does well
- **Few-shot examples** — showing exaone/gpt "answer in this format"
- **Enforcing output schema** — JSON Mode / Structured Output
- Comparing before/after tuning scores using the same corpus + evaluation set

### 5. Separating real-data RAG from synthetic-data RAG

- Today's Q1 (synthetic) and Q2 (real data) used the same vector DB
- How would retrieval accuracy / response quality change if separated
- Search routing policy when **operating both tracks simultaneously**
- Preventing leakage where real-data-based questions pull in synthetic-data chunks

### 6. Automating evaluation set construction

- Today's questions were written by hand
- **Corpus chunks → LLM automatically generates questions** → human review
- A larger evaluation set produces more reliable scores
- Directly connected to the evaluation set construction section in [the RAG data preparation post](/posts/rag-data-preparation-end-to-end)