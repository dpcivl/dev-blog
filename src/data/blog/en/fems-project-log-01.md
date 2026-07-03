---
title: "FEMS Project #1 — Comparing Low-Spec Local Setup (Ollama + bge-m3 + Chroma) vs Claude API RAG"
description: "Building a RAG prototype while studying the FEMS (Factory Energy Management System) domain. Comparing local LLM inference (Ollama) on a low-spec environment (GTX1660 Super, 6GB VRAM) against calling the Claude / OpenAI APIs. Using bge-m3 for embeddings (strong Korean support) and Chroma as the vector DB. Ollama's cold start of 95 seconds dropped to 10 seconds after warm-up, with accuracy matching the cloud."
pubDatetime: 2026-06-24T16:00:00Z
tags:
  - fems
  - rag
  - ollama
  - llm
  - claude-api
  - 벡터db
  - 학습
draft: false
featured: false
---

Starting a new series — a project log for **FEMS (Factory Energy Management System)**.

I previously worked on running object detection on an edge AI board at my company, and the idea of combining **factory / industrial data with AI** has stuck with me ever since. As an extension of that, I decided to **build a RAG prototype while studying the FEMS domain**. "I studied it" doesn't feel as concrete as "I got this far actually running it."

Technologies I'll touch on in this series:

- **RAG**
- **Hugging Face, Ollama**
- **Embeddings, vector DB**
- **Token usage strategy / local vs cloud comparison**

RAG, embeddings, and vector DBs are somewhat familiar to me already since I covered them recently in [Building RAG From Scratch](/posts/rag-from-scratch-embedding-and-similarity-search) and [Building a RAG System with Chroma](/posts/rag-system-chroma-blog-qa). **Local LLM (Ollama)** is the new axis added here.

## Table of contents

## Spec check — VRAM 6GB is the deciding factor

| Item | Value |
|---|---|
| OS | Windows 11 |
| GPU | GTX 1660 Super |
| VRAM | **6 GB** |
| RAM | 32 GB |

**VRAM** is what determines cost-efficiency and speed for local LLMs. **With 6GB VRAM, larger models won't run.** Even a 7B model is tight without 4-bit quantization. Anything above 13B is practically impossible.

So I set the direction of the project as a **comparative experiment**:

> **In a low-spec on-premise environment, local inference vs calling the Claude / OpenAI API — which is more reasonable, and under what circumstances?**

This question also fits well with the **FEMS** domain itself. Factories tend to have strict rules about data leaving the premises, so there's a clear demand for **on-premise inference**. At the same time, introducing GPUs is costly, so **how far you can get on low-spec hardware** becomes a practical question.

## Data — how to gather FEMS domain documents

RAG needs source documents to base its answers on. Candidates in the FEMS domain:

- **FEMS manuals / guideline documents**
- **Energy data analysis reports**
- **Measurement values from the FEMS DB**

For now, I'll **write test guideline documents myself** to verify that the RAG pipeline works.

## Setup — Python scaffolding + Ollama

Basic skeleton:

- Python project scaffolding
- Installing **Ollama** (local LLM runtime)
- An adapter that calls 3 providers (Ollama / Claude / OpenAI) through the same interface

### Model selection — qwen2.5:7b locally, to fit 6GB VRAM

For the 3-provider comparison, I chose the following models for each:

| Provider | Model | Reason for selection |
|---|---|---|
| **Ollama** (local) | **qwen2.5:7b** | A 7B-class model that fits in 6GB VRAM, with strong Korean performance |
| **Claude** (cloud) | **claude-opus-4-8** | The current top-tier model in the lineup — used to check the upper bound on quality |
| **OpenAI** (cloud) | **gpt-4o** | A mid-priced comparison baseline |

For the local model, **VRAM is what dictates model choice**. A 7B model with 4-bit quantization needs roughly 4–5GB VRAM, which fits within 6GB. Anything above 13B isn't even worth trying. I picked **qwen2.5** because it strikes a good balance between Korean language and reasoning performance within the 7B class.

> For the cloud side, I deliberately set up **top-tier (Opus 4.8) vs mid-tier (gpt-4o)** to cover a range of price and quality. This way I can measure "how far the local model keeps up" against two different benchmarks.

### Smoke test — first run (cold start)

I first checked whether all three providers answer the same question correctly:

```powershell
python -m scripts.smoke_test
```

![First smoke test run — ollama cold start at 95.22s, claude at 2.72s, openai at 6.43s](/assets/posts/fems-project-log-01/01-smoke-test-cold-start.png)

| provider | model | latency | in / out tokens | cost |
|---|---|---|---|---|
| **ollama** | qwen2.5:7b | 95.22s | 47 / 36 | $0.00000 |
| **claude** | opus-4-8 | 2.72s | 60 / 73 | $0.00213 |
| **openai** | gpt-4o | 6.43s | 45 / 30 | $0.00041 |

**All three answered correctly.** The differences are in latency and cost:

- **Opus 4.8 is about 5x more expensive than gpt-4o** ($0.00213 vs $0.00041)
- **ollama (qwen2.5:7b) took 95 seconds** — due to the cold start. Since it was the first call, most of that time was spent loading the model.

### Smoke test — second run (after warm-up)

I ran it again with the model already loaded in memory:

![Second smoke test run — ollama down to 10 seconds, claude 2.46s, openai 2.62s](/assets/posts/fems-project-log-01/02-smoke-test-warm.png)

- **ollama**: 95s → **10.00s** (result of eliminating the cold start)
- claude: 2.72s → 2.46s
- openai: 6.43s → 2.62s

The gap between **95 seconds and 10 seconds** is operationally huge. In other words, **how you handle "the first call" is the key to latency** for local LLMs:

- Keep the model resident in memory at all times (memory cost)
- Swap it based on usage frequency (cold start each time)

This becomes a core question in designing the operating mode.

## Embedding model selection — Ollama's bge-m3

For embeddings, I settled on **Ollama's `bge-m3`**.

**Reasons for choosing it:**

- **Strong Korean / multilingual performance** — since the FEMS guidelines are in Korean, this is a critical requirement
- **No separate embedding API needed** — Ollama provides both the LLM and embeddings
- **Fully local** — embeddings are handled without any external API calls

**Options I considered but didn't use:**

| Option | Reason not used |
|---|---|
| LangChain / LlamaIndex | Dependencies are too heavy, and the abstraction is excessive |
| sentence-transformers (local) | The torch installation is heavy, and Ollama is more reasonable |

One thing to note — **Chroma's default embedding function is English-specialized.** Feeding it Korean documents directly degrades embedding quality. So I **computed the embeddings myself and injected them into Chroma** instead.

> In my previous [post on building RAG from scratch](/posts/rag-from-scratch-embedding-and-similarity-search), when I ran Korean text through OpenAI embeddings, the absolute similarity scores came out low, around 0.3 to 0.5. Since bge-m3 specializes in multilingual embeddings, checking whether this improves is one of the key points of this test.

## Building the index — starting with 5 chunks

I split the test guideline documents into **chunks of 800 characters or less** and indexed them:

```powershell
python -m scripts.build_index
```

![build_index run — 5 chunks loaded, bge-m3 embeddings, indexed into Chroma](/assets/posts/fems-project-log-01/03-build-index-chroma.png)

A total of **5 chunks**:

- Compressed air system efficiency guideline
- Peak power management guideline
- HVAC optimization guideline
- Energy-saving lighting guideline
- (1 more)

## Verifying RAG behavior — all 3 questions correct

I checked whether the **sources matched correctly** for the given questions:

```powershell
python -m scripts.rag_demo
```

![rag_demo results — all 3 questions matched correctly at rank 1. Compressed air / peak power / lighting guidelines respectively](/assets/posts/fems-project-log-01/04-rag-demo-results.png)

| Question | Top match | dist (cosine distance) |
|---|---|---|
| How to reduce energy waste in a compressed air system? | `02_compressed_air.md` | **0.322** |
| How to lower the peak demand on a factory's electricity bill? | `01_peak_demand.md` | **0.272** |
| What should you check if lighting power keeps registering overnight or on weekends? | `04_lighting.md` | **0.392** |

**All 3 were correct.** (Lower cosine distance means more similar — 0 means identical, 1 means unrelated.)

The **second question (peak demand)**, in particular, with a distance of 0.272, matched exceptionally well. This means **bge-m3 handles Korean properly**.

> In my previous post, when I ran Korean text through OpenAI's `text-embedding-3-small`, the top similarity scores fell between 0.3 and 0.5. With bge-m3, the distances come out at 0.27–0.39 (lower is better — converting to similarity gives roughly 0.6–0.73). The difference in multilingual embeddings shows up clearly in the numbers.

## Retrospective — the backbone is up

What I built out today:

- Python scaffolding ✅
- Ollama running locally ✅
- Simultaneous calls to 3 providers (ollama / claude / openai) ✅
- bge-m3 embeddings + Chroma index ✅
- 5-chunk RAG demo, 100% accuracy ✅

Next, I'll bring in actual public data PDFs (the Korea Energy Agency's FEMS implementation guide, energy-saving technical materials, etc.), increase the number of chunks, and move toward **comparing local vs cloud answer quality using real domain questions**.

## Things to study further

### 1. Ollama operating modes — keep-alive vs swap

- Controlling how long a model stays resident in memory via the `OLLAMA_KEEP_ALIVE` environment variable
- The cost of swapping when running multiple models on 6GB VRAM
- Automatic swap strategies based on usage frequency

### 2. bge-m3 vs other Korean embeddings

- **KoSimCSE / KoSBERT** — the de facto standard for Korean sentence embeddings
- **multilingual-e5-large** — a multilingual model with decent Korean performance
- Benchmarking embeddings on the same document set (comparing top-1 distance)

### 3. Why Chroma's default embedding function is English-specialized

- Chroma's default is `all-MiniLM-L6-v2` (sentence-transformers, English-centric)
- Injecting embeddings directly is the standard approach — set `embedding_function=None` when creating a collection
- Differences in embedding policy across other vector DBs like pgvector

### 4. Token usage strategy — from a RAG perspective

- The relationship between the **context window** and **number of chunks × chunk size**
- Using prompt caching to cache system prompts / tool definitions
- The impact of the K value in top-K retrieval on cost

### 5. The FEMS domain itself

- Korea Energy Agency's FEMS implementation guide (public PDF)
- Energy-saving technical materials — industrial sector (Korea Energy Agency)
- Peak management / compressed air / HVAC / lighting — the four common areas of savings
- Measurement items: power (kW, kWh), power factor, demand, gas/steam, and various other energy flows

### 6. Trade-offs of adopting on-premise LLMs

- Data security ↑ vs model quality ↓
- Initial GPU cost vs API call cost (break-even point calculation)
- Model update cycle — cloud updates automatically, on-premise requires manual fine-tuning / replacement