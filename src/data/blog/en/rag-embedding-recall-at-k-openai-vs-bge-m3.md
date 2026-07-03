---
title: "RAG Embedding Comparison — Measuring recall@k on My Blog Data (OpenAI vs bge-m3)"
description: "After establishing the [\"feeling-based benchmarking → numeric benchmarking\" principle](/en/posts/quant-study-00-pandas) in my quant retrospective, I actually quantified an embedding model comparison this time. I indexed 441 chunks from my blog posts with OpenAI text-embedding-3-small and bge-m3 respectively, then measured recall@3 with a test set of 20 question-answer source pairs. Overall: OpenAI 80% vs bge-m3 90%. bge-m3 hit 100% on hard-difficulty questions — the decisive factor was connecting to the source text by meaning even when words didn't overlap. On easy questions, the misses turned out to be caused by typos (cladue, underscores) — a twist showing the grading criteria itself was wrong."
pubDatetime: 2026-07-03T05:00:00Z
tags:
  - rag
  - 임베딩
  - openai
  - bge-m3
  - eval
  - recall
  - 학습
draft: false
featured: false
---

Building on my earlier [RAG built from my blog data](/en/posts/rag-system-chroma-blog-qa), I tried something new this time: **building a retrieval evaluation test set and comparing embedding model performance**. The experiment: index the same blog data separately with **OpenAI `text-embedding-3-small`** and **bge-m3**, then search with the same question set and compare the rankings.

## Table of contents

## Why rank comparison (recall@k)

**recall@k** — a metric that checks whether the correct answer was found within the top k results.

- If the correct answer landed in the top 3 for 17 out of 20 questions → **recall@3 = 85%**

Comparing absolute values is difficult because each model has a different **baseline** for similarity scores ([a problem I ran into in Eval #2](/en/posts/eval-study-log-02-similarity-and-testset-design#두-모델-우열은-지금-데이터로-판단-불가) — bge-m3's zero point is inherently higher). recall@k only looks at **whether the correct answer made it into the top ranks**, which makes a fair comparison possible.

## In RAG, recall matters more than precision

Why **recall matters far more** than precision in RAG retrieval:

- **If recall is low, you miss the correct chunk** → the LLM answers without grounding (or responds with "not found in the material")
- Ideally top-3 would contain **only the correct answer**, but even if it's mixed with **the correct answer plus 2 irrelevant chunks**, the LLM can still see the correct chunk and answer properly
- In other words, the goal isn't to have **only** correct answers in the top ranks — it's to **include** the correct answer

## Preparing the test set — similar to labeling

Building a test set = organizing questions plus the conditions that a correct answer should satisfy. Grading criteria:

- The **expressions** that should appear in the answer to the question
- The **tools** that should be used
- The **sources** that should be used

Defining these in advance is essentially a **labeling task**.

### Source-based vs chunk-based grading

| Method | Grading unit | Characteristics |
|---|---|---|
| **Source-based** | Which article it's in | Flexibly accepts correct answers split across multiple chunks |
| **Chunk-based** | Which specific chunk | More precise, but harder to manage when there are multiple correct chunks |

This time I went with **source-based** grading — scored by the correct source document (slug).

## Execution — 441 chunks, 20 questions

Indexing:
- **OpenAI `text-embedding-3-small`**
- **bge-m3** (Ollama)

Since this is based on my own blog posts, **I built the test set myself**. Minimum fields:

```python
{
  "question": "Prompt Caching 은 어떻게 동작?",
  "answer_source": "claude-api-prompt-caching",
  "level": "easy"  # AI 툴로 분류 — 내가 판단하기 애매
}
```

I used an AI tool for the **level** field since it was hard for me to judge myself. The result was 13 easy questions / 7 hard questions.

## Results — bge-m3 90%, OpenAI 80%

![recall@3 results — Overall OpenAI 16/20 = 80%, BGE-M3 18/20 = 90%. easy: both 11/13 = 85%. hard: OpenAI 5/7 = 71%, BGE-M3 7/7 = 100%](/assets/posts/rag-embedding-recall-at-k-openai-vs-bge-m3/01-recall-at-3-result.png)

| | Easy (13 questions) | Hard (7 questions) | Overall (20 questions) |
|---|---|---|---|
| **OpenAI** | 11/13 (85%) | **5/7 (71%)** | 16/20 (80%) |
| **bge-m3** | 11/13 (85%) | **7/7 (100%)** | 18/20 (90%) |

**Tied on Easy, bge-m3 dominates on Hard.**

## Why the gap on Hard — the ability to connect by meaning

The characteristic of the Hard questions: **the wording doesn't overlap with the source text.** For example:

- Question: "How should I set the retry interval when requests keep failing?"
- Source text: the **exponential backoff** section of [Claude API Error Handling and Retry](/en/posts/claude-api-error-handling-and-retry)

The word `exponential backoff` **doesn't appear** in the question. Yet bge-m3 connected the meaning of "retry with progressively increasing intervals" to exponential backoff in the source text. OpenAI couldn't catch this.

## Why the misses on Easy — typos were the cause

Even in the tied Easy category, both models missed the same 2 questions. Digging into the cause:

- **A `-` typo'd as `_`** (e.g., searching `prompt-caching` as `prompt_caching`)
- **`claude` typo'd as `cladue`**

Since the search used wording that didn't exist in the documents, **it makes sense that neither model could find it** — in reality, the grading criteria itself was flawed.

> **If a supposedly easy question is missed for no clear reason, you should also consider whether the test set itself is at fault.**

This time, both models missed the same 2 easy cases for this reason, so it turned into "test set typo → both models unfairly penalized." If you correct the typos and re-measure, both models would hit 100% on easy, and the overall scores would become OpenAI 90% / bge-m3 100%.

## Retrospective

Three things I took away from today:

1. **recall@k is a fair comparison tool across models** — it judges by whether the answer entered the top ranks, not by absolute similarity values. This sidesteps bge-m3's baseline-offset problem.
2. **In RAG, recall > precision** — missing the correct answer is far worse than having irrelevant chunks mixed in.
3. **The quality of the test set itself is also something to verify** — if both models miss the same thing, you should first suspect the grading criteria.

This experiment also ended up providing after-the-fact justification for [the decision to adopt bge-m3 in FEMS #2](/en/posts/fems-project-log-02#임베딩-모델-선정--ollama-의-bge-m3). Back then I adopted it "because it's specialized for Korean" — this time, I confirmed it with actual recall numbers.

## Things to study further

### 1. Chunk-based grading

- Today's evaluation was source (document) based. Moving to chunk-based grading would increase precision
- How to manage cases where there are multiple correct chunks (labeling chunk IDs in a golden set)
- The problem that labels become invalid when chunk size changes

### 2. Hybrid Search (from a typo-prevention perspective)

- The typo cases I found today couldn't be caught by pure vector search
- A **BM25 + vector** combination could catch these via string similarity
- Combining the two results with **Reciprocal Rank Fusion**

### 3. Reranking

- Retrieve a wider top-K (e.g., K=20), then rerank with a cross-encoder
- An approach that maintains recall while improving precision in the top ranks
- Test whether today's results improve using the `bge-reranker` series

### 4. Expanding the embedding model catalog

- **KoSimCSE / KoSBERT** — standard Korean sentence embeddings
- **multilingual-e5-large** — multilingual
- **Voyage AI multilingual** — commercial
- Rank 5 models against the same test set

### 5. Separately evaluating RAG response quality (retrieval → generation)

- Today I only looked at retrieval (Hit Rate / Recall)
- Next up: answer quality — **Faithfulness** (whether it hallucinates), **Answer Relevance** (whether it addresses the question)
- Automating this with the [RAGAS framework](/en/posts/eval-study-log-02-similarity-and-testset-design)

### 6. Evaluating agent systems

- Tool selection accuracy (did the agent pick the right tool among several)
- Multi-step success rate (calling multiple tools in the correct sequence)
- Verifying that [HITL safeguards](/en/posts/langgraph-study-log-03-human-in-the-loop) actually work in practice