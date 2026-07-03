---
title: "The Full Flow of RAG Data Preparation — Selection, Cleansing, Chunking, Metadata, and Evaluation Sets"
description: "While working on the FEMS project, I got curious about 'what and how should go into a vector DB.' Key insight — data should be selected backward from 'questions that need to be retrieved,' not from the 'domain' criterion. Also covers cleansing / the effect of metadata (document title, section path) before chunks / OCR preprocessing for analog data / building an evaluation set — the full flow of the RAG data pipeline."
pubDatetime: 2026-06-26T01:30:00Z
tags:
  - rag
  - llm
  - 데이터전처리
  - 청킹
  - ocr
  - 학습
draft: false
featured: false
---

While running RAG on a 230-page corpus in [FEMS Project #2](/en/posts/fems-project-log-02), a few questions came up.

- **How do you select and clean the data that goes into a vector DB?**
- **If you're using scanned analog data, does attaching a file title actually matter?**

I looked into it and organized the findings into the full flow of a RAG data pipeline.

## Table of contents

## Garbage in, garbage out — LLMs are no exception

In a RAG pipeline, **data preparation is said to be the most important and most labor-intensive step**. The pattern is that **the quality of the data ultimately determines the outcome**, more so than choosing the model, embedding model, or vector DB.

At my previous company, I once **built a fire detection model by transfer-learning efficient-det**. The dataset had been augmented the wrong way, though, and ended up with a lot of **duplicate photos**. The result:

- **Validation score was high** — in effect, the model had just memorized near-identical photos
- **Test score was near zero** — it didn't generalize to new photos at all

This lesson was burned into me back in my computer vision days, but **it applies just as much to LLMs and RAG**. No matter which model you use, if the data is a mess, the answers will be a mess too.

## 1. Data selection — work backward from "questions that need to be retrieved"

At first, I simply thought, **"I'll just put in all the domain-related data."** That turned out to be wrong.

> **Key point: select data backward, starting from "questions that need to be retrieved."**

Assume the actual service is live, and imagine in advance **what form it will be served in and what kinds of questions will come in**. That naturally reveals "what data is needed to answer this question."

If you dump in everything based on domain alone, noise increases and search results get blurrier. **Questions come first, data comes second.**

### Criteria to check when selecting

| Criterion | Check point |
|---|---|
| **Accuracy / reliability** | Is it the latest version? Is it an officially approved document? |
| **Duplication** | If the same content is scattered across multiple documents, retrieval will surface only similar chunks |
| **Density** | Cover pages, tables of contents, and empty forms with almost no information become noise |
| **Timeliness** | Information that changes over time → set an update cycle |

> The `readable_ratio` quality gate I built in [FEMS #2](/en/posts/fems-project-log-02) corresponds to the automated part of the **"density"** criterion in the table above.

## 2. Cleansing — automation + human review

Data cleaning splits broadly into two:

- **Cleansing** — cleaning up the text itself
- **Chunking** — cutting into semantic units, with some overlap

### Is cleansing all done manually?

**No.** Most of it is automated with tools/code, and **humans act as reviewers**.

Handled automatically:

- **Repeated phrases** — page numbers, headers/footers, watermarks like "Confidential"
- **Broken special characters, incorrect line breaks** — via regex / simple rules

Can be handled with tools:

- **PyMuPDF** — PDF parsing
- **LangChain / LlamaIndex** — abstracts the cleansing step
- **The LLM itself** — calls like "clean up this text." Expensive, but accurate

### Parts that require a human

- **Defining which patterns count as noise** — this varies by domain
- **Filling in metadata** (next section)
- **Reviewing samples of the automated cleansing output**

Automation is the core, but **sample checking must still be done by a human**.

## 3. Metadata — prefixing chunks with document title and section path

**A file title is also a kind of metadata.** The role of metadata:

1. **Retrieval filtering** — conditions like "only this department's documents" or "only this year"
2. **Restoring the chunk's context** — with a bare chunk alone, it's hard for the LLM to figure out "where this content was originally attached to"

> Key trick: **prefixing chunks with a document title or section path noticeably improves both embedding quality and retrieval accuracy.**

Example:

```
Original chunk:
  "The baseline period is set as a certain period before ECM implementation..."

With prefix applied:
  "[fems_mv_guideline.pdf > 3. M&V Procedure > 3.1 Setting the Baseline Period]
   The baseline period is set as a certain period before ECM implementation..."
```

Only the prefix differs; the body text is identical. But **the embedding vector ends up carrying richer meaning.** Even if a keyword like "M&V" doesn't appear in the chunk body, it still matches if it's in the prefix.

→ Applying this to the corpus I built in FEMS #2 would probably raise retrieval quality further.

## 4. Handling analog data — OCR + preprocessing + review

You may sometimes need to feed scanned paper documents into RAG:

### Basic flow

```
Scanned image → (image preprocessing) → OCR → (text review) → assign metadata → chunking
```

### Points to watch at each step

1. **If scan quality is poor, OCR errors carry straight through to service quality** — that's why some cases need **image preprocessing** (rotation correction / contrast / noise removal) before OCR
2. **Reviewing OCR output is essential** — this is a limit of automation
3. **The metadata assignment step is mandatory** — scanned files usually have titles that are just dates (e.g. `scan_20240612.pdf`), which by themselves have zero retrieval value

### Automatically detecting recognition quality

Checking every single item is inefficient, so I do **a first-pass filter with automatic detection**, then manually review only the suspect pages.

| Automatic detection method | Description |
|---|---|
| **Detecting replacement characters (`�`, `□`)** | Traces of OCR failure — the most basic check |
| **Detecting split Korean jamo** | Cases where "한국어" gets split into something like "ㅎㅏㄴㄱㅜㄱㅓ" |
| **Dictionary match rate** | Match extracted text against a Korean dictionary. A low rate suggests OCR failure |
| **OCR engine confidence** | Engines like Tesseract provide per-word/per-character confidence scores |

Among the auto-detected results, **suspect pages get a full review**, while the rest are checked via **random sampling** to estimate overall quality.

## 5. Data quality management — it's not a one-and-done task

Data preparation runs as **a loop**. It's not just indexing once and being done:

### Building an evaluation set

> **Build a set of question-answer pairs.** This lets you **immediately measure retrieval accuracy** whenever you change the chunking strategy or embedding model.

Without this, you're left guessing at "did changing the embedding model make the answers better or worse?" With an evaluation set, you can **compare with numbers instead**. This is the same idea I picked up from the [retrospective in the quant post](/en/posts/quant-study-00-pandas#회고--느낌으로-벤치마킹-하는-습관을-발견) — the shift from "gut-feel benchmarking" to "numerical benchmarking."

### Other ongoing management items

- **Monitoring retrieval results** — periodically checking real usage logs
- **Update / version management** — a policy for how to replace existing embeddings when documents change
- **Regular checks for duplication / noise** — these accumulate again over time

## Summary of the overall flow

The steps covered above, in one line:

> **Selection → Cleansing → Chunking → Metadata assignment → Embedding → Evaluation set → (improvement loop)**

This isn't a one-time task — it's an operation of **repeated improvement based on the evaluation set**.

## Retrospective

The two most striking realizations:

1. **Selecting backward from "questions that need to be retrieved"** — gathering everything by domain ≠ good RAG. Questions come first.
2. **Prefixing chunks with document title and section path** — a trick where adding one line of code meaningfully raises retrieval quality.

I'm curious how the results would change if I applied the prefix pattern and built an evaluation set for the FEMS #2 corpus too.

## Further study

### 1. Quantitatively measuring the effect of chunk prefixes

- Run an A/B test with **prefix vs. no prefix** on the same corpus / question set / embedding model
- Changes in top-1 match distance / top-3 hit rate
- What depth of section path is optimal to include (title only / title + section / full path)

### 2. Evaluation set construction methodology

- **Manual vs. LLM-generated** — if an LLM auto-generates the questions, the set itself may end up biased
- Who determines **ground truth**, and how
- Comparing RAG evaluation frameworks like **RAGAS** / **TruLens** / **DeepEval**
- Separating retrieval accuracy (Hit Rate, MRR, NDCG) from response quality (Faithfulness, Answer Relevance)

### 3. Deepening chunking strategy

- **Fixed-size / Recursive / Semantic / Sentence-window** — which is optimal per domain
- The right **overlap** ratio (0 / 10% / 20%)
- **Hierarchical retrieval** — two-stage retrieval with small chunks and large chunks
- Split points that work especially well for Korean (particle / ending boundaries)

### 4. OCR pipeline

- Comparing Korean-language performance of **Tesseract** vs. **PaddleOCR** vs. **EasyOCR** vs. **cloud OCR (Naver CLOVA / Google Document AI)**
- **Layout analysis** — handling tables / figures / multi-column text
- **Image preprocessing** — the effects of deskewing / binarizing / denoising
- The workaround pattern of converting scanned PDF → text PDF, then processing with pypdf

### 5. Metadata usage patterns

- **Self-Query Retrieval** — an LLM automatically extracting metadata filters from a question (e.g., "only 2024 data" → year=2024)
- **Hybrid Search** — vector + metadata filter + keyword BM25
- Metadata schema design — too much becomes a burden to fill in, too little means you can't apply filters

### 6. Data version management

- How to handle existing embeddings when a document is updated from v1 to v2
- Chunk-level diffing → re-embedding only the changed chunks
- Consistency of RAG answers across points in time (important in the legal domain)
- Data version management tools like DVC / LakeFS