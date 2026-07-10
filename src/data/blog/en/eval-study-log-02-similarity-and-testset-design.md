---
title: "Eval Study #2 — The Pitfalls of Similarity-Based Evaluation, 5 Principles of Test Set Design, and a Misunderstanding About the Term 'Regression Test'"
description: "My second session studying Eval. I ran similarity-based evaluation (embedding cosine similarity) myself and got an unexpected result — both OpenAI's text-embedding-3-small and bge-m3 gave the highest score to the 'wrong answer.' This is because similarity captures topical/expressive closeness, not content correctness. Just a difference in markdown formatting can swing similarity scores significantly. In practice, combining similarity with LLM-as-Judge is the standard approach. Also covers 5 principles of test set design, plus a terminology correction: it's not a 'regression test,' it's improvement validation (A/B)."
pubDatetime: 2026-07-02T13:30:00Z
tags:
  - LLM공부
  - eval
  - llm
  - rag
  - 임베딩
  - 테스트셋
  - 학습
draft: false
featured: false
---

Following [Eval Study #1 (Accuracy + LLM-as-Judge)](/en/posts/eval-study-log-01-accuracy-and-llm-as-judge), today's topic is **similarity-based evaluation + test set design principles**.

## Table of contents

## Where the Three Evaluation Methods Fit

Let me lay out the two axes I organized earlier, plus a new one:

| Method | When to use it |
|---|---|
| **Accuracy-based** | When the correct answer is **clear** (tool selection, classification) |
| **LLM-as-Judge** | For **subjective** evaluation where there's no single fixed answer |
| **Similarity-based** | When there's a correct answer, but it can be **expressed in various ways** |

Today I'm covering the third one — **comparing an expected answer to the actual output using embedding similarity**.

## Starting the Experiment — and a Sense for Choosing Embedding Models

While typing out the example code, I noticed it used `text-embedding-3-small` as the embedding model. This reminded me of **[the issue I ran into in a previous RAG post](/en/posts/rag-from-scratch-embedding-and-similarity-search#3-semantic-search--korean-turns-out-surprisingly-low)** — this model does well picking top-K results for English, but for **Korean, the absolute similarity values are low and it has poor discriminative power**.

Once you've accumulated experience like this, you start noticing what needs to change before blindly copying code. I think this is exactly why, even as more code gets written with AI assistance these days, the value of a senior developer actually goes up — **the sense of knowing which parts to adjust for your specific situation when the AI spits out a probabilistically plausible answer** becomes more important. Rather than vaguely thinking "I should study more," this is the first concrete direction I've spotted here.

### But First — Quantify Before Swapping

Instead of going with **"I feel like this one was worse"**, I first check **numerically how the two models actually differ**. This is the same principle I learned first while studying Eval.

## Comparing Two Embedding Models — An Unexpected Finding

I embedded the same question-answer pairs using `text-embedding-3-small` (OpenAI) vs `bge-m3` (Ollama) and computed similarity.

![OpenAI vs BGE-M3 similarity comparison table — same-meaning pass case 0.4911 / 0.5599, wrong-answer fail case 0.5597 / 0.8182, same-meaning pass case 0.2125 / 0.5286](/assets/posts/eval-study-log-02-similarity-and-testset-design/01-openai-vs-bge-m3-similarity.png)

**Both models gave the highest score to the "wrong answer."** OpenAI 0.5597 / BGE-M3 0.8182. The **correct answer with the same meaning** actually scored lower (0.4911 / 0.5599).

### The Fundamental Limitation of Similarity-Based Evaluation

Digging into why makes it clear:

> **Similarity captures "topical and expressive closeness," not "the content of the answer."**

For the same question, an answer that's "**wrong but packed with vocabulary related to the topic**" can score higher than an answer that's "**correct but phrased differently in a condensed way**." That's because embeddings measure distance in a semantic space of vocabulary and structure — not logical truth or falsehood.

### Reproducibility + Isolation Experiments

To check whether this result was a fluke, I ran a few more cases:

![Reproducibility/isolation test — self-comparison 1.0/1.0, completely unrelated 0.0862/0.2724, reproduction (wrong answer) 0.5597/0.8182, isolation (wrong content + no word overlap) 0.1753/0.5102, isolation (correct content + word overlap) 0.8182/0.9557](/assets/posts/eval-study-log-02-similarity-and-testset-design/02-reproducibility-and-separation-test.png)

Observations:
- **Self-comparison**: 1.0 (as expected)
- **Completely unrelated**: 0.086 / 0.272 (expected: low ✅)
- **Reproduction (the earlier wrong answer)**: 0.560 / 0.818 (reproduced)
- **Isolation (wrong content + no word overlap)**: 0.175 / 0.510 (low ✅ correctly caught)
- **Isolation (correct content + word overlap)**: 0.818 / 0.956 (high ✅ correctly caught)

**Whether the words themselves overlap overwhelmingly determines the similarity score.** This makes it clear why "wrong but stuffed with related vocabulary" got a high score earlier.

### Can't Judge Which Model Is Better From This Data Alone

OpenAI's score range is wider (0.09 ~ 0.82), which makes it look more discriminative, but **bge-m3 simply has a higher baseline (0.27 ~ 0.96), so its scores as a whole sit higher up**. Which one is actually better can't be determined from this table alone — a proper evaluation would need a separate benchmark.

## A Real Example — All 4 Fail (But the Real Problem Is Formatting)

Going back to the example, I evaluated answers to 4 questions using similarity-based scoring:

![Evaluation results — 4 questions related to Prompt Caching / MCP, similarity 0.44 / 0.60 / 0.72, etc. Pass rate 0/4 = 0.0%, average similarity 0.5937. Markdown headings and bold reduce similarity](/assets/posts/eval-study-log-02-similarity-and-testset-design/03-evaluation-failed-format-mismatch.png)

I thought a **pass rate of 0/4** meant disaster, but looking closer:

- The **threshold** just wasn't met — in practice, **the top-ranked answers were all pointing in the right direction**
- The LLM's response included **markdown headings, bold text, and line breaks**, which shifted the embedding vector's direction away from the reference answer
- In other words, **even when the content is correct, differences in formatting alone can drag similarity down**

### So the Practical Standard — Combining Similarity + LLM-as-Judge

If you use similarity alone:
- Correct answers get failed just because of formatting differences
- Wrong answers padded with related vocabulary get passed

→ **Combining similarity with LLM-as-Judge is the practical standard**. Similarity does the first-pass filtering, and the LLM makes the final call on content logic.

## Test Set Design — 5 Principles

No matter how well-designed the Eval is, **if the test set itself is biased**, it's all pointless. Here are 5 principles:

### 1. Reflect the Actual Usage Distribution

Assemble a diverse set of questions that resemble what would actually come up in the real usage environment. If **you only accumulate artificial cases made for development convenience**, you can't predict production performance.

### 2. Include Edge Cases

Normal cases alone aren't enough. Be sure to include:
- Requests for data that doesn't exist
- Ambiguous questions
- Out-of-scope questions
- Prompt injection attempts

### 3. Stratify by Difficulty

Manage cases by splitting them into **Easy / Medium / Hard**. Looking at scores by tier makes it clear where improvement is needed — a breakdown like "easy 100%, medium 60%, hard 20%" clearly tells you where to dig in.

### 4. Start Small

Don't try to build something perfect with 10,000 cases from the start. **First secure a scale you can actually test with**, then **add cases each time you discover one that fails**. That's what makes a living evaluation set.

### 5. Make the Correctness Criteria Explicit

- **Which tool must be used**
- **Which words must be included**
- **Which words must not be included**

Document these explicitly. A vague standard like "this is roughly correct" will make the evaluator's judgment waver every time.

## Terminology Correction — It Wasn't a "Regression Test"

Afterward, I worked through an example comparing **V1, which had a sloppily written description**, and **V2, which had a clearly written one**. At first I called this a **"regression test"** — but the regression test concept I knew was different, so something felt off and I asked again.

![LLM's answer — what was done in regression_eval.py was an A/B comparison of V1(70%) vs V2(90%). Strictly speaking, this isn't a regression test but an A/B comparison, or **improvement validation**](/assets/posts/eval-study-log-02-similarity-and-testset-design/04-regression-test-terminology.webp)

**The answer:**

> **Regression Test** — when existing code is modified, checks whether **performance has gotten worse than before the change**
>
> **Improvement Validation / A/B Comparison** — measures two versions against the same test set to determine **which one is better**

What I understood a regression test to be was correct, and the example code had simply mislabeled it. **Mixing up even a single term like this can lead to communication errors in real-world operations.**

### V1 vs V2 Results

![V1 vs V2 comparison — V1 overall 10/10 100%, V2 also 10/10 100%. All of easy/medium/hard at 100%. Improvement margin +0.0%p. Saved to regression_results.json](/assets/posts/eval-study-log-02-similarity-and-testset-design/05-v1-vs-v2-comparison.png)

In this particular example, **tool selection accuracy was 100% / 100% regardless of whether the description was sloppy or clear**. The example itself was too easy. This isn't enough data to confirm the principle that, in practice, **a more specific description makes the system stronger on harder problems**.

Still, I got a hands-on feel for how the **"measure → improve → re-measure"** cycle actually runs.

## Reflection

Three things I took away from today's study:

1. **The pitfall of similarity-based evaluation** — it captures closeness in vocabulary and expression, not content. I actually observed a pass rate of 0/4 caused by nothing more than markdown formatting. **In practice, combining similarity with LLM-as-Judge is the answer.**
2. **5 principles of test set design** — usage distribution / edge cases / difficulty tiers / starting small / explicit correctness criteria. A **living evaluation set** is the key.
3. **The importance of verifying terminology** — the more common a term like "regression test" is, the more it needs to be verified when you're copying example code. If I had just glossed over this, it would have led to communication errors on a team later.

## What to Study Further

### 1. Embedding Model Benchmarking — Quantitative Comparison

- Today I only got a rough feel from 5–7 cases. A proper benchmark would use datasets like **KLUE-STS** or **MTEB (Massive Text Embedding Benchmark)**
- Compare OpenAI `text-embedding-3-small/large` vs `bge-m3` vs `KoSimCSE` vs `multilingual-e5` on real-world Korean tasks
- A method for normalizing the **baseline similarity** before comparison (z-score normalization)

### 2. A Combined Similarity + LLM-as-Judge Pipeline

- Determining the threshold for the first-pass similarity filter (too lenient lets wrong answers through / too strict fails correct answers over format differences)
- Whether it's useful to pass **the similarity score itself as context** to the second-pass LLM-as-Judge
- How tools like RAGAS / DeepEval implement this combination

### 3. Format Normalization

- Converting markdown to plain text before embedding
- Stripping out bold/line break/heading syntax
- Measuring how much this stabilizes similarity scores in practice

### 4. An Edge Case Catalog

- "Requesting data that doesn't exist" — does the LLM hallucinate an answer, or respond with "no data available"?
- "Prompt injection" — attempts to disable the system prompt
- "Mixed languages" — does it answer only in English to a Korean question?
- Cataloging edge cases that come up frequently by domain

### 5. Applying Real Eval to a RAG System

- Layering today's combined similarity + LLM-as-Judge pipeline onto the [FEMS RAG](/en/posts/fems-project-log-03) I built recently
- Measuring retrieval (Hit Rate @ K, MRR) and generation (Faithfulness, Answer Relevance) separately
- Actually running the **measure → improve (chunking / embedding / prompt) → re-measure** cycle

### 6. Understanding Backend / WAS

- For an Eval system to be part of CI, it eventually needs to run as a server
- Getting a feel for building a WAS with Django / FastAPI / Node
- Ways to view Eval results on a dashboard (Grafana / custom UI)
- The picture of server-side work being layered on top of the systems sense I built up during my embedded days